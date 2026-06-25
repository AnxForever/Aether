/**
 * OpenTelemetry Metrics - Application metrics
 */

import { metrics, type Meter, type Counter, type Histogram, type UpDownCounter } from '@opentelemetry/api';
import type { MetricOptions } from './types';

/**
 * Metrics manager for collecting application metrics
 */
export class Metrics {
  private meter: Meter;
  private serviceName: string;

  // Cached instruments
  private counters = new Map<string, Counter>();
  private histograms = new Map<string, Histogram>();
  private upDownCounters = new Map<string, UpDownCounter>();

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.meter = metrics.getMeter(serviceName);
  }

  /**
   * Create or get counter
   */
  createCounter(name: string, options?: MetricOptions): Counter {
    if (this.counters.has(name)) {
      return this.counters.get(name)!;
    }

    const counter = this.meter.createCounter(name, {
      description: options?.description,
      unit: options?.unit,
      valueType: options?.valueType === 'double' ? 1 : 0, // 0 = INT, 1 = DOUBLE
    });

    this.counters.set(name, counter);
    return counter;
  }

  /**
   * Increment counter
   */
  incrementCounter(
    name: string,
    value: number = 1,
    attributes?: Record<string, string | number | boolean>
  ): void {
    const counter = this.createCounter(name);
    counter.add(value, attributes);
  }

  /**
   * Create or get histogram
   */
  createHistogram(name: string, options?: MetricOptions): Histogram {
    if (this.histograms.has(name)) {
      return this.histograms.get(name)!;
    }

    const histogram = this.meter.createHistogram(name, {
      description: options?.description,
      unit: options?.unit,
      valueType: options?.valueType === 'double' ? 1 : 0,
    });

    this.histograms.set(name, histogram);
    return histogram;
  }

  /**
   * Record histogram value
   */
  recordHistogram(
    name: string,
    value: number,
    attributes?: Record<string, string | number | boolean>
  ): void {
    const histogram = this.createHistogram(name);
    histogram.record(value, attributes);
  }

  /**
   * Create or get up-down counter (gauge-like)
   */
  createUpDownCounter(name: string, options?: MetricOptions): UpDownCounter {
    if (this.upDownCounters.has(name)) {
      return this.upDownCounters.get(name)!;
    }

    const upDownCounter = this.meter.createUpDownCounter(name, {
      description: options?.description,
      unit: options?.unit,
      valueType: options?.valueType === 'double' ? 1 : 0,
    });

    this.upDownCounters.set(name, upDownCounter);
    return upDownCounter;
  }

  /**
   * Update up-down counter
   */
  updateUpDownCounter(
    name: string,
    value: number,
    attributes?: Record<string, string | number | boolean>
  ): void {
    const upDownCounter = this.createUpDownCounter(name);
    upDownCounter.add(value, attributes);
  }

  /**
   * Record duration in milliseconds
   */
  recordDuration(
    name: string,
    durationMs: number,
    attributes?: Record<string, string | number | boolean>
  ): void {
    const histogram = this.createHistogram(name, {
      description: `Duration of ${name}`,
      unit: 'ms',
    });
    histogram.record(durationMs, attributes);
  }

  /**
   * Track operation duration with automatic recording
   */
  async trackDuration<T>(
    name: string,
    operation: () => Promise<T>,
    attributes?: Record<string, string | number | boolean>
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      this.recordDuration(name, duration, { ...attributes, status: 'success' });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordDuration(name, duration, { ...attributes, status: 'error' });
      throw error;
    }
  }

  /**
   * Track operation duration (sync version)
   */
  trackDurationSync<T>(
    name: string,
    operation: () => T,
    attributes?: Record<string, string | number | boolean>
  ): T {
    const startTime = Date.now();

    try {
      const result = operation();
      const duration = Date.now() - startTime;
      this.recordDuration(name, duration, { ...attributes, status: 'success' });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordDuration(name, duration, { ...attributes, status: 'error' });
      throw error;
    }
  }

  /**
   * Create observable gauge (callback-based)
   */
  createObservableGauge(
    name: string,
    callback: () => number,
    options?: MetricOptions
  ): void {
    this.meter.createObservableGauge(name, {
      description: options?.description,
      unit: options?.unit,
      valueType: options?.valueType === 'double' ? 1 : 0,
    });

    // Note: The callback is now registered separately in newer OTEL versions
    // This is a placeholder for the observable pattern
  }

  /**
   * Create observable counter (callback-based)
   */
  createObservableCounter(
    name: string,
    callback: () => number,
    options?: MetricOptions
  ): void {
    this.meter.createObservableCounter(name, {
      description: options?.description,
      unit: options?.unit,
      valueType: options?.valueType === 'double' ? 1 : 0,
    });

    // Note: The callback is now registered separately in newer OTEL versions
    // This is a placeholder for the observable pattern
  }

  /**
   * Clear all cached instruments
   */
  clear(): void {
    this.counters.clear();
    this.histograms.clear();
    this.upDownCounters.clear();
  }
}

/**
 * Create metrics instance
 */
export function createMetrics(serviceName: string): Metrics {
  return new Metrics(serviceName);
}
