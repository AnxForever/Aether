/**
 * Sentry Manager - Main entry point for Sentry integration
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { EventEmitter } from 'eventemitter3';
import { ErrorHandler } from './error-handler';
import { PerformanceTracker } from './performance-tracker';
import { createLogger } from '../utils/logger';
import type {
  SentryConfig,
  UserContext,
  EventTags,
  EventContext,
  CustomBreadcrumb,
  SentryStats
} from './types';

const logger = createLogger('SentryManager');

/**
 * Default Sentry configuration
 */
const DEFAULT_CONFIG: Partial<SentryConfig> = {
  sampleRate: 1.0,
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
  debug: false,
  enableProfiling: true,
  attachStacktrace: true,
  maxBreadcrumbs: 100
};

/**
 * Sensitive field patterns to filter
 */
const SENSITIVE_PATTERNS = [
  /password/i,
  /passwd/i,
  /pwd/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /auth/i,
  /credential/i,
  /private[_-]?key/i,
  /access[_-]?key/i,
  /session/i,
  /cookie/i
];

/**
 * Sentry Manager
 * Central manager for Sentry error tracking and performance monitoring
 */
export class SentryManager extends EventEmitter {
  private config: SentryConfig;
  private isInitialized = false;
  private errorHandler: ErrorHandler;
  private performanceTracker: PerformanceTracker;
  private stats: SentryStats = {
    totalEvents: 0,
    totalErrors: 0,
    totalTransactions: 0,
    eventsDropped: 0
  };

  constructor(config: SentryConfig) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.errorHandler = new ErrorHandler({
      captureUnhandledRejections: true,
      captureUncaughtExceptions: true,
      exitOnUncaughtException: false
    });
    this.performanceTracker = new PerformanceTracker();

    // Listen to error handler events
    this.errorHandler.on('error-captured', (event: any) => {
      this.stats.totalErrors++;
      this.stats.totalEvents++;
      this.stats.lastEventTime = Date.now();
      this.emit('error-captured', event);
    });

