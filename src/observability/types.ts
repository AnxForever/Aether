/**
 * OpenTelemetry Types and Interfaces
 */

import type { Span, Tracer, Meter, Counter, Histogram, UpDownCounter } from '@opentelemetry/api';
import type { NodeSDK } from '@opentelemetry/sdk-node';

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;

  // Trace configuration
  tracing?: {
    enabled: boolean;
    endpoint?: string;
    sampleRate?: number;
  };

  // Metrics configuration
  metrics?: {
    enabled: boolean;
    endpoint?: string;
    interval?: number; // Collection interval in ms
  };

  // Exporter configuration
  exporter?: {
    type: 'otlp' | 'jaeger' | 'zipkin' | 'console';
    protocol?: 'http' | 'grpc';
    headers?: Record<string, string>;
  };

  // Auto-instrumentation
  autoInstrumentation?: {
    http?: boolean;
    grpc?: boolean;
    database?: boolean;
    fs?: boolean;
  };
}

/**
 * Span options
 */
export interface SpanOptions {
  attributes?: Record<string, string | number | boolean>;
  kind?: 'internal' | 'server' | 'client' | 'producer' | 'consumer';
  links?: Array<{ context: any; attributes?: Record<string, any> }>;
}

/**
 * Metric options
 */
export interface MetricOptions {
  description?: string;
  unit?: string;
  valueType?: 'int' | 'double';
}

/**
 * Trace context
 */
export interface TraceContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
}

/**
 * Telemetry events
 */
export interface TelemetryEvents {
  'telemetry:started': void;
  'telemetry:stopped': void;
  'telemetry:error': Error;
  'span:created': { name: string; span: Span };
  'span:ended': { name: string; duration: number };
  'metric:recorded': { name: string; value: number };
}

/**
 * Export types
 */
export type { Span, Tracer, Meter, Counter, Histogram, UpDownCounter, NodeSDK };
