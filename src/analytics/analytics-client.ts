/**
 * Analytics Client
 *
 * PostHog analytics integration for user behavior tracking,
 * feature usage, and performance monitoring.
 *
 * @module analytics/analytics-client
 */

import { EventEmitter } from 'events';
import { app } from 'electron';
import { createLogger } from '../utils/logger';

const logger = createLogger('Analytics');

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
// AnalyticsClient Class
// ============================================================================

export class AnalyticsClient extends EventEmitter {
  private enabled: boolean;
  private userId: string | null = null;
  private eventQueue: AnalyticsEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(private config: AnalyticsConfig) {
    super();

    // Set defaults
    this.config.host = config.host || 'https://app.posthog.com';
    this.config.enabled = config.enabled !== false;
    this.config.flushInterval = config.flushInterval || 30000;
    this.config.batchSize = config.batchSize || 10;
    this.enabled = this.config.enabled;
  }

  /**
   * Initialize analytics
   */
  async initialize(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    // Start flush timer
    this.startFlushTimer();

    // Track app launch
    this.track('app_launched', {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
    });

    this.emit('ready');
  }

  /**
   * Identify user
   */
  identify(userId: string, properties?: UserProperties): void {
    if (!this.enabled) {
      return;
    }

    this.userId = userId;

    this.track('$identify', {
      distinct_id: userId,
      $set: properties,
    });

    this.emit('identified', userId);
  }

  /**
   * Track event
   */
  track(event: string, properties?: Record<string, any>): void {
    if (!this.enabled) {
      return;
    }

    const analyticsEvent: AnalyticsEvent = {
      event,
      properties: {
        ...properties,
        distinct_id: this.userId || this.config.anonymousId,
        $lib: 'nexus-agent',
        $lib_version: app.getVersion(),
      },
      timestamp: Date.now(),
    };

    this.eventQueue.push(analyticsEvent);

    // Flush if batch size reached
    if (this.eventQueue.length >= this.config.batchSize!) {
      this.flush();
    }

    this.emit('event', analyticsEvent);
  }

  /**
   * Track page view
   */
  page(name: string, properties?: Record<string, any>): void {
    this.track('$pageview', {
      $current_url: name,
      ...properties,
    });
  }

  /**
   * Track feature usage
   */
  feature(featureName: string, properties?: Record<string, any>): void {
    this.track('feature_used', {
      feature: featureName,
      ...properties,
    });
  }

  /**
   * Track error
   */
  error(error: Error, context?: Record<string, any>): void {
    this.track('error', {
      error_message: error.message,
      error_stack: error.stack,
      ...context,
    });
  }

  /**
   * Flush events to server
   */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await this.sendEvents(events);
      this.emit('flushed', events.length);
    } catch (error) {
      logger.error('Failed to flush events', error instanceof Error ? error : new Error(String(error)));
      // Re-queue events
      this.eventQueue.unshift(...events);
    }
  }

  /**
   * Send events to PostHog
   */
  private async sendEvents(events: AnalyticsEvent[]): Promise<void> {
    const response = await fetch(`${this.config.host}/batch/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        api_key: this.config.apiKey,
        batch: events.map((e) => ({
          event: e.event,
          properties: e.properties,
          timestamp: e.timestamp,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Analytics request failed: ${response.statusText}`);
    }
  }

  /**
   * Enable analytics
   */
  enable(): void {
    this.enabled = true;
    this.startFlushTimer();
    this.emit('enabled');
  }

  /**
   * Disable analytics
   */
  disable(): void {
    this.enabled = false;
    this.stopFlushTimer();
    this.eventQueue = [];
    this.emit('disabled');
  }

  /**
   * Check if analytics is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.stopFlushTimer();

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  /**
   * Stop flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Cleanup
   */
  async destroy(): Promise<void> {
    this.stopFlushTimer();
    await this.flush();
    this.removeAllListeners();
  }
}

export function createAnalyticsClient(config: AnalyticsConfig): AnalyticsClient {
  return new AnalyticsClient(config);
}

export default AnalyticsClient;
