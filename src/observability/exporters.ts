/**
 * OpenTelemetry Exporters Configuration
 */

import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import type { SpanExporter } from '@opentelemetry/sdk-trace-base';
import type { PushMetricExporter } from '@opentelemetry/sdk-metrics';
import type { TelemetryConfig } from './types';
import { createLogger } from '@/utils/logger';

const logger = createLogger('TelemetryExporters');

/**
 * Create trace exporter based on config
 */
export function createTraceExporter(config: TelemetryConfig): SpanExporter | undefined {
  if (!config.tracing?.enabled) {
    return undefined;
  }

  const exporterType = config.exporter?.type || 'otlp';
  const endpoint = config.tracing.endpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  switch (exporterType) {
    case 'otlp': {
      const otlpConfig: any = {
        url: endpoint || 'http://localhost:4318/v1/traces',
        headers: config.exporter?.headers || {},
      };

      return new OTLPTraceExporter(otlpConfig);
    }

    case 'console': {
      // Console exporter for debugging
      const { ConsoleSpanExporter } = require('@opentelemetry/sdk-trace-base');
      return new ConsoleSpanExporter();
    }

    case 'jaeger': {
      // Jaeger exporter
      try {
        const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
        return new JaegerExporter({
          endpoint: endpoint || 'http://localhost:14268/api/traces',
        });
      } catch (err) {
        logger.warn(' Jaeger exporter not available, install @opentelemetry/exporter-jaeger');
        return undefined;
      }
    }

    case 'zipkin': {
      // Zipkin exporter
      try {
        const { ZipkinExporter } = require('@opentelemetry/exporter-zipkin');
        return new ZipkinExporter({
          url: endpoint || 'http://localhost:9411/api/v2/spans',
        });
      } catch (err) {
        logger.warn(' Zipkin exporter not available, install @opentelemetry/exporter-zipkin');
        return undefined;
      }
    }

    default:
      logger.warn(`[Telemetry] Unknown exporter type: ${exporterType}`);
      return undefined;
  }
}

/**
 * Create metrics exporter based on config
 */
export function createMetricExporter(config: TelemetryConfig): PushMetricExporter | undefined {
  if (!config.metrics?.enabled) {
    return undefined;
  }

  const exporterType = config.exporter?.type || 'otlp';
  const endpoint = config.metrics.endpoint || process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT;

  switch (exporterType) {
    case 'otlp': {
      const otlpConfig: any = {
        url: endpoint || 'http://localhost:4318/v1/metrics',
        headers: config.exporter?.headers || {},
      };

      return new OTLPMetricExporter(otlpConfig);
    }

    case 'console': {
      // Console metric exporter for debugging
      const { ConsoleMetricExporter } = require('@opentelemetry/sdk-metrics');
      return new ConsoleMetricExporter();
    }

    default:
      console.warn(`[Telemetry] Metrics exporter not supported for type: ${exporterType}`);
      return undefined;
  }
}

/**
 * Get exporter timeout from environment
 */
export function getExporterTimeout(): number {
  const timeout = process.env.OTEL_EXPORTER_OTLP_TIMEOUT;
  return timeout ? parseInt(timeout, 10) : 10000; // Default 10s
}

/**
 * Get exporter compression from environment
 */
export function getExporterCompression(): 'gzip' | 'none' {
  const compression = process.env.OTEL_EXPORTER_OTLP_COMPRESSION;
  return compression === 'gzip' ? 'gzip' : 'none';
}
