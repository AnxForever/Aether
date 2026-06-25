/**
 * Sentry Integration Example
 *
 * Quick example showing how to use Sentry monitoring in Nexus Agent
 */

import { createSentryManagerFromEnv } from '../src/monitoring';
import { createLogger } from '../src/utils/logger';

// ============================================================================
// 1. Initialize Sentry
// ============================================================================

const sentry = createSentryManagerFromEnv();
sentry.initialize();

// Set global tags
sentry.setTags({
  app: 'nexus-agent',
  version: '1.0.0'
});

// ============================================================================
// 2. Integrate with Logger (Automatic Error Capture)
// ============================================================================

const logger = createLogger('Example');

// Add Sentry handler to logger
logger.addHandler((entry) => {
  // Add all logs as breadcrumbs
  sentry.addBreadcrumb({
    level: entry.level,
    message: entry.message,
    category: 'log',
    data: entry.context
  });

  // Capture errors automatically
  if (entry.level === 'error' && entry.context?.error) {
    sentry.captureException(entry.context.error, {
      tags: { module: 'Example' },
      context: entry.context
    });
  }
});

// ============================================================================
// 3. Error Tracking Examples
// ============================================================================

async function errorTrackingExample() {
  // Set user context
  sentry.setUser({
    id: 'user-123',
    email: 'user@example.com',
    username: 'john_doe'
  });

  try {
    // Your code that might throw
    throw new Error('Something went wrong!');
  } catch (error) {
    // Capture with additional context
    sentry.captureException(error as Error, {
      tags: {
        module: 'auth',
        action: 'login'
      },
      context: {
        request: {
          method: 'POST',
          url: '/api/login'
        }
      }
    });
  }

  // Capture message (non-error event)
  sentry.captureMessage('User completed onboarding', {
    severity: 'info',
    tags: { feature: 'onboarding' }
  });
}

// ============================================================================
// 4. Performance Monitoring Examples
// ============================================================================

async function performanceExample() {
  // Measure async function
  const userData = await sentry.measureAsync(
    'fetch-user-data',
    async () => {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { id: 1, name: 'John' };
    },
    {
      op: 'db.query',
      tags: { table: 'users' }
    }
  );

  // Manual transaction control
  const txId = sentry.startTransaction('process-payment', 'payment', {
    tags: { amount: 100, currency: 'USD' }
  });

  try {
    // Simulate processing
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Finish transaction successfully
    sentry.finishTransaction(txId, { status: 'ok' });
  } catch (error) {
    // Finish transaction with error
    sentry.finishTransaction(txId, { status: 'error' });
    throw error;
  }
}

// ============================================================================
// 5. Breadcrumbs Examples
// ============================================================================

function breadcrumbsExample() {
  // HTTP request breadcrumb
  sentry.addBreadcrumb({
    type: 'http',
    category: 'api',
    message: 'POST /api/users',
    level: 'info',
    data: {
      url: '/api/users',
      method: 'POST',
      status_code: 200,
      duration: 123
    }
  });

  // User action breadcrumb
  sentry.addBreadcrumb({
    type: 'user',
    category: 'ui',
    message: 'User clicked button',
    level: 'info',
    data: {
      button_id: 'submit-form',
      screen: 'profile'
    }
  });

  // Database query breadcrumb
  sentry.addBreadcrumb({
    type: 'query',
    category: 'database',
    message: 'SELECT * FROM users WHERE id = ?',
    level: 'debug',
    data: {
      query_time: 45
    }
  });
}

// ============================================================================
// 6. Get Statistics
// ============================================================================

function statsExample() {
  // Get Sentry statistics
  const stats = sentry.getStats();
  console.log('Sentry Stats:', stats);
  // {
  //   totalEvents: 123,
  //   totalErrors: 45,
  //   totalTransactions: 78,
  //   eventsDropped: 0,
  //   lastEventTime: 1234567890
  // }

  // Get performance metrics
  const perfMetrics = sentry.getPerformanceMetrics();
  console.log('Performance Metrics:', perfMetrics);
  // {
  //   transactionCount: 78,
  //   spanCount: 234,
  //   avgDuration: 150,
  //   maxDuration: 500,
  //   minDuration: 10
  // }
}

// ============================================================================
// 7. Graceful Shutdown
// ============================================================================

async function shutdown() {
  logger.info('Shutting down application...');

  // Flush pending events and close Sentry
  await sentry.close(5000);

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// ============================================================================
// 8. Environment Configuration
// ============================================================================

/*
Add to .env:

SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
SENTRY_ENVIRONMENT=production
SENTRY_ENABLED=true
SENTRY_SAMPLE_RATE=1.0
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1

Development (Sentry disabled):
NODE_ENV=development
SENTRY_ENABLED=false
*/

// ============================================================================
// Run Examples
// ============================================================================

async function main() {
  logger.info('Starting Sentry examples...');

  await errorTrackingExample();
  await performanceExample();
  breadcrumbsExample();
  statsExample();

  logger.info('Examples completed');
}

// Uncomment to run
// main().catch(console.error);

export { sentry, logger };
