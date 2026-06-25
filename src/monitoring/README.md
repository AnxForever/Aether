# Sentry Integration

Enterprise-grade error tracking and performance monitoring for Aether.

## Features

- **Error Tracking**: Automatic exception capture with context
- **Performance Monitoring**: Transaction and span tracking
- **Breadcrumbs**: HTTP requests, logs, and custom events
- **Release Management**: Version tracking and regression analysis
- **User Context**: Associate errors with specific users
- **Sensitive Data Filtering**: Automatic password/token filtering
- **Development Mode**: Disabled in local development

## Quick Start

### 1. Configure Environment Variables

```bash
# .env
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
SENTRY_ENVIRONMENT=production
SENTRY_ENABLED=true
```

### 2. Initialize Sentry

```typescript
import { createSentryManagerFromEnv } from './monitoring';

// Create and initialize
const sentry = createSentryManagerFromEnv();
sentry.initialize();

// Set user context
sentry.setUser({
  id: 'user-123',
  email: 'user@example.com',
  username: 'john_doe'
});
```

### 3. Capture Errors

```typescript
try {
  // Your code
} catch (error) {
  sentry.captureException(error, {
    tags: { module: 'auth' },
    context: { action: 'login' }
  });
}
```

### 4. Track Performance

```typescript
// Measure async function
const result = await sentry.measureAsync(
  'fetch-user-data',
  async () => {
    return await fetchUserData(userId);
  },
  { op: 'db.query', tags: { user_id: userId } }
);

// Manual transaction
const txId = sentry.startTransaction('process-payment', 'payment');
// ... do work
sentry.finishTransaction(txId, { status: 'ok' });
```

### 5. Add Breadcrumbs

```typescript
sentry.addBreadcrumb({
  type: 'http',
  category: 'api',
  message: 'POST /api/users',
  data: { status: 200, duration: 123 }
});
```

## Integration with Logger

Integrate Sentry with the existing Logger to automatically capture errors:

```typescript
import { createLogger } from '../utils/logger';
import { createSentryManagerFromEnv } from './monitoring';

const sentry = createSentryManagerFromEnv();
sentry.initialize();

const logger = createLogger('MyModule');

// Add Sentry handler
logger.addHandler((entry) => {
  // Add breadcrumb for all logs
  sentry.addBreadcrumb({
    level: entry.level,
    message: entry.message,
    category: 'log',
    data: entry.context
  });

  // Capture errors
  if (entry.level === 'error' && entry.context?.error) {
    sentry.captureException(entry.context.error, {
      tags: { logger: 'MyModule' },
      context: entry.context
    });
  }
});
```

## Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SENTRY_DSN` | Sentry Data Source Name | (required) |
| `SENTRY_ENVIRONMENT` | Environment name | `production` |
| `SENTRY_RELEASE` | Release version | `package.json` version |
| `SENTRY_ENABLED` | Enable/disable Sentry | `true` |
| `SENTRY_SAMPLE_RATE` | Error sampling rate (0-1) | `1.0` |
| `SENTRY_TRACES_SAMPLE_RATE` | Performance sampling (0-1) | `0.1` |
| `SENTRY_PROFILES_SAMPLE_RATE` | Profiling sampling (0-1) | `0.1` |
| `SENTRY_DEBUG` | Enable debug logging | `false` |
| `SENTRY_ENABLE_PROFILING` | Enable profiling | `true` |
| `SENTRY_SERVER_NAME` | Server identifier | hostname |

### Programmatic Configuration

```typescript
import { SentryManager } from './monitoring';

const sentry = new SentryManager({
  dsn: 'https://xxxxx@xxxxx.ingest.sentry.io/xxxxx',
  environment: 'production',
  release: '1.0.0',
  sampleRate: 1.0,
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
  debug: false,
  enableProfiling: true,
  serverName: 'aether-01',
  
  // Custom hooks
  beforeSend: (event, hint) => {
    // Filter or modify events
    return event;
  },
  
  beforeBreadcrumb: (breadcrumb, hint) => {
    // Filter or modify breadcrumbs
    return breadcrumb;
  }
});

sentry.initialize();
```

## API Reference

### SentryManager

#### Methods

