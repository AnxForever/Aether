import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { EventEmitter } from 'events';
import {
  AuthMiddleware,
  AuthMiddlewareConfig,
  AuthenticatedRequest,
} from './auth-middleware';
import { RateLimiter, RateLimiterConfig } from './rate-limiter';
import {
  RequestRouter,
  RequestRouterConfig,
} from './request-router';
import { createLogger } from '../utils/logger';

const logger = createLogger('APIGateway');

/**
 * API Gateway Configuration
 */
export interface APIGatewayConfig {
  port: number;
  host?: string;
  auth: AuthMiddlewareConfig;
  rateLimit: RateLimiterConfig;
  router: RequestRouterConfig;
  allowedOrigins?: string[];
  requestTimeout?: number;
}

/**
 * Gateway Request Statistics
 */
export interface GatewayStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  authFailures: number;
  rateLimitExceeded: number;
  routingErrors: number;
  uptime: number;
}

/**
 * API Gateway Events
 */
export interface APIGatewayEvents {
  'gateway:started': (port: number) => void;
  'gateway:stopped': () => void;
  'gateway:error': (error: Error) => void;
  'request:received': (method: string, path: string) => void;
  'request:completed': (statusCode: number, duration: number) => void;
}

/**
 * API Gateway - Main entry point
 *
 * Architecture:
 * 1. Request arrives
 * 2. Authentication (AuthMiddleware)
 * 3. Rate limiting (RateLimiter)
 * 4. Routing & proxying (RequestRouter)
 * 5. Response
 *
 * Features:
 * - JWT authentication
 * - Per-user rate limiting
 * - Path-based routing
 * - Request/response logging
 * - Health check endpoint
 * - Metrics endpoint
 */
export class APIGateway extends EventEmitter {
  private config: Required<APIGatewayConfig>;
  private server: Server | null;
  private authMiddleware: AuthMiddleware;
  private rateLimiter: RateLimiter;
  private router: RequestRouter;
  private stats: GatewayStats;
  private startTime: number;

  constructor(config: APIGatewayConfig) {
    super();
    this.config = {
      host: '0.0.0.0',
      allowedOrigins: ['http://localhost:3000', 'http://localhost:5173'],
      requestTimeout: 30000,
      ...config,
    };
    this.server = null;
    this.startTime = Date.now();

    // Initialize components
    this.authMiddleware = new AuthMiddleware(config.auth);
    this.rateLimiter = new RateLimiter(config.rateLimit);
    this.router = new RequestRouter(config.router);

    // Initialize stats
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      authFailures: 0,
      rateLimitExceeded: 0,
      routingErrors: 0,
      uptime: 0,
    };

