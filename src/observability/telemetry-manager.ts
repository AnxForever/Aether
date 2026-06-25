/**
 * OpenTelemetry Telemetry Manager - Main entry point
 */

import { EventEmitter } from 'eventemitter3';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes, defaultResource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

import type { TelemetryConfig, TelemetryEvents } from './types';
import { createTraceExporter, createMetricExporter } from './exporters';
import { Tracer, createTracer } from './tracer';
import { Metrics, createMetrics } from './metrics';

/**
 * Telemetry Manager - Centralized OpenTelemetry management
 */
export class TelemetryManager extends EventEmitter<TelemetryEvents> {
  private config: TelemetryConfig;
  private sdk: NodeSDK | null = null;
  private tracer: Tracer;
  private metrics: Metrics;
  private isInitialized = false;

  constructor(config: TelemetryConfig) {
    super();
    this.config = this.mergeWithDefaults(config);
    this.tracer = createTracer(this.config.serviceName);
    this.metrics = createMetrics(this.config.serviceName);
  }

  /**
   * Initialize OpenTelemetry SDK
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('[TelemetryManager] Already initialized');
      return;
    }

    try {
      // Enable debug logging if in development
      if (process.env.NODE_ENV === 'development' || process.env.OTEL_LOG_LEVEL === 'debug') {
        diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
      }

      // Create resource
      const resource = defaultResource().merge(
        resourceFromAttributes({
          [ATTR_SERVICE_NAME]: this.config.serviceName,
          [ATTR_SERVICE_VERSION]: this.config.serviceVersion || '1.0.0',
          'deployment.environment': this.config.environment || process.env.NODE_ENV || 'development',
        })
      );

      // Create trace exporter
      const traceExporter = createTraceExporter(this.config);

      // Create metric exporter with periodic reader
      const metricExporter = createMetricExporter(this.config);
      const metricReader = metricExporter
        ? new PeriodicExportingMetricReader({
            exporter: metricExporter,
            exportIntervalMillis: this.config.metrics?.interval || 60000, // Default 60s
          })
        : undefined;

      // Create auto-instrumentations
      const instrumentations = this.createInstrumentations();

      // Initialize SDK
      this.sdk = new NodeSDK({
        resource,
        traceExporter,
        metricReader,
        instrumentations,
      });

      await this.sdk.start();

      this.isInitialized = true;
      this.emit('telemetry:started');

      console.log(`[TelemetryManager] Initialized for service: ${this.config.serviceName}`);
    } catch (error) {
      this.emit('telemetry:error', error as Error);
      console.error('[TelemetryManager] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Shutdown telemetry gracefully
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized || !this.sdk) {
      return;
    }

    try {
      console.log('[TelemetryManager] Shutting down...');
      await this.sdk.shutdown();
      this.isInitialized = false;
      this.emit('telemetry:stopped');
      console.log('[TelemetryManager] Shutdown complete');
    } catch (error) {
      this.emit('telemetry:error', error as Error);
      console.error('[TelemetryManager] Shutdown failed:', error);
      throw error;
    }
  }

  /**
   * Get tracer instance
   */
  getTracer(): Tracer {
    return this.tracer;
  }

  /**
   * Get metrics instance
   */
  getMetrics(): Metrics {
    return this.metrics;
  }

  /**
   * Check if telemetry is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<TelemetryConfig> {
    return Object.freeze({ ...this.config });
  }

  /**
   * Create auto-instrumentations based on config
   */
  private createInstrumentations() {
    const autoInstrumentConfig = this.config.autoInstrumentation || {};

    // Default: enable all instrumentations
    const enabledInstrumentations = {
      '@opentelemetry/instrumentation-http': autoInstrumentConfig.http !== false,
      '@opentelemetry/instrumentation-grpc': autoInstrumentConfig.grpc !== false,
      '@opentelemetry/instrumentation-fs': autoInstrumentConfig.fs !== false,
      '@opentelemetry/instrumentation-dns': true,
      '@opentelemetry/instrumentation-net': true,
    };

    return getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        enabled: enabledInstrumentations['@opentelemetry/instrumentation-http'],
      },
      '@opentelemetry/instrumentation-grpc': {
        enabled: enabledInstrumentations['@opentelemetry/instrumentation-grpc'],
      },
      '@opentelemetry/instrumentation-fs': {
        enabled: enabledInstrumentations['@opentelemetry/instrumentation-fs'],
      },
    });
  }

  /**
   * Merge user config with defaults
   */
  private mergeWithDefaults(config: TelemetryConfig): TelemetryConfig {
    return {
      serviceName: config.serviceName,
      serviceVersion: config.serviceVersion || '1.0.0',
      environment: config.environment || process.env.NODE_ENV || 'development',

      tracing: {
        enabled: config.tracing?.enabled ?? true,
        endpoint: config.tracing?.endpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
        sampleRate: config.tracing?.sampleRate ?? 1.0,
      },

      metrics: {
        enabled: config.metrics?.enabled ?? true,
        endpoint: config.metrics?.endpoint || process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
        interval: config.metrics?.interval || 60000,
      },

      exporter: {
        type: config.exporter?.type || 'otlp',
        protocol: config.exporter?.protocol || 'http',
        headers: config.exporter?.headers || {},
      },

      autoInstrumentation: {
        http: config.autoInstrumentation?.http ?? true,
        grpc: config.autoInstrumentation?.grpc ?? true,
        database: config.autoInstrumentation?.database ?? true,
        fs: config.autoInstrumentation?.fs ?? true,
      },
    };
  }
}

/**
 * Create TelemetryManager instance
 */
export function createTelemetryManager(config: TelemetryConfig): TelemetryManager {
  return new TelemetryManager(config);
}

/**
 * Global telemetry instance (singleton pattern)
 */
let globalTelemetry: TelemetryManager | null = null;

/**
 * Initialize global telemetry
 */
export async function initGlobalTelemetry(config: TelemetryConfig): Promise<TelemetryManager> {
  if (globalTelemetry) {
    console.warn('[TelemetryManager] Global telemetry already initialized');
    return globalTelemetry;
  }

  globalTelemetry = new TelemetryManager(config);
  await globalTelemetry.initialize();
  return globalTelemetry;
}

/**
 * Get global telemetry instance
 */
export function getGlobalTelemetry(): TelemetryManager | null {
  return globalTelemetry;
}

/**
 * Shutdown global telemetry
 */
export async function shutdownGlobalTelemetry(): Promise<void> {
  if (globalTelemetry) {
    await globalTelemetry.shutdown();
    globalTelemetry = null;
  }
}
