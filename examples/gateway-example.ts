import { APIGateway } from './api-gateway';
import * as jwt from 'jsonwebtoken';

/**
 * Example: Complete API Gateway Setup
 *
 * This demonstrates:
 * - Gateway initialization with all components
 * - Upstream service configuration
 * - Routing rules
 * - JWT token generation (for testing)
 * - Event monitoring
 */

const JWT_SECRET = 'your-super-secret-jwt-key-change-in-production';

/**
 * Create and configure API Gateway
 */
async function createGateway(): Promise<APIGateway> {
  const gateway = new APIGateway({
    port: 8080,
    host: '0.0.0.0',

    // Authentication configuration
    auth: {
      jwtSecret: JWT_SECRET,
      publicPaths: ['/health', '/metrics', '/auth/login'],
      headerName: 'authorization',
    },

    // Rate limiting configuration (Token Bucket)
    rateLimit: {
      maxTokens: 100, // 100 requests burst
      refillRate: 10, // 10 requests per second sustained
    },

    // Router configuration
    router: {
      defaultTimeout: 30000,

      // Upstream services
      services: [
        {
          name: 'auth-service',
          host: 'localhost',
          port: 3001,
          protocol: 'http',
          healthCheckPath: '/health',
          timeout: 5000,
        },
        {
          name: 'user-service',
          host: 'localhost',
          port: 3002,
          protocol: 'http',
          healthCheckPath: '/health',
        },
        {
          name: 'order-service',
          host: 'localhost',
          port: 3003,
          protocol: 'http',
          healthCheckPath: '/health',
        },
      ],

      // Routing rules (most specific first)
      routes: [
        {
          pathPrefix: '/api/auth',
          service: 'auth-service',
          stripPrefix: false,
        },
        {
          pathPrefix: '/api/users',
          service: 'user-service',
          stripPrefix: false,
        },
        {
          pathPrefix: '/api/orders',
          service: 'order-service',
          stripPrefix: false,
        },
        {
          pathPrefix: '/v2/users',
          service: 'user-service',
          stripPrefix: true, // /v2/users/123 -> /123
          rewritePath: (path) => `/api/v2${path}`,
        },
      ],
    },
  });

  return gateway;
}

/**
 * Setup event monitoring
 */
function setupMonitoring(gateway: APIGateway): void {
  // Gateway lifecycle events
  gateway.on('gateway:started', (port) => {
    console.log(`✅ API Gateway started on port ${port}`);
    console.log(`   Health check: http://localhost:${port}/health`);
    console.log(`   Metrics: http://localhost:${port}/metrics`);
  });

  gateway.on('gateway:stopped', () => {
    console.log('🛑 API Gateway stopped');
  });

  gateway.on('gateway:error', (error) => {
    console.error('❌ Gateway error:', error.message);
  });

  // Request tracking
  gateway.on('request:received', (method, path) => {
    console.log(`📥 ${method} ${path}`);
  });

  gateway.on('request:completed', (statusCode, duration) => {
    const emoji = statusCode < 400 ? '✅' : '❌';
    console.log(`${emoji} Response: ${statusCode} (${duration}ms)`);
  });

  // Component-level events
  const auth = gateway.getAuthMiddleware();
  auth.on('auth:success', (userId, path) => {
    console.log(`🔐 Auth success: ${userId} -> ${path}`);
  });

  auth.on('auth:failure', (reason, path) => {
    console.log(`🔒 Auth failure: ${reason} -> ${path}`);
  });

  const rateLimiter = gateway.getRateLimiter();
  rateLimiter.on('limit:exceeded', (identifier) => {
    console.log(`🚦 Rate limit exceeded: ${identifier}`);
  });

  rateLimiter.on('bucket:cleaned', (count) => {
    console.log(`🧹 Cleaned ${count} inactive rate limit buckets`);
  });

  const router = gateway.getRouter();
  router.on('route:matched', (path, service) => {
    console.log(`🎯 Route matched: ${path} -> ${service}`);
  });

  router.on('route:not_found', (path) => {
    console.log(`❓ No route found for: ${path}`);
  });

  router.on('proxy:timeout', (service) => {
    console.log(`⏱️  Proxy timeout: ${service}`);
  });
}

/**
 * Generate JWT token for testing
 */
function generateTestToken(userId: string, role: string): string {
  return jwt.sign(
    {
      userId,
      role,
      permissions: ['read', 'write'],
    },
    JWT_SECRET,
    {
      expiresIn: '1h',
    }
  );
}

/**
 * Print example curl commands
 */
function printExamples(): void {
  const token = generateTestToken('user-123', 'admin');

  console.log('\n📖 Example requests:\n');

  console.log('1. Health check (no auth required):');
  console.log('   curl http://localhost:8080/health\n');

  console.log('2. Metrics (no auth required):');
  console.log('   curl http://localhost:8080/metrics\n');

  console.log('3. Authenticated request:');
  console.log(`   curl -H "Authorization: Bearer ${token}" \\`);
  console.log('        http://localhost:8080/api/users/me\n');

  console.log('4. Test rate limiting (send 110+ requests quickly):');
  console.log(`   for i in {1..110}; do`);
  console.log(`     curl -H "Authorization: Bearer ${token}" \\`);
  console.log('          http://localhost:8080/api/users/me &');
  console.log('   done\n');

  console.log('5. Invalid token (should get 401):');
  console.log('   curl -H "Authorization: Bearer invalid-token" \\');
  console.log('        http://localhost:8080/api/users/me\n');
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    // Create and configure gateway
    const gateway = await createGateway();

    // Setup monitoring
    setupMonitoring(gateway);

    // Start gateway
    await gateway.start();

    // Print examples
    printExamples();

    // Graceful shutdown
    const shutdown = async (): Promise<void> => {
      console.log('\n🛑 Shutting down gracefully...');
      await gateway.stop();
      console.log('👋 Goodbye!');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Print stats every 30 seconds
    setInterval(() => {
      const stats = gateway.getStats();
      console.log('\n📊 Gateway Statistics:');
      console.log(`   Total requests: ${stats.totalRequests}`);
      console.log(`   Successful: ${stats.successfulRequests}`);
      console.log(`   Failed: ${stats.failedRequests}`);
      console.log(`   Auth failures: ${stats.authFailures}`);
      console.log(`   Rate limited: ${stats.rateLimitExceeded}`);
      console.log(`   Routing errors: ${stats.routingErrors}`);
      console.log(`   Uptime: ${Math.floor(stats.uptime / 1000)}s\n`);
    }, 30000);
  } catch (error) {
    console.error('❌ Failed to start gateway:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { createGateway, generateTestToken, setupMonitoring };
