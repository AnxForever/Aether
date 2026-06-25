/**
 * OpenTelemetry Tracer - Distributed tracing
 */

import { trace, context, SpanStatusCode, type Span, type Tracer as OtelTracer } from '@opentelemetry/api';
import type { SpanOptions, TraceContext } from './types';

/**
 * Tracer wrapper for easy span management
 */
export class Tracer {
  private tracer: OtelTracer;
  private serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.tracer = trace.getTracer(serviceName);
  }

  /**
   * Start a new span
   */
  startSpan(name: string, options?: SpanOptions): Span {
    const span = this.tracer.startSpan(name, {
      attributes: options?.attributes,
      kind: this.mapSpanKind(options?.kind),
      links: options?.links,
    });

    return span;
  }

  /**
   * Start active span with automatic context propagation
   */
  startActiveSpan<T>(
    name: string,
    fn: (span: Span) => T,
    options?: SpanOptions
  ): T {
    return this.tracer.startActiveSpan(
      name,
      {
        attributes: options?.attributes,
        kind: this.mapSpanKind(options?.kind),
        links: options?.links,
      },
      (span) => {
        try {
          const result = fn(span);

          // Handle async functions
          if (result instanceof Promise) {
            return result
              .then((value) => {
                span.setStatus({ code: SpanStatusCode.OK });
                span.end();
                return value;
              })
              .catch((error) => {
                this.recordError(span, error);
                span.end();
                throw error;
              }) as T;
          }

          // Sync function
          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
          return result;
        } catch (error) {
          this.recordError(span, error as Error);
          span.end();
          throw error;
        }
      }
    );
  }

  /**
   * Wrap async function with tracing
   */
  traceAsync<T extends (...args: any[]) => Promise<any>>(
    name: string,
    fn: T,
    options?: SpanOptions
  ): T {
    return (async (...args: any[]) => {
      return this.startActiveSpan(
        name,
        async (span) => {
          try {
            const result = await fn(...args);
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
          } catch (error) {
            this.recordError(span, error as Error);
            throw error;
          }
        },
        options
      );
    }) as T;
  }

  /**
   * Get current active span
   */
  getActiveSpan(): Span | undefined {
    return trace.getActiveSpan();
  }

  /**
   * Get current trace context
   */
  getCurrentContext(): TraceContext | null {
    const span = this.getActiveSpan();
    if (!span) return null;

    const spanContext = span.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      traceFlags: spanContext.traceFlags,
    };
  }

  /**
   * Set span attributes
   */
  setAttribute(span: Span, key: string, value: string | number | boolean): void {
    span.setAttribute(key, value);
  }

  /**
   * Set multiple span attributes
   */
  setAttributes(span: Span, attributes: Record<string, string | number | boolean>): void {
    span.setAttributes(attributes);
  }

  /**
   * Add event to span
   */
  addEvent(span: Span, name: string, attributes?: Record<string, any>): void {
    span.addEvent(name, attributes);
  }

  /**
   * Record error in span
   */
  recordError(span: Span, error: Error): void {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
  }

  /**
   * End span manually
   */
  endSpan(span: Span): void {
    span.end();
  }

  /**
   * Map span kind string to OpenTelemetry SpanKind
   */
  private mapSpanKind(kind?: string): number {
    const { SpanKind } = require('@opentelemetry/api');

    switch (kind) {
      case 'internal':
        return SpanKind.INTERNAL;
      case 'server':
        return SpanKind.SERVER;
      case 'client':
        return SpanKind.CLIENT;
      case 'producer':
        return SpanKind.PRODUCER;
      case 'consumer':
        return SpanKind.CONSUMER;
      default:
        return SpanKind.INTERNAL;
    }
  }

  /**
   * Create child span from parent context
   */
  createChildSpan(name: string, parentSpan: Span, options?: SpanOptions): Span {
    return context.with(trace.setSpan(context.active(), parentSpan), () => {
      return this.startSpan(name, options);
    });
  }

  /**
   * Extract trace context for external propagation
   */
  extractContext(): any {
    return context.active();
  }

  /**
   * Inject context for external propagation
   */
  injectContext(ctx: any, carrier: any): void {
    const { propagation } = require('@opentelemetry/api');
    propagation.inject(ctx, carrier);
  }
}

/**
 * Create tracer instance
 */
export function createTracer(serviceName: string): Tracer {
  return new Tracer(serviceName);
}
