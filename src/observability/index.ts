/**
 * OpenTelemetry Observability Module
 *
 * Provides distributed tracing, metrics, and logging integration
 * using OpenTelemetry standard.
 */

export * from './types';
export * from './telemetry-manager';
export { Tracer, createTracer } from './tracer';
export { Metrics, createMetrics } from './metrics';
export * from './exporters';

// Re-export commonly used OpenTelemetry types
export type { Span, Meter, Counter, Histogram } from '@opentelemetry/api';
