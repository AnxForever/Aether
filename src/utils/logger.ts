/**
 * Logger - Structured logging utility with i18n support and OpenTelemetry integration
 */

import { trace } from '@opentelemetry/api';
import type { I18nManager } from '../i18n';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  timestamp: number;
  message: string;
  context?: Record<string, any>;
  error?: Error;
  traceId?: string;
  spanId?: string;
}

export class Logger {
  private name: string;
  private minLevel: LogLevel;
  private handlers: LogHandler[] = [];
  private i18n?: I18nManager;

  constructor(name: string, minLevel: LogLevel = 'info') {
    this.name = name;
    this.minLevel = minLevel;
  }

  /**
   * Set i18n manager for internationalized logging
   */
  setI18n(i18n: I18nManager): void {
    this.i18n = i18n;
  }

  /**
   * Add log handler
   */
  addHandler(handler: LogHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Log debug message
   * Supports i18n keys (e.g., 'common:loading') and interpolation
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', this.translateMessage(message, context), context);
  }

  /**
   * Log info message
   * Supports i18n keys (e.g., 'common:success') and interpolation
   */
  info(message: string, context?: Record<string, any>): void {
    this.log('info', this.translateMessage(message, context), context);
  }

  /**
   * Log warning
   * Supports i18n keys (e.g., 'errors:network.timeout') and interpolation
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', this.translateMessage(message, context), context);
  }

  /**
   * Log error
   * Supports i18n keys (e.g., 'errors:file.notFound') and interpolation
   */
  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log('error', this.translateMessage(message, context), { ...context, error });
  }

  /**
   * Translate message if it's an i18n key
   * Key format: 'namespace:key.nested' or just 'key' (uses default namespace)
   */
  private translateMessage(message: string, context?: Record<string, any>): string {
    if (!this.i18n) {
      return message;
    }

    // Check if message looks like an i18n key (contains ':' or starts with known namespaces)
    const hasNamespace = message.includes(':');
    const startsWithNamespace = message.startsWith('common.') ||
                                 message.startsWith('errors.') ||
                                 message.startsWith('skills.');

    if (hasNamespace || startsWithNamespace) {
      // Try to translate, fallback to original message if key doesn't exist
      if (this.i18n.exists(message)) {
        return this.i18n.t(message, context);
      }
    }

    return message;
  }

  /**
   * Core logging method with OpenTelemetry trace context injection
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(level)) return;

    // Extract trace context from active span
    const activeSpan = trace.getActiveSpan();
    let traceId: string | undefined;
    let spanId: string | undefined;

    if (activeSpan) {
      const spanContext = activeSpan.spanContext();
      traceId = spanContext.traceId;
      spanId = spanContext.spanId;
    }

    const entry: LogEntry = {
      level,
      timestamp: Date.now(),
      message: `[${this.name}] ${message}`,
      context,
      traceId,
      spanId,
    };

    // Console output
    this.logToConsole(entry);

    // Custom handlers
    for (const handler of this.handlers) {
      try {
        handler(entry);
      } catch (err) {
        console.error('[Logger] Handler failed:', err);
      }
    }
  }

  /**
   * Check if should log this level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const minIndex = levels.indexOf(this.minLevel);
    const levelIndex = levels.indexOf(level);
    return levelIndex >= minIndex;
  }

  /**
   * Log to console with colors and trace context
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const traceInfo = entry.traceId ? ` [trace:${entry.traceId.slice(0, 8)}]` : '';
    const prefix = `${timestamp} [${entry.level.toUpperCase()}]${traceInfo}`;

    switch (entry.level) {
      case 'debug':
        console.debug(prefix, entry.message, entry.context || '');
        break;
      case 'info':
        console.info(prefix, entry.message, entry.context || '');
        break;
      case 'warn':
        console.warn(prefix, entry.message, entry.context || '');
        break;
      case 'error':
        console.error(prefix, entry.message, entry.context || '');
        if (entry.context?.error) {
          console.error(entry.context.error);
        }
        break;
    }
  }
}

export type LogHandler = (entry: LogEntry) => void;

/**
 * Create logger instance
 */
export function createLogger(name: string, minLevel?: LogLevel): Logger {
  return new Logger(name, minLevel);
}

/**
 * File handler - write logs to file
 */
export function createFileHandler(filePath: string): LogHandler {
  const fs = require('fs');
  const stream = fs.createWriteStream(filePath, { flags: 'a' });

  return (entry: LogEntry) => {
    const line = JSON.stringify(entry) + '\n';
    stream.write(line);
  };
}