    // Wire up event listeners
    this.setupEventListeners();
  }

  /**
   * Start API Gateway server
   */
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = createServer((req, res) => {
          this.handleRequest(req as AuthenticatedRequest, res);
        });

        this.server.on('error', (error) => {
          this.emit('gateway:error', error);
          reject(error);
        });

        this.server.listen(this.config.port, this.config.host, () => {
          this.emit('gateway:started', this.config.port);
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop API Gateway server
   */
  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        // Cleanup components
        this.rateLimiter.destroy();
        this.authMiddleware.removeAllListeners();
        this.router.removeAllListeners();

        this.emit('gateway:stopped');
        resolve();
      });
    });
  }

  /**
   * Main request handler - orchestrates entire pipeline
   */
  private async handleRequest(
    req: AuthenticatedRequest,
    res: ServerResponse
  ): Promise<void> {
    const startTime = Date.now();
    const method = req.method || 'GET';
    const path = req.url || '/';

    this.stats.totalRequests++;
    this.emit('request:received', method, path);
    logger.info('{method} {url}', { method, url: path });

    // SECURITY: Set request timeout to prevent slow attacks
    req.setTimeout(this.config.requestTimeout, () => {
      if (!res.headersSent) {
        res.writeHead(408, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Request Timeout',
          message: 'Request took too long to complete'
        }));
      }
      req.destroy();
    });

    try {
      // Step 0: Handle CORS
      if (this.handleCORS(req, res)) {
        return;
      }

      // Step 1: Handle internal endpoints
      if (await this.handleInternalEndpoints(req, res)) {
        return;
      }

      // Step 2: Authentication
      const isAuthenticated = await this.authMiddleware.authenticate(req, res);
      if (!isAuthenticated) {
        this.stats.authFailures++;
        this.stats.failedRequests++;
        this.emitRequestCompleted(res.statusCode, startTime);
        return;
      }

      // Step 3: Rate limiting
      // Differentiate authenticated vs unauthenticated users
      const rateLimitKey = req.user
        ? `user:${req.user.userId}`
        : `ip:${this.getClientIp(req)}`;

      // Unauthenticated users consume more quota
      const cost = req.user ? 1 : 10;
      const isAllowed = await this.rateLimiter.allow(rateLimitKey, cost);
      if (!isAllowed) {
        this.stats.rateLimitExceeded++;
        this.stats.failedRequests++;
        this.sendRateLimitExceeded(res);
        this.emitRequestCompleted(res.statusCode, startTime);
        return;
      }

      // Step 4: Route to upstream service
      await this.router.route(req, res);

      // Track success
      if (res.statusCode < 400) {
        this.stats.successfulRequests++;
      } else {
        this.stats.failedRequests++;
        if (res.statusCode === 404 || res.statusCode >= 500) {
          this.stats.routingErrors++;
        }
      }

      this.emitRequestCompleted(res.statusCode, startTime);
    } catch (error) {
      this.stats.failedRequests++;
      logger.error('Request failed: {method} {url}', error instanceof Error ? error : new Error(String(error)), { method, url: path });
      this.handleError(res, error);
      this.emitRequestCompleted(res.statusCode, startTime);
    }
  }

  /**
   * Handle CORS preflight and headers
   */
  private handleCORS(req: IncomingMessage, res: ServerResponse): boolean {
    const origin = req.headers.origin;

    // SECURITY: Validate origin against whitelist
    if (origin && this.config.allowedOrigins?.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Max-Age', '86400');
    }

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return true;
    }

    return false;
  }

  /**
   * Handle internal gateway endpoints (health, metrics)
   */
  private async handleInternalEndpoints(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<boolean> {
    const path = req.url || '/';

    // Health check endpoint
    if (path === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: Date.now() - this.startTime,
        })
      );
      return true;
    }

    // Metrics endpoint
    if (path === '/metrics') {
      this.stats.uptime = Date.now() - this.startTime;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.getMetrics()));
      return true;
    }

    return false;
  }

  /**
   * Get comprehensive metrics
   */
  private getMetrics(): Record<string, unknown> {
    return {
      gateway: {
        ...this.stats,
        uptime: Date.now() - this.startTime,
      },
      rateLimiter: this.rateLimiter.getStats(),
      router: {
        services: this.router.getServices().length,
        routes: this.router.getRoutes().length,
      },
    };
  }

  /**
   * Setup event listeners for components
   */
  private setupEventListeners(): void {
    // Auth middleware events
    this.authMiddleware.on('auth:success', (userId, path) => {
      logger.debug('Auth success: {userId} accessing {path}', { userId, path });
    });

    this.authMiddleware.on('auth:failure', (reason, path) => {
      logger.debug('Auth failure: {reason} for {path}', { reason, path });
    });

    // Rate limiter events
    this.rateLimiter.on('limit:exceeded', (identifier) => {
      logger.debug('Rate limit exceeded for {identifier}', { identifier });
    });

    // Router events
    this.router.on('route:not_found', (path) => {
      logger.debug('Route not found: {path}', { path });
    });

    this.router.on('proxy:error', (service, error) => {
      logger.error('Proxy error for service {service}: {error}', undefined, { service, error });
    });
  }

  /**
   * Send 429 Too Many Requests response
   */
  private sendRateLimitExceeded(res: ServerResponse): void {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
      })
    );
  }

  /**
   * Handle unexpected errors
   */
  private handleError(res: ServerResponse, error: unknown): void {
    const message = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Error response sent: {status}', undefined, { status: 500, message });

    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Internal Server Error',
          message,
        })
      );
    }
  }

  /**
   * Extract client IP address
   */
  private getClientIp(req: IncomingMessage): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || 'unknown';
  }

  /**
   * Emit request completed event
   */
  private emitRequestCompleted(statusCode: number, startTime: number): void {
    const duration = Date.now() - startTime;
    this.emit('request:completed', statusCode, duration);
  }

  /**
   * Get current statistics
   */
  public getStats(): GatewayStats {
    return {
      ...this.stats,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Get authentication middleware (for testing/admin)
   */
  public getAuthMiddleware(): AuthMiddleware {
    return this.authMiddleware;
  }

  /**
   * Get rate limiter (for testing/admin)
   */
  public getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  /**
   * Get router (for testing/admin)
   */
  public getRouter(): RequestRouter {
    return this.router;
  }
}

/**
 * Type-safe event emitter for APIGateway
 */
export interface APIGateway {
  on<K extends keyof APIGatewayEvents>(
    event: K,
    listener: APIGatewayEvents[K]
  ): this;
  emit<K extends keyof APIGatewayEvents>(
    event: K,
    ...args: Parameters<APIGatewayEvents[K]>
  ): boolean;
}