    // Listen to performance tracker events
    this.performanceTracker.on('transaction-finished', (event: any) => {
      this.stats.totalTransactions++;
      this.stats.totalEvents++;
      this.stats.lastEventTime = Date.now();
      this.emit('transaction-finished', event);
    });
  }

  /**
   * Initialize Sentry
   */
  initialize(): void {
    if (this.isInitialized) {
      logger.warn('Sentry already initialized');
      return;
    }

    // Check if disabled by environment
    if (process.env.NODE_ENV === 'development' || process.env.SENTRY_ENABLED === 'false') {
      logger.info('Sentry disabled in development environment');
      this.isInitialized = false;
      return;
    }

    if (!this.config.dsn) {
      logger.warn('Sentry DSN not configured, skipping initialization');
      this.isInitialized = false;
      return;
    }

    try {
      // Initialize Sentry
      Sentry.init({
        dsn: this.config.dsn,
        environment: this.config.environment,
        release: this.config.release,
        sampleRate: this.config.sampleRate,
        tracesSampleRate: this.config.tracesSampleRate,
        profilesSampleRate: this.config.profilesSampleRate,
        debug: this.config.debug,
        serverName: this.config.serverName,
        attachStacktrace: this.config.attachStacktrace,
        maxBreadcrumbs: this.config.maxBreadcrumbs,

        // Integrations
        integrations: [
          // Node integrations (included by default)
          ...(this.config.enableProfiling ? [nodeProfilingIntegration()] : [])
        ],

        // Before send hook - filter sensitive data
        beforeSend: (event, hint) => {
          // Apply custom beforeSend if provided
          if (this.config.beforeSend) {
            const result = this.config.beforeSend(event, hint);
            if (!result) return null;
            event = result as Sentry.Event;
          }

          // Filter sensitive data
          event = this.filterSensitiveData(event) as Sentry.Event;

          return event;
        },

        // Before breadcrumb hook
        beforeBreadcrumb: (breadcrumb, hint) => {
          // Apply custom beforeBreadcrumb if provided
          if (this.config.beforeBreadcrumb) {
            return this.config.beforeBreadcrumb(breadcrumb, hint);
          }

          return breadcrumb;
        }
      });

      this.isInitialized = true;

      // Enable error handlers
      this.errorHandler.enable();

      logger.info('Sentry initialized', {
        environment: this.config.environment,
        release: this.config.release
      });

      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize Sentry', error as Error);
      this.isInitialized = false;
    }
  }

  /**
   * Check if Sentry is initialized and enabled
   */
  get enabled(): boolean {
    return this.isInitialized;
  }

  /**
   * Set user context
   */
  setUser(user: UserContext | null): void {
    if (!this.isInitialized) return;

    Sentry.setUser(user);
    logger.debug('User context set', { userId: user?.id });
  }

  /**
   * Set tag
   */
  setTag(key: string, value: string | number | boolean): void {
    if (!this.isInitialized) return;

    Sentry.setTag(key, value);
  }

  /**
   * Set tags
   */
  setTags(tags: EventTags): void {
    if (!this.isInitialized) return;

    Sentry.setTags(tags);
  }

  /**
   * Set context
   */
  setContext(name: string, context: EventContext): void {
    if (!this.isInitialized) return;

    Sentry.setContext(name, context);
  }

  /**
   * Add breadcrumb
   */
  addBreadcrumb(breadcrumb: CustomBreadcrumb): void {
    if (!this.isInitialized) return;

    Sentry.addBreadcrumb({
      type: breadcrumb.type,
      level: breadcrumb.level,
      message: breadcrumb.message,
      category: breadcrumb.category,
      data: breadcrumb.data,
      timestamp: breadcrumb.timestamp
    });
  }

  /**
   * Capture exception
   */
  captureException(
    error: Error,
    options: {
      tags?: EventTags;
      context?: EventContext;
      user?: UserContext;
      severity?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
    } = {}
  ): string {
    if (!this.isInitialized) {
      logger.error('Sentry not initialized, logging error locally', error);
      return '';
    }

    return this.errorHandler.captureError(error, {
      severity: options.severity || 'error',
      tags: options.tags,
      context: options.context,
      user: options.user
    });
  }

  /**
   * Capture message
   */
  captureMessage(
    message: string,
    options: {
      tags?: EventTags;
      context?: EventContext;
      user?: UserContext;
      severity?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
    } = {}
  ): string {
    if (!this.isInitialized) {
      logger.info('Sentry not initialized, logging message locally', { message });
      return '';
    }

    return this.errorHandler.captureMessage(message, {
      severity: options.severity || 'info',
      tags: options.tags,
      context: options.context,
      user: options.user
    });
  }

  /**
   * Start transaction
   */
  startTransaction(name: string, op: string, options: { tags?: EventTags; data?: Record<string, any> } = {}): string {
    if (!this.isInitialized) return '';

    return this.performanceTracker.startTransaction({
      name,
      op,
      tags: options.tags,
      data: options.data
    });
  }

  /**
   * Finish transaction
   */
  finishTransaction(transactionId: string, tags?: EventTags): void {
    if (!this.isInitialized) return;

    this.performanceTracker.finishTransaction(transactionId, tags);
  }

  /**
   * Start span
   */
  startSpan(
    transactionId: string,
    op: string,
    options: { description?: string; tags?: EventTags; data?: Record<string, any> } = {}
  ): string | null {
    if (!this.isInitialized) return null;

    return this.performanceTracker.startSpan(transactionId, {
      op,
      description: options.description,
      tags: options.tags,
      data: options.data
    });
  }

  /**
   * Finish span
   */
  finishSpan(spanId: string, tags?: EventTags): void {
    if (!this.isInitialized) return;

    this.performanceTracker.finishSpan(spanId, tags);
  }

  /**
   * Measure async function
   */
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    options: { op?: string; tags?: EventTags } = {}
  ): Promise<T> {
    if (!this.isInitialized) {
      return fn();
    }

    return this.performanceTracker.measureAsync(name, fn, options);
  }

  /**
   * Measure sync function
   */
  measure<T>(name: string, fn: () => T, options: { op?: string; tags?: EventTags } = {}): T {
    if (!this.isInitialized) {
      return fn();
    }

    return this.performanceTracker.measure(name, fn, options);
  }

  /**
   * Get statistics
   */
  getStats(): SentryStats {
    return { ...this.stats };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return this.performanceTracker.getMetrics();
  }

  /**
   * Filter sensitive data from event
   */
  private filterSensitiveData(event: Sentry.Event): Sentry.Event {
    // Filter request data
    if (event.request) {
      event.request = this.filterObject(event.request);
    }

    // Filter extra data
    if (event.extra) {
      event.extra = this.filterObject(event.extra);
    }

    // Filter contexts
    if (event.contexts) {
      event.contexts = this.filterObject(event.contexts);
    }

    // Filter breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
        ...breadcrumb,
        data: breadcrumb.data ? this.filterObject(breadcrumb.data) : undefined
      }));
    }

    return event;
  }

  /**
   * Filter object for sensitive data
   */
  private filterObject(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.filterObject(item));
    }

    const filtered: any = {};

    for (const [key, value] of Object.entries(obj)) {
      // Check if key matches sensitive pattern
      const isSensitive = SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));

      if (isSensitive) {
        filtered[key] = '[FILTERED]';
      } else if (typeof value === 'object' && value !== null) {
        filtered[key] = this.filterObject(value);
      } else {
        filtered[key] = value;
      }
    }

    return filtered;
  }

  /**
   * Flush events and close Sentry
   */
  async close(timeout = 2000): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    logger.info('Closing Sentry...');

    // Disable error handlers
    this.errorHandler.disable();

    // Cleanup performance tracker
    this.performanceTracker.cleanup();

    // Flush pending events
    try {
      await Sentry.close(timeout);
      logger.info('Sentry closed');
    } catch (error) {
      logger.error('Error closing Sentry', error as Error);
    }

    this.isInitialized = false;
    this.emit('closed');
  }
}

/**
 * Create Sentry manager from environment variables
 */
export function createSentryManagerFromEnv(): SentryManager {
  const config: SentryConfig = {
    dsn: process.env.SENTRY_DSN || '',
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'production',
    release: process.env.SENTRY_RELEASE || process.env.npm_package_version,
    sampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || '1.0'),
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
    debug: process.env.SENTRY_DEBUG === 'true',
    enableProfiling: process.env.SENTRY_ENABLE_PROFILING !== 'false',
    serverName: process.env.SENTRY_SERVER_NAME || require('os').hostname()
  };

  return new SentryManager(config);
}