- `initialize()`: Initialize Sentry
- `setUser(user)`: Set user context
- `setTag(key, value)`: Set single tag
- `setTags(tags)`: Set multiple tags
- `setContext(name, context)`: Set custom context
- `addBreadcrumb(breadcrumb)`: Add breadcrumb
- `captureException(error, options)`: Capture exception
- `captureMessage(message, options)`: Capture message
- `startTransaction(name, op, options)`: Start transaction
- `finishTransaction(id, tags)`: Finish transaction
- `measureAsync(name, fn, options)`: Measure async function
- `measure(name, fn, options)`: Measure sync function
- `getStats()`: Get Sentry statistics
- `getPerformanceMetrics()`: Get performance metrics
- `close(timeout)`: Flush and close Sentry

#### Events

- `initialized`: Sentry initialized
- `error-captured`: Error captured
- `transaction-finished`: Transaction finished
- `closed`: Sentry closed

## Sensitive Data Filtering

Sentry automatically filters sensitive fields:

- `password`, `passwd`, `pwd`
- `secret`, `token`
- `api_key`, `apikey`, `api-key`
- `auth`, `authorization`
- `credential`, `credentials`
- `private_key`, `privatekey`
- `access_key`, `accesskey`
- `session`, `cookie`

Filtered values are replaced with `[FILTERED]`.

## Development vs Production

Sentry is automatically disabled when:
- `NODE_ENV=development`
- `SENTRY_ENABLED=false`

All methods become no-ops, so you can safely call them without checking.

## Best Practices

1. **Initialize Early**: Call `initialize()` at app startup
2. **Set User Context**: Always set user info for better debugging
3. **Use Tags**: Categorize errors with meaningful tags
4. **Add Context**: Include relevant data for debugging
5. **Sample Performance**: Use lower sample rates (0.1) for performance
6. **Graceful Shutdown**: Call `close()` before process exit
7. **Test Locally**: Use `SENTRY_DEBUG=true` to verify integration

## Example: Full Integration

```typescript
import { createSentryManagerFromEnv, createLogger } from './monitoring';

// Initialize Sentry
const sentry = createSentryManagerFromEnv();
sentry.initialize();

// Set global tags
sentry.setTags({
  app: 'aether',
  version: '1.0.0'
});

// Create logger with Sentry integration
const logger = createLogger('App');
logger.addHandler((entry) => {
  sentry.addBreadcrumb({
    level: entry.level,
    message: entry.message,
    category: 'log'
  });

  if (entry.level === 'error' && entry.context?.error) {
    sentry.captureException(entry.context.error);
  }
});

// Track performance
async function processRequest(req: Request) {
  return sentry.measureAsync(
    'process-request',
    async () => {
      // Set user context
      sentry.setUser({
        id: req.userId,
        ip_address: req.ip
      });

      // Add breadcrumb
      sentry.addBreadcrumb({
        type: 'http',
        category: 'request',
        message: `${req.method} ${req.url}`,
        data: { headers: req.headers }
      });

      // Your logic here
      const result = await handleRequest(req);

      return result;
    },
    { op: 'http.server', tags: { method: req.method } }
  );
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  await sentry.close(5000);
  process.exit(0);
});
```

## Troubleshooting

### Events Not Appearing in Sentry

1. Check `SENTRY_DSN` is correct
2. Verify `SENTRY_ENABLED=true`
3. Check `NODE_ENV` is not `development`
4. Enable debug mode: `SENTRY_DEBUG=true`
5. Check sample rates are not too low

### High Event Volume

1. Lower `SENTRY_SAMPLE_RATE` (e.g., 0.5)
2. Lower `SENTRY_TRACES_SAMPLE_RATE` (e.g., 0.01)
3. Use `beforeSend` to filter events
4. Add more specific error handling

### Performance Impact

1. Lower profiling sample rate
2. Reduce `maxBreadcrumbs`
3. Disable profiling: `SENTRY_ENABLE_PROFILING=false`

## Links

- [Sentry Documentation](https://docs.sentry.io/)
- [Node.js SDK](https://docs.sentry.io/platforms/node/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Profiling](https://docs.sentry.io/product/profiling/)
