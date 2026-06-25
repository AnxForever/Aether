/**
import { createLogger } from '@/utils/logger';
const logger = createLogger('PerformanceTracker');
 * Performance Tracker - Transaction and span tracking with Sentry
 */

import * as Sentry from '@sentry/node';
import { EventEmitter } from 'eventemitter3';
import type { TransactionOptions, SpanOptions, EventTags } from './types';

/**
 * Active transaction
 */
export interface ActiveTransaction {
  transaction: ReturnType<typeof Sentry.startSpan>;
  startTime: number;
  name: string;
  op: string;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  transactionCount: number;
  spanCount: number;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
}

/**
 * Performance Tracker
 * Tracks transactions and spans for performance monitoring
 */
export class PerformanceTracker extends EventEmitter {
  private activeTransactions = new Map<string, ActiveTransaction>();
  private metrics: PerformanceMetrics = {
    transactionCount: 0,
    spanCount: 0,
    avgDuration: 0,
    maxDuration: 0,
    minDuration: Infinity
  };

  /**
   * Start a transaction
   */
  startTransaction(options: TransactionOptions): string {
    const { name, op, tags, data } = options;

    // Generate transaction ID
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Start span (modern Sentry API)
    const span = Sentry.startInactiveSpan({
      name,
      op,
      attributes: {
        ...tags,
        ...data
      }
    });

    // Store active transaction
    this.activeTransactions.set(transactionId, {
      transaction: span as any,
      startTime: Date.now(),
      name,
      op
    });

    this.emit('transaction-started', { transactionId, name, op });

    return transactionId;
  }

  /**
   * Finish a transaction
   */
  finishTransaction(transactionId: string, tags?: EventTags): void {
    const active = this.activeTransactions.get(transactionId);

    if (!active) {
      console.warn(`[PerformanceTracker] Transaction not found: ${transactionId}`);
      return;
    }

    // Calculate duration
    const duration = Date.now() - active.startTime;

    // Update metrics
    this.updateMetrics(duration, 'transaction');

    // Finish transaction (no-op for modern API, span auto-finishes)
    // active.transaction is handled by Sentry internally

    // Remove from active
    this.activeTransactions.delete(transactionId);

    this.emit('transaction-finished', {
      transactionId,
      name: active.name,
      op: active.op,
      duration
    });
  }

  /**
   * Start a span within a transaction
   */
  startSpan(transactionId: string, options: SpanOptions): string | null {
    const active = this.activeTransactions.get(transactionId);

    if (!active) {
      console.warn(`[PerformanceTracker] Transaction not found: ${transactionId}`);
      return null;
    }

    // Create span using modern API
    const spanId = `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    Sentry.startSpan(
      {
        name: options.description || options.op,
        op: options.op,
        attributes: {
          ...options.tags,
          ...options.data
        }
      },
      () => {
        // Span will auto-finish when callback completes
      }
    );

    this.emit('span-started', {
      transactionId,
      spanId,
      op: options.op,
      description: options.description
    });

    return spanId;
  }

  /**
   * Finish a span
   */
  finishSpan(spanId: string, tags?: EventTags): void {
    // Note: Spans are managed by Sentry internally
    // We track them for metrics but don't store references
    this.updateMetrics(0, 'span'); // Duration tracked by Sentry

    this.emit('span-finished', { spanId });
  }

  /**
   * Measure async function execution
   */
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    options: {
      op?: string;
      tags?: EventTags;
      data?: Record<string, any>;
    } = {}
  ): Promise<T> {
    const transactionId = this.startTransaction({
      name,
      op: options.op || 'function',
      tags: options.tags,
      data: options.data
    });

    try {
      const result = await fn();
      this.finishTransaction(transactionId, { status: 'ok' });
      return result;
    } catch (error) {
      this.finishTransaction(transactionId, { status: 'error' });
      throw error;
    }
  }

  /**
   * Measure sync function execution
   */
  measure<T>(
    name: string,
    fn: () => T,
    options: {
      op?: string;
      tags?: EventTags;
      data?: Record<string, any>;
    } = {}
  ): T {
    const transactionId = this.startTransaction({
      name,
      op: options.op || 'function',
      tags: options.tags,
      data: options.data
    });

    try {
      const result = fn();
      this.finishTransaction(transactionId, { status: 'ok' });
      return result;
    } catch (error) {
      this.finishTransaction(transactionId, { status: 'error' });
      throw error;
    }
  }

  /**
   * Wrap async function with automatic transaction tracking
   */
  wrapAsync<T extends (...args: any[]) => Promise<any>>(
    name: string,
    fn: T,
    options: {
      op?: string;
      tags?: EventTags;
    } = {}
  ): T {
    return (async (...args: any[]) => {
      return this.measureAsync(name, () => fn(...args), options);
    }) as T;
  }

  /**
   * Wrap sync function with automatic transaction tracking
   */
  wrap<T extends (...args: any[]) => any>(
    name: string,
    fn: T,
    options: {
      op?: string;
      tags?: EventTags;
    } = {}
  ): T {
    return ((...args: any[]) => {
      return this.measure(name, () => fn(...args), options);
    }) as T;
  }

  /**
   * Get active transaction count
   */
  getActiveTransactionCount(): number {
    return this.activeTransactions.size;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      transactionCount: 0,
      spanCount: 0,
      avgDuration: 0,
      maxDuration: 0,
      minDuration: Infinity
    };
    this.emit('metrics-reset');
  }

  /**
   * Update metrics
   */
  private updateMetrics(duration: number, type: 'transaction' | 'span'): void {
    if (type === 'transaction') {
      const count = this.metrics.transactionCount;
      this.metrics.avgDuration = (this.metrics.avgDuration * count + duration) / (count + 1);
      this.metrics.transactionCount++;
      this.metrics.maxDuration = Math.max(this.metrics.maxDuration, duration);
      this.metrics.minDuration = Math.min(this.metrics.minDuration, duration);
    } else {
      this.metrics.spanCount++;
    }
  }

  /**
   * Cleanup - finish all active transactions
   */
  cleanup(): void {
    for (const [transactionId] of this.activeTransactions.entries()) {
      console.warn(`[PerformanceTracker] Cleaning up abandoned transaction: ${transactionId}`);
      this.activeTransactions.delete(transactionId);
    }
  }
}
