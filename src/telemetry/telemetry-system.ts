/**
 * Telemetry System
 *
 * OpenTelemetry-based performance monitoring and tracing.
 * Tracks metrics, spans, and logs for system observability.
 *
 * @module telemetry/telemetry-system
 */

import { EventEmitter } from 'events';
import { app } from 'electron';

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
// TelemetrySystem Class
// ============================================================================

export class TelemetrySystem extends EventEmitter {
  private enabled: boolean;
  private spans = new Map<string, Span>();
  private metrics: Metric[] = [];
  private exportTimer: NodeJS.Timeout | null = null;

  constructor(private config: TelemetryConfig) {
    super();

    // Set defaults
    this.config.serviceVersion = config.serviceVersion || app.getVersion();
    this.config.enabled = config.enabled !== false;
    this.config.sampleRate = config.sampleRate ?? 1.0;
    this.config.exportInterval = config.exportInterval || 60000;
    this.enabled = this.config.enabled;
  }

  /**
   * Initialize telemetry
   */
  async initialize(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    // Start export timer
    this.startExportTimer();

    this.emit('ready');
  }

  /**
   * Start a new span
   */
  startSpan(name: string, attributes?: Record<string, any>): string {
    if (!this.enabled) {
      return '';
    }

    const spanId = this.generateId();
    const traceId = this.generateId();

    const span: Span = {
      id: spanId,
      traceId,
      name,
      startTime: Date.now(),
      attributes: {
        ...attributes,
        'service.name': this.config.serviceName,
        'service.version': this.config.serviceVersion,
      },
    };

    this.spans.set(spanId, span);
    this.emit('span:start', span);

    return spanId;
  }

  /**
   * End a span
   */
  endSpan(spanId: string, status?: 'ok' | 'error', error?: string): void {
    if (!this.enabled) {
      return;
    }

    const span = this.spans.get(spanId);
    if (!span) {
      return;
    }

    span.endTime = Date.now();
    span.status = status || 'ok';
    span.error = error;

    this.emit('span:end', span);
    this.spans.delete(spanId);
  }

  /**
   * Record a metric
   */
  recordMetric(
    name: string,
    value: number,
    type: MetricType = 'gauge',
    attributes?: Record<string, any>
  ): void {
    if (!this.enabled) {
      return;
    }

    const metric: Metric = {
      name,
      value,
      timestamp: Date.now(),
      attributes: {
        ...attributes,
        type,
        'service.name': this.config.serviceName,
      },
    };

    this.metrics.push(metric);
    this.emit('metric', metric);
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
   * Track function execution with span
   */
  async trace<T>(
    name: string,
    fn: () => Promise<T>,
    attributes?: Record<string, any>
  ): Promise<T> {
    const spanId = this.startSpan(name, attributes);

    try {
      const result = await fn();
      this.endSpan(spanId, 'ok');
      return result;
    } catch (error) {
      this.endSpan(spanId, 'error', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Export telemetry data
   */
  async export(): Promise<void> {
    if (this.metrics.length === 0 && this.spans.size === 0) {
      return;
    }

    const data = {
      service: {
        name: this.config.serviceName,
        version: this.config.serviceVersion,
      },
      metrics: [...this.metrics],
      spans: Array.from(this.spans.values()),
      timestamp: Date.now(),
    };

    this.metrics = [];

    try {
      if (this.config.endpoint) {
        await this.sendTelemetry(data);
      }
      this.emit('exported', data);
    } catch (error) {
      console.error('[TelemetrySystem] Failed to export telemetry:', error);
    }
  }

  /**
   * Send telemetry to endpoint
   */
  private async sendTelemetry(data: any): Promise<void> {
    const response = await fetch(this.config.endpoint!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Telemetry export failed: ${response.statusText}`);
    }
  }

  /**
   * Start export timer
   */
  private startExportTimer(): void {
    this.stopExportTimer();

    this.exportTimer = setInterval(() => {
      this.export();
    }, this.config.exportInterval);
  }

  /**
   * Stop export timer
   */
  private stopExportTimer(): void {
    if (this.exportTimer) {
      clearInterval(this.exportTimer);
      this.exportTimer = null;
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Enable telemetry
   */
  enable(): void {
    this.enabled = true;
    this.startExportTimer();
    this.emit('enabled');
  }

  /**
   * Disable telemetry
   */
  disable(): void {
    this.enabled = false;
    this.stopExportTimer();
    this.spans.clear();
    this.metrics = [];
    this.emit('disabled');
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
    this.stopExportTimer();
    await this.export();
    this.removeAllListeners();
  }
}

export function createTelemetrySystem(config: TelemetryConfig): TelemetrySystem {
  return new TelemetrySystem(config);
}

export default TelemetrySystem;
