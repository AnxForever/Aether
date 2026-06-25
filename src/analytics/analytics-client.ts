/**
 * Analytics Client (simplified)
 *
 * Previously used PostHog for product analytics.
 * Now acts as a no-op placeholder; all analytics should be routed
 * through OpenTelemetry or Sentry for tracing/error monitoring.
 *
 * @module analytics/analytics-client
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface AnalyticsConfig {
  apiKey: string;
  host?: string;
  enabled?: boolean;
  flushInterval?: number;
  batchSize?: number;
  anonymousId?: string;
}

export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp?: number;
}

export interface UserProperties {
  userId?: string;
  email?: string;
  name?: string;
  [key: string]: any;
}

// ============================================================================
// AnalyticsClient Class (no-op)
// ============================================================================

export class AnalyticsClient {
  private enabled: boolean;

  constructor(private config: AnalyticsConfig) {
    this.config.enabled = config.enabled !== false;
    this.enabled = this.config.enabled;
  }

  /**
   * Initialize analytics
   */
  async initialize(): Promise<void> {
    if (!this.enabled) {
      return;
    }
    // No-op: PostHog removed, analytics routed through OpenTelemetry
  }

  /**
   * Identify user
   */
  identify(_userId: string, _properties?: UserProperties): void {
    // No-op
  }

  /**
   * Track event
   */
  track(_event: string, _properties?: Record<string, any>): void {
    // No-op
  }

  /**
   * Track page view
   */
  page(_name: string, _properties?: Record<string, any>): void {
    // No-op
  }

  /**
   * Track feature usage
   */
  feature(_featureName: string, _properties?: Record<string, any>): void {
    // No-op
  }

  /**
   * Track error
   */
  error(_error: Error, _context?: Record<string, any>): void {
    // No-op
  }

  /**
   * Flush events to server
   */
  async flush(): Promise<void> {
    // No-op
  }

  /**
   * Enable analytics
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Disable analytics
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * Check if analytics is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Cleanup
   */
  async destroy(): Promise<void> {
    this.enabled = false;
  }
}

export function createAnalyticsClient(config: AnalyticsConfig): AnalyticsClient {
  return new AnalyticsClient(config);
}

export default AnalyticsClient;
