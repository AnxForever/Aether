import { IncomingMessage, ServerResponse } from 'http';
import * as jwt from 'jsonwebtoken';
import { EventEmitter } from 'events';

/**
 * JWT Token Payload Structure
 */
export interface JWTPayload {
  userId: string;
  role: string;
  permissions: string[];
  iat?: number;
  exp?: number;
}

/**
 * Extended Request with authenticated user context
 */
export interface AuthenticatedRequest extends IncomingMessage {
  user?: JWTPayload;
}

/**
 * Authentication Middleware Configuration
 */
export interface AuthMiddlewareConfig {
  jwtSecret: string;
  publicPaths?: string[];
  headerName?: string;
}

/**
 * Authentication Middleware Events
 */
export interface AuthMiddlewareEvents {
  'auth:success': (userId: string, path: string) => void;
  'auth:failure': (reason: string, path: string) => void;
  'auth:skip': (path: string) => void;
}

/**
 * JWT Authentication Middleware
 *
 * Responsibilities:
 * - Extract and verify JWT tokens from Authorization header
 * - Populate request context with authenticated user info
 * - Handle public paths (no auth required)
 * - Emit authentication events for monitoring
 */
export class AuthMiddleware extends EventEmitter {
  private config: Required<AuthMiddlewareConfig>;

  constructor(config: AuthMiddlewareConfig) {
    super();

    // Validate JWT Secret strength
    if (!config.jwtSecret || config.jwtSecret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters for security');
    }

    const uniqueChars = new Set(config.jwtSecret).size;
    if (uniqueChars < 16) {
      throw new Error('JWT secret has insufficient entropy');
    }

    this.config = {
      publicPaths: ['/health', '/metrics'],
      headerName: 'authorization',
      ...config,
    };
  }

  /**
   * Main authentication handler
   */
  public async authenticate(
    req: AuthenticatedRequest,
    res: ServerResponse
  ): Promise<boolean> {
    const path = req.url || '/';

    // Skip authentication for public paths
    if (this.isPublicPath(path)) {
      this.emit('auth:skip', path);
      return true;
    }

    try {
      const token = this.extractToken(req);

      if (!token) {
        this.emit('auth:failure', 'missing_token', path);
        this.sendUnauthorized(res, 'Authorization token required');
        return false;
      }

      const payload = this.verifyToken(token);
      req.user = payload;

      this.emit('auth:success', payload.userId, path);
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown_error';
      this.emit('auth:failure', reason, path);
      this.sendUnauthorized(res, 'Invalid or expired token');
      return false;
    }
  }

  /**
   * Extract JWT token from Authorization header
   * Supports "Bearer <token>" format
   */
  private extractToken(req: IncomingMessage): string | null {
    const authHeader = req.headers[this.config.headerName];

    if (!authHeader || typeof authHeader !== 'string') {
      return null;
    }

    // Support "Bearer <token>" format
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : authHeader;
  }

  /**
   * Verify JWT token and decode payload
   */
  private verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret);

      if (typeof decoded === 'string') {
        throw new Error('Invalid token payload');
      }

      return decoded as JWTPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('token_expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('token_invalid');
      }
      throw error;
    }
  }

  /**
   * Check if path is public (no auth required)
   */
  private isPublicPath(path: string): boolean {
    return this.config.publicPaths.some((publicPath) =>
      path.startsWith(publicPath)
    );
  }

  /**
   * Send 401 Unauthorized response
   */
  private sendUnauthorized(res: ServerResponse, message: string): void {
    res.writeHead(401, {
      'Content-Type': 'application/json',
      'WWW-Authenticate': 'Bearer realm="API Gateway"',
    });
    res.end(
      JSON.stringify({
        error: 'Unauthorized',
        message,
      })
    );
  }

  /**
   * Add public path dynamically
   */
  public addPublicPath(path: string): void {
    if (!this.config.publicPaths.includes(path)) {
      this.config.publicPaths.push(path);
    }
  }

  /**
   * Remove public path dynamically
   */
  public removePublicPath(path: string): void {
    this.config.publicPaths = this.config.publicPaths.filter(
      (p) => p !== path
    );
  }

  /**
   * Get current public paths
   */
  public getPublicPaths(): string[] {
    return [...this.config.publicPaths];
  }
}

/**
 * Type-safe event emitter for AuthMiddleware
 */
export interface AuthMiddleware {
  on<K extends keyof AuthMiddlewareEvents>(
    event: K,
    listener: AuthMiddlewareEvents[K]
  ): this;
  emit<K extends keyof AuthMiddlewareEvents>(
    event: K,
    ...args: Parameters<AuthMiddlewareEvents[K]>
  ): boolean;
}
