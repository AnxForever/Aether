/**
 * Error Handler - Centralized error handling with Sentry integration
 */

import * as Sentry from '@sentry/node';
import { EventEmitter } from 'eventemitter3';
import type { ErrorSeverity, EventTags, EventContext } from './types';

/**
 * Error handler options
 */
export interface ErrorHandlerOptions {
  /**
   * Capture unhandled rejections
   */
  captureUnhandledRejections?: boolean;

  /**
   * Capture uncaught exceptions
   */
  captureUncaughtExceptions?: boolean;

  /**
   * Exit on uncaught exception
   */
  exitOnUncaughtException?: boolean;
}

/**
 * Error event payload
 */
export interface SentryErrorEvent {
  error: Error;
  severity: ErrorSeverity;
  tags?: EventTags;
  context?: EventContext;
  eventId?: string;
}

/**
 * Error Handler
 * Centralized error handling with Sentry integration
 */
export class ErrorHandler extends EventEmitter {
  private isEnabled = false;
  private unhandledRejectionHandler?: (reason: any, promise: Promise<any>) => void;
  private uncaughtExceptionHandler?: (error: Error) => void;

  constructor(private options: ErrorHandlerOptions = {}) {
    super();
  }

  /**
   * Enable error handlers
   */
  enable(): void {
    if (this.isEnabled) {
      return;
    }

    this.isEnabled = true;

    // Handle unhandled promise rejections
    if (this.options.captureUnhandledRejections !== false) {
      this.unhandledRejectionHandler = (reason: any, promise: Promise<any>) => {
        const error = reason instanceof Error ? reason : new Error(String(reason));
        this.captureError(error, {
          severity: 'error',
          tags: { type: 'unhandled_rejection' },
          context: { promise: String(promise) }
        });
      };
      process.on('unhandledRejection', this.unhandledRejectionHandler);
    }

    // Handle uncaught exceptions
    if (this.options.captureUncaughtExceptions !== false) {
      this.uncaughtExceptionHandler = (error: Error) => {
        this.captureError(error, {
          severity: 'fatal',
          tags: { type: 'uncaught_exception' }
        });

        // Exit process if configured
        if (this.options.exitOnUncaughtException !== false) {
          setTimeout(() => {
            process.exit(1);
          }, 1000); // Give Sentry time to send the event
        }
      };
      process.on('uncaughtException', this.uncaughtExceptionHandler);
    }

    this.emit('enabled');
  }

  /**
   * Disable error handlers
   */
  disable(): void {
    if (!this.isEnabled) {
      return;
    }

    this.isEnabled = false;

    // Remove listeners
    if (this.unhandledRejectionHandler) {
      process.off('unhandledRejection', this.unhandledRejectionHandler);
      this.unhandledRejectionHandler = undefined;
    }

    if (this.uncaughtExceptionHandler) {
      process.off('uncaughtException', this.uncaughtExceptionHandler);
      this.uncaughtExceptionHandler = undefined;
    }

    this.emit('disabled');
  }

  /**
   * Capture error
   */
  captureError(
    error: Error,
    options: {
      severity?: ErrorSeverity;
      tags?: EventTags;
      context?: EventContext;
      user?: Sentry.User;
    } = {}
  ): string {
    const { severity = 'error', tags, context, user } = options;

    // Set scope
    Sentry.withScope((scope) => {
      // Set level
      scope.setLevel(severity as Sentry.SeverityLevel);

      // Set tags
      if (tags) {
        Object.entries(tags).forEach(([key, value]) => {
          scope.setTag(key, value);
        });
      }

      // Set context
      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          scope.setContext(key, value);
        });
      }

      // Set user
      if (user) {
        scope.setUser(user);
      }
    });

    // Capture exception
    const eventId = Sentry.captureException(error);

    // Emit event
    const errorEvent: SentryErrorEvent = {
      error,
      severity,
      tags,
      context,
      eventId
    };
    this.emit('error-captured', errorEvent);

    return eventId;
  }

  /**
   * Capture message
   */
  captureMessage(
    message: string,
    options: {
      severity?: ErrorSeverity;
      tags?: EventTags;
      context?: EventContext;
      user?: Sentry.User;
    } = {}
  ): string {
    const { severity = 'info', tags, context, user } = options;

    // Set scope
    Sentry.withScope((scope) => {
      // Set level
      scope.setLevel(severity as Sentry.SeverityLevel);

      // Set tags
      if (tags) {
        Object.entries(tags).forEach(([key, value]) => {
          scope.setTag(key, value);
        });
      }

      // Set context
      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          scope.setContext(key, value);
        });
      }

      // Set user
      if (user) {
        scope.setUser(user);
      }
    });

    // Capture message
    const eventId = Sentry.captureMessage(message, severity as Sentry.SeverityLevel);

    // Emit event
    this.emit('message-captured', { message, severity, tags, context, eventId });

    return eventId;
  }

  /**
   * Wrap async function with error handling
   */
  wrapAsync<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: {
      tags?: EventTags;
      context?: EventContext;
    } = {}
  ): T {
    return (async (...args: any[]) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.captureError(error as Error, {
          severity: 'error',
          tags: {
            ...options.tags,
            function: fn.name || 'anonymous'
          },
          context: options.context
        });
        throw error;
      }
    }) as T;
  }

  /**
   * Wrap sync function with error handling
   */
  wrap<T extends (...args: any[]) => any>(
    fn: T,
    options: {
      tags?: EventTags;
      context?: EventContext;
    } = {}
  ): T {
    return ((...args: any[]) => {
      try {
        return fn(...args);
      } catch (error) {
        this.captureError(error as Error, {
          severity: 'error',
          tags: {
            ...options.tags,
            function: fn.name || 'anonymous'
          },
          context: options.context
        });
        throw error;
      }
    }) as T;
  }

  /**
   * Check if error handler is enabled
   */
  get enabled(): boolean {
    return this.isEnabled;
  }
}
