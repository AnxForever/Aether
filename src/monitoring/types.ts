/**
 * Sentry Monitoring Types
 */

import type * as Sentry from '@sentry/node';

/**
 * Sentry configuration
 */
export interface SentryConfig {
  /**
   * Sentry DSN (Data Source Name)
   */
  dsn: string;

  /**
   * Environment (production, staging, development)
   */
  environment: string;

  /**
   * Release version
   */
  release?: string;

  /**
   * Sample rate for error events (0.0 to 1.0)
   */
  sampleRate?: number;

  /**
   * Sample rate for performance traces (0.0 to 1.0)
   */
  tracesSampleRate?: number;

  /**
   * Sample rate for profiling (0.0 to 1.0)
   */
  profilesSampleRate?: number;

  /**
   * Enable debug mode
   */
  debug?: boolean;

  /**
   * Enable performance profiling
   */
  enableProfiling?: boolean;

  /**
   * Server name / instance identifier
   */
  serverName?: string;

  /**
   * Attach stack traces to messages
   */
  attachStacktrace?: boolean;

  /**
   * Maximum breadcrumbs (default: 100)
   */
  maxBreadcrumbs?: number;

  /**
   * Before send hook - filter/modify events before sending
   */
  beforeSend?: (event: Sentry.Event, hint: Sentry.EventHint) => Sentry.Event | null | PromiseLike<Sentry.Event | null>;

  /**
   * Before breadcrumb hook - filter/modify breadcrumbs
   */
  beforeBreadcrumb?: (breadcrumb: Sentry.Breadcrumb, hint?: Sentry.BreadcrumbHint) => Sentry.Breadcrumb | null;
}

/**
 * User context for error tracking
 */
export interface UserContext {
  /**
   * User ID
   */
  id: string;

  /**
   * User email
   */
  email?: string;

  /**
   * Username
   */
  username?: string;

  /**
   * IP address
   */
  ip_address?: string;

  /**
   * Additional user data
   */
  [key: string]: any;
}

/**
 * Custom tags for categorizing events
 */
export interface EventTags {
  [key: string]: string | number | boolean;
}

/**
 * Additional context data
 */
export interface EventContext {
  [key: string]: any;
}

/**
 * Performance span options
 */
export interface SpanOptions {
  /**
   * Operation name
   */
  op: string;

  /**
   * Description
   */
  description?: string;

  /**
   * Tags
   */
  tags?: EventTags;

  /**
   * Additional data
   */
  data?: Record<string, any>;
}

/**
 * Transaction options
 */
export interface TransactionOptions {
  /**
   * Transaction name
   */
  name: string;

  /**
   * Operation type
   */
  op: string;

  /**
   * Tags
   */
  tags?: EventTags;

  /**
   * Additional data
   */
  data?: Record<string, any>;
}

/**
 * Breadcrumb types
 */
export type BreadcrumbType =
  | 'default'
  | 'debug'
  | 'error'
  | 'navigation'
  | 'http'
  | 'info'
  | 'query'
  | 'transaction'
  | 'ui'
  | 'user';

/**
 * Breadcrumb level
 */
export type BreadcrumbLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

/**
 * Custom breadcrumb
 */
export interface CustomBreadcrumb {
  /**
   * Type
   */
  type?: BreadcrumbType;

  /**
   * Level
   */
  level?: BreadcrumbLevel;

  /**
   * Message
   */
  message: string;

  /**
   * Category
   */
  category?: string;

  /**
   * Additional data
   */
  data?: Record<string, any>;

  /**
   * Timestamp
   */
  timestamp?: number;
}

/**
 * Error severity level
 */
export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

/**
 * Sentry event statistics
 */
export interface SentryStats {
  /**
   * Total events sent
   */
  totalEvents: number;

  /**
   * Total errors
   */
  totalErrors: number;

  /**
   * Total transactions
   */
  totalTransactions: number;

  /**
   * Events dropped (sampling)
   */
  eventsDropped: number;

  /**
   * Last event timestamp
   */
  lastEventTime?: number;
}
