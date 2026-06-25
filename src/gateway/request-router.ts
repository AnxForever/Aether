import { IncomingMessage, ServerResponse } from 'http';
import { EventEmitter } from 'events';
import * as http from 'http';
import * as https from 'https';

/**
 * Upstream Service Configuration
 */
export interface UpstreamService {
  name: string;
  host: string;
  port: number;
  protocol: 'http' | 'https';
  healthCheckPath?: string;
  timeout?: number;
}

/**
 * Routing Rule Configuration
 */
export interface RoutingRule {
  pathPrefix: string;
  service: string;
  stripPrefix?: boolean;
  rewritePath?: (path: string) => string;
}

/**
 * Request Router Configuration
 */
export interface RequestRouterConfig {
  services: UpstreamService[];
  routes: RoutingRule[];
  defaultTimeout?: number;
  trustProxy?: boolean;
  trustedProxies?: string[];
}

/**
 * Request Router Events
 */
export interface RequestRouterEvents {
  'route:matched': (path: string, service: string) => void;
  'route:not_found': (path: string) => void;
  'proxy:start': (service: string, path: string) => void;
  'proxy:success': (service: string, statusCode: number, duration: number) => void;
  'proxy:error': (service: string, error: string) => void;
  'proxy:timeout': (service: string) => void;
}

/**
 * Request Router - Path-based routing and proxying
 *
 * Responsibilities:
 * - Match incoming requests to upstream services
 * - Forward requests with proper headers
 * - Stream response back to client
 * - Handle timeouts and errors
 * - Emit routing events for monitoring
 */
export class RequestRouter extends EventEmitter {
  private config: Required<RequestRouterConfig>;
  private serviceMap: Map<string, UpstreamService>;

  constructor(config: RequestRouterConfig) {
    super();
    this.config = {
      defaultTimeout: 30000,
      trustProxy: false,
      trustedProxies: [],
      ...config,
    };
    this.serviceMap = new Map(
      config.services.map((svc) => [svc.name, svc])
    );
  }

  /**
   * Route and proxy incoming request
   */
  public async route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const path = req.url || '/';

    // Find matching route
    const route = this.findRoute(path);

    if (!route) {
      this.emit('route:not_found', path);
      this.sendNotFound(res, path);
      return;
    }

    const service = this.serviceMap.get(route.service);

    if (!service) {
      this.emit('proxy:error', route.service, 'service_not_configured');
      this.sendServiceUnavailable(res, route.service);
      return;
    }

    this.emit('route:matched', path, service.name);

    // Transform path if needed
    const targetPath = this.transformPath(path, route);

