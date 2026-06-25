/**
 * Express Middleware Wrappers
 *
 * Adapts APIGateway components (AuthMiddleware, RateLimiter) to Express middleware
 */

import { Request, Response, NextFunction } from 'express';
import { AuthMiddleware, AuthenticatedRequest } from '../gateway/auth-middleware';
import { RateLimiter } from '../gateway/rate-limiter';
import { createLogger } from '../utils/logger';

const logger = createLogger('ExpressMiddleware');

/**
 * Extended Express Request with user context
 */
export interface AuthenticatedExpressRequest extends Request {
  user?: {
    userId: string;
    role: string;
    permissions: string[];
  };
}

/**
 * Create Express middleware from AuthMiddleware
 */
export function createAuthMiddleware(authMiddleware: AuthMiddleware) {
  return async (req: AuthenticatedExpressRequest, res: Response, next: NextFunction): Promise<void> => {
    // Convert Express request to Node IncomingMessage format
    const nodeReq = req as unknown as AuthenticatedRequest;

    // Use AuthMiddleware's authenticate method
    const isAuthenticated = await authMiddleware.authenticate(nodeReq, res);

    if (isAuthenticated && nodeReq.user) {
      // Copy user context to Express request
      req.user = nodeReq.user;
      next();
    }
    // If not authenticated, AuthMiddleware already sent response
  };
}

/**
 * Create Express middleware from RateLimiter
 */
export function createRateLimitMiddleware(rateLimiter: RateLimiter) {
  return async (req: AuthenticatedExpressRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Determine rate limit key
      const identifier = req.user
        ? `user:${req.user.userId}`
        : `ip:${getClientIp(req)}`;

      // Unauthenticated users consume more quota
      const cost = req.user ? 1 : 10;

      const isAllowed = await rateLimiter.allow(identifier, cost);

      if (!isAllowed) {
        const remaining = rateLimiter.getTokens(identifier);

        res.status(429).json({
          success: false,
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(60 - (remaining / 100) * 60) // Estimate retry time
        });
        return;
      }

      // Add rate limit info to response headers
      const remaining = rateLimiter.getTokens(identifier);
      res.setHeader('X-RateLimit-Remaining', remaining.toString());

      next();
    } catch (error) {
      logger.error('Rate limit check failed:', error as Error);
      // On rate limiter error, allow request but log
      next();
    }
  };
}

/**
 * Extract client IP from Express request
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Error handling middleware
 */
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  logger.error('Unhandled error:', err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
}

/**
 * Request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });

  next();
}
