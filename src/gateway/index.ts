/**
 * API Gateway Module
 *
 * A production-ready HTTP API Gateway with:
 * - JWT Authentication
 * - Token Bucket Rate Limiting
 * - Path-based Request Routing
 * - Request/Response Proxying
 * - Monitoring & Metrics
 *
 * @module gateway
 */

// Core components
export { APIGateway } from './api-gateway';
export type {
  APIGatewayConfig,
  GatewayStats,
  APIGatewayEvents,
} from './api-gateway';

// Authentication
export { AuthMiddleware } from './auth-middleware';
export type {
  JWTPayload,
  AuthenticatedRequest,
  AuthMiddlewareConfig,
  AuthMiddlewareEvents,
} from './auth-middleware';

// Rate Limiting
export { RateLimiter } from './rate-limiter';
export type {
  RateLimiterConfig,
  RateLimiterEvents,
} from './rate-limiter';

// Request Routing
export { RequestRouter } from './request-router';
export type {
  UpstreamService,
  RoutingRule,
  RequestRouterConfig,
  RequestRouterEvents,
} from './request-router';

// Gateway client (existing)
export * from './gateway-client';
