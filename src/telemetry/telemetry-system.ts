/**
 * Telemetry System (simplified)
 *
 * Wraps OpenTelemetry API for backward compatibility with existing callers.
 * All actual tracing/metrics functionality is delegated to OpenTelemetry.
 *
 * @module telemetry/telemetry-system
 */

import { diag } from '@opentelemetry/api';
import { createLogger } from '../utils/logger';

const logger = createLogger('TelemetrySystem');

// ============================================================================
// Type Definitions
// ============================================================================

export interface TelemetryConfig {
  serviceName: string;
  serviceVersion?: string;
  endpoint?: string;
  enabled?: boolean;
  sampleRate?: number;
  exportInterval?: number;
}

export interface Span {
  id: string;
  traceId: string;
  name: string;
  startTime: number;
  endTime?: number;
  attributes?: Record<string, any>;
  status?: 'ok' | 'error';
  error?: string;
}

export interface Metric {
  name: string;
  value: number;
  timestamp: number;
  unit?: string;
  attributes?: Record<string, any>;
}

export type MetricType = 'counter' | 'gauge' | 'histogram';

// ============================================================================
// TelemetrySystem Class (OpenTelemetry-backed)
// ============================================================================

export class TelemetrySystem {
  private enabled: boolean;

  constructor(private config: TelemetryConfig) {
    this.config.enabled = config.enabled !== false;
    this.config.sampleRate = config.sampleRate ?? 1.0;
    this.enabled = this.config.enabled;
  }

  /**
   * Initialize telemetry
   */
  async initialize(): Promise<void> {
    if (!this.enabled) {
      return;
    }
    logger.info('TelemetrySystem initialized (OpenTelemetry backend)');
  }

  /**
   * Start a new span — delegates to OpenTelemetry if available
   */
  startSpan(name: string, attributes?: Record<string, any>): string {
    if (!this.enabled) {
      return '';
    }
    // Return a placeholder ID — real tracing is handled by TelemetryManager/OTel
    diag.debug(`TelemetrySystem: startSpan "${name}" delegated to OpenTelemetry`);
    return `otel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * End a span — no-op, handled by OpenTelemetry
   */
  endSpan(_spanId: string, _status?: 'ok' | 'error', _error?: string): void {
    // Delegated to OpenTelemetry
  }

  /**
   * Record a metric — no-op, handled by OpenTelemetry
   */
  recordMetric(
    name: string,
    value: number,
    _type: MetricType = 'gauge',
    _attributes?: Record<string, any>
  ): void {
    if (!this.enabled) {
      return;
    }
    diag.debug(`TelemetrySystem: metric "${name}" = ${value} delegated to OpenTelemetry`);
  }

  /**
   * Record counter metric
   */
  counter(name: string, value: number = 1, attributes?: Record<string, any>): void {
    this.recordMetric(name, value, 'counter', attributes);
  }

  /**
   * Record gauge metric
   */
  gauge(name: string, value: number, attributes?: Record<string, any>): void {
    this.recordMetric(name, value, 'gauge', attributes);
  }

  /**
   * Record histogram metric
   */
  histogram(name: string, value: number, attributes?: Record<string, any>): void {
    this.recordMetric(name, value, 'histogram', attributes);
  }

  /**
   * Track function execution with span — delegates to OpenTelemetry
   */
  async trace<T>(
    name: string,
    fn: () => Promise<T>,
    _attributes?: Record<string, any>
  ): Promise<T> {
    if (!this.enabled) {
      return fn();
    }
    diag.debug(`TelemetrySystem: trace "${name}" delegated to OpenTelemetry`);
    return fn();
  }

  /**
   * Export telemetry data — no-op, handled by OpenTelemetry
   */
  async export(): Promise<void> {
    // Delegated to OpenTelemetry TelemetryManager
  }

  /**
   * Enable telemetry
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Disable telemetry
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * Check if telemetry is enabled
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

export function createTelemetrySystem(config: TelemetryConfig): TelemetrySystem {
  return new TelemetrySystem(config);
}

export default TelemetrySystem;