    // Proxy request
    await this.proxyRequest(req, res, service, targetPath);
  }

  /**
   * Find matching route for path
   */
  private findRoute(path: string): RoutingRule | null {
    // Find most specific match (longest prefix)
    const matches = this.config.routes.filter((route) =>
      path.startsWith(route.pathPrefix)
    );

    if (matches.length === 0) {
      return null;
    }

    // Sort by prefix length (descending)
    matches.sort((a, b) => b.pathPrefix.length - a.pathPrefix.length);

    return matches[0];
  }

  /**
   * Transform request path based on routing rule
   */
  private transformPath(originalPath: string, route: RoutingRule): string {
    let path = originalPath;

    // Strip prefix if configured
    if (route.stripPrefix) {
      path = path.slice(route.pathPrefix.length) || '/';
    }

    // Apply custom rewrite if provided
    if (route.rewritePath) {
      path = route.rewritePath(path);
    }

    return path;
  }

  /**
   * Proxy request to upstream service
   */
  private async proxyRequest(
    req: IncomingMessage,
    res: ServerResponse,
    service: UpstreamService,
    targetPath: string
  ): Promise<void> {
    const startTime = Date.now();
    const httpModule = service.protocol === 'https' ? https : http;

    this.emit('proxy:start', service.name, targetPath);

    const proxyReq = httpModule.request(
      {
        hostname: service.host,
        port: service.port,
        path: targetPath,
        method: req.method,
        headers: this.prepareHeaders(req, service),
        timeout: service.timeout || this.config.defaultTimeout,
      },
      (proxyRes) => {
        const duration = Date.now() - startTime;
        this.emit('proxy:success', service.name, proxyRes.statusCode || 0, duration);

        // Forward response headers
        res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);

        // Stream response body
        proxyRes.pipe(res);
      }
    );

    // Handle timeout
    proxyReq.on('timeout', () => {
      this.emit('proxy:timeout', service.name);
      proxyReq.destroy();
      if (!res.headersSent) {
        this.sendGatewayTimeout(res, service.name);
      }
    });

    // Handle errors
    proxyReq.on('error', (error) => {
      this.emit('proxy:error', service.name, error.message);
      if (!res.headersSent) {
        this.sendBadGateway(res, service.name, error.message);
      }
    });

    // Forward request body
    req.pipe(proxyReq);
  }

  /**
   * Prepare headers for upstream request
   */
  private prepareHeaders(
    req: IncomingMessage,
    service: UpstreamService
  ): http.OutgoingHttpHeaders {
    // SECURITY: Whitelist allowed headers
    const ALLOWED_HEADERS = [
      'content-type',
      'content-length',
      'accept',
      'accept-encoding',
      'accept-language',
      'authorization',
      'user-agent',
      'referer',
      'cookie'
    ];

    const headers: http.OutgoingHttpHeaders = {};

    // Filter headers through whitelist
    for (const [key, value] of Object.entries(req.headers)) {
      if (ALLOWED_HEADERS.includes(key.toLowerCase())) {
        headers[key] = value;
      }
    }

    // Add X-Forwarded-* headers
    headers['x-forwarded-for'] = this.getClientIp(req);
    headers['x-forwarded-proto'] = 'http';
    headers['x-forwarded-host'] = req.headers.host || 'unknown';

    // Update Host header
    headers.host = `${service.host}:${service.port}`;

    return headers;
  }

  /**
   * Extract client IP address
   */
  private getClientIp(req: IncomingMessage): string {
    // SECURITY: Only trust X-Forwarded-For if explicitly configured
    if (this.config.trustProxy) {
      const forwarded = req.headers['x-forwarded-for'];
      if (typeof forwarded === 'string') {
        const ips = forwarded.split(',').map(ip => ip.trim());
        // If trusted proxies configured, validate
        if (this.config.trustedProxies && this.config.trustedProxies.length > 0) {
          const clientIp = req.socket.remoteAddress || 'unknown';
          if (this.config.trustedProxies.includes(clientIp)) {
            return ips[0];
          }
        } else {
          return ips[0];
        }
      }
    }

    return req.socket.remoteAddress || 'unknown';
  }

  /**
   * Send 404 Not Found response
   */
  private sendNotFound(res: ServerResponse, path: string): void {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'Not Found',
        message: `No route found for path: ${path}`,
      })
    );
  }

  /**
   * Send 503 Service Unavailable response
   */
  private sendServiceUnavailable(res: ServerResponse, service: string): void {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'Service Unavailable',
        message: `Service not configured: ${service}`,
      })
    );
  }

  /**
   * Send 502 Bad Gateway response
   */
  private sendBadGateway(
    res: ServerResponse,
    service: string,
    error: string
  ): void {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'Bad Gateway',
        message: `Failed to reach service: ${service}`,
        detail: error,
      })
    );
  }

  /**
   * Send 504 Gateway Timeout response
   */
  private sendGatewayTimeout(res: ServerResponse, service: string): void {
    res.writeHead(504, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'Gateway Timeout',
        message: `Service did not respond in time: ${service}`,
      })
    );
  }

  /**
   * Add or update service dynamically
   */
  public addService(service: UpstreamService): void {
    this.serviceMap.set(service.name, service);
  }

  /**
   * Remove service dynamically
   */
  public removeService(serviceName: string): void {
    this.serviceMap.delete(serviceName);
  }

  /**
   * Get all configured services
   */
  public getServices(): UpstreamService[] {
    return Array.from(this.serviceMap.values());
  }

  /**
   * Get all configured routes
   */
  public getRoutes(): RoutingRule[] {
    return [...this.config.routes];
  }
}

/**
 * Type-safe event emitter for RequestRouter
 */
export interface RequestRouter {
  on<K extends keyof RequestRouterEvents>(
    event: K,
    listener: RequestRouterEvents[K]
  ): this;
  emit<K extends keyof RequestRouterEvents>(
    event: K,
    ...args: Parameters<RequestRouterEvents[K]>
  ): boolean;
}
