/**
 * Performance Monitor - System and application performance monitoring
 */

import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import * as os from 'os';

const logger = createLogger('PerformanceMonitor');

/**
 * Performance metric
 */
export interface PerformanceMetric {
  timestamp: number;
  cpu: number;
  memory: number;
  disk: number;
  network?: {
    bytesIn: number;
    bytesOut: number;
  };
}

/**
 * API performance
 */
export interface APIPerformance {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: number;
  success: boolean;
}

/**
 * Error record
 */
export interface ErrorRecord {
  type: string;
  message: string;
  stack?: string;
  timestamp: number;
  context?: Record<string, any>;
}

/**
 * Performance alert
 */
export interface PerformanceAlert {
  type: 'cpu' | 'memory' | 'disk' | 'api' | 'error';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

/**
 * Performance Monitor
 */
export class PerformanceMonitor extends EventEmitter {
  private db: Database.Database;
  private isMonitoring = false;
  private monitorInterval?: NodeJS.Timeout;
  private intervalMs = 5000; // 5 seconds

  // Thresholds
  private thresholds = {
    cpu: 80, // percent
    memory: 85, // percent
    disk: 90, // percent
    apiResponseTime: 1000, // ms
    errorRate: 0.05 // 5%
  };

  constructor(dbPath: string) {
    super();
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  /**
   * Initialize database tables
   */
  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        cpu REAL NOT NULL,
        memory REAL NOT NULL,
        disk REAL NOT NULL
      );

      CREATE TABLE IF NOT EXISTS api_performance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        responseTime INTEGER NOT NULL,
        statusCode INTEGER NOT NULL,
        success INTEGER NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS error_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        stack TEXT,
        context TEXT,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS performance_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        message TEXT NOT NULL,
        value REAL NOT NULL,
        threshold REAL NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON performance_metrics(timestamp);
      CREATE INDEX IF NOT EXISTS idx_api_timestamp ON api_performance(timestamp);
      CREATE INDEX IF NOT EXISTS idx_errors_timestamp ON error_records(timestamp);
      CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON performance_alerts(timestamp);
    `);

    logger.info('Performance monitor initialized');
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (this.isMonitoring) {
      logger.warn('Performance monitoring already started');
      return;
    }

    this.isMonitoring = true;
    this.monitorInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error: any) {
        logger.error('Metric collection failed:', error as Error);
        // Continue monitoring even if one collection fails
      }
    }, this.intervalMs);

    logger.info('Performance monitoring started');
    this.emit('monitoring-started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
    }

    logger.info('Performance monitoring stopped');
    this.emit('monitoring-stopped');
  }

  /**
   * Collect system metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const metric: PerformanceMetric = {
        timestamp: Date.now(),
        cpu: await this.getCPUUsage(),
        memory: this.getMemoryUsage(),
        disk: await this.getDiskUsage()
      };

      // Store metric
      this.db
        .prepare(
          `INSERT INTO performance_metrics (timestamp, cpu, memory, disk)
           VALUES (?, ?, ?, ?)`
        )
        .run(metric.timestamp, metric.cpu, metric.memory, metric.disk);

      // Check thresholds
      this.checkThresholds(metric);

      this.emit('metric-collected', metric);
    } catch (error: any) {
      logger.error('Failed to collect metrics:', error as Error);
    }
  }

  /**
   * Get CPU usage
   */
  private async getCPUUsage(): Promise<number> {
    const cpus = os.cpus();
    const usage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return acc + ((total - idle) / total) * 100;
    }, 0);

    return usage / cpus.length;
  }

  /**
   * Get memory usage
   */
  private getMemoryUsage(): number {
    const total = os.totalmem();
    const free = os.freemem();
    return ((total - free) / total) * 100;
  }

  /**
   * Get disk usage
   */
  private async getDiskUsage(): Promise<number> {
    // Simplified disk usage (platform-specific in production)
    return 50; // Placeholder
  }

  /**
   * Check thresholds and create alerts
   */
  private checkThresholds(metric: PerformanceMetric): void {
    // CPU threshold
    if (metric.cpu > this.thresholds.cpu) {
      this.createAlert({
        type: 'cpu',
        severity: metric.cpu > 95 ? 'critical' : 'warning',
        message: `High CPU usage: ${metric.cpu.toFixed(1)}%`,
        value: metric.cpu,
        threshold: this.thresholds.cpu,
        timestamp: metric.timestamp
      });
    }

    // Memory threshold
    if (metric.memory > this.thresholds.memory) {
      this.createAlert({
        type: 'memory',
        severity: metric.memory > 95 ? 'critical' : 'warning',
        message: `High memory usage: ${metric.memory.toFixed(1)}%`,
        value: metric.memory,
        threshold: this.thresholds.memory,
        timestamp: metric.timestamp
      });
    }

    // Disk threshold
    if (metric.disk > this.thresholds.disk) {
      this.createAlert({
        type: 'disk',
        severity: metric.disk > 95 ? 'critical' : 'warning',
        message: `High disk usage: ${metric.disk.toFixed(1)}%`,
        value: metric.disk,
        threshold: this.thresholds.disk,
        timestamp: metric.timestamp
      });
    }
  }

  /**
   * Record API performance
   */
  recordAPI(perf: APIPerformance): void {
    this.db
      .prepare(
        `INSERT INTO api_performance (endpoint, method, responseTime, statusCode, success, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        perf.endpoint,
        perf.method,
        perf.responseTime,
        perf.statusCode,
        perf.success ? 1 : 0,
        perf.timestamp
      );

    // Check API response time
    if (perf.responseTime > this.thresholds.apiResponseTime) {
      this.createAlert({
        type: 'api',
        severity: perf.responseTime > 5000 ? 'critical' : 'warning',
        message: `Slow API response: ${perf.endpoint} (${perf.responseTime}ms)`,
        value: perf.responseTime,
        threshold: this.thresholds.apiResponseTime,
        timestamp: perf.timestamp
      });
    }

    this.emit('api-recorded', perf);
  }

  /**
   * Record error
   */
  recordError(error: ErrorRecord): void {
    this.db
      .prepare(
        `INSERT INTO error_records (type, message, stack, context, timestamp)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(error.type, error.message, error.stack || null, JSON.stringify(error.context || {}) as any, error.timestamp);

    logger.warn('Error recorded:', { message: error.message });
    this.emit('error-recorded', error);
  }

  /**
   * Create alert
   */
  private createAlert(alert: PerformanceAlert): void {
    this.db
      .prepare(
        `INSERT INTO performance_alerts (type, severity, message, value, threshold, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(alert.type, alert.severity, alert.message, alert.value, alert.threshold, alert.timestamp);

    logger.warn(`Performance alert: ${alert.message}`);
    this.emit('alert-created', alert);
  }

  /**
   * Get metrics
   */
  getMetrics(timeRange: { start: number; end: number }): PerformanceMetric[] {
    return this.db
      .prepare(
        `SELECT timestamp, cpu, memory, disk
         FROM performance_metrics
         WHERE timestamp BETWEEN ? AND ?
         ORDER BY timestamp`
      )
      .all(timeRange.start, timeRange.end) as PerformanceMetric[];
  }

  /**
   * Get API stats
   */
  getAPIStats(timeRange: { start: number; end: number }): {
    totalRequests: number;
    successRate: number;
    avgResponseTime: number;
    slowestEndpoints: Array<{ endpoint: string; avgResponseTime: number }>;
  } {
    const stats = this.db
      .prepare(
        `SELECT
           COUNT(*) as total,
           AVG(responseTime) as avgTime,
           SUM(success) as successes
         FROM api_performance
         WHERE timestamp BETWEEN ? AND ?`
      )
      .get(timeRange.start, timeRange.end) as any;

    const slowest = this.db
      .prepare(
        `SELECT endpoint, AVG(responseTime) as avgTime
         FROM api_performance
         WHERE timestamp BETWEEN ? AND ?
         GROUP BY endpoint
         ORDER BY avgTime DESC
         LIMIT 5`
      )
      .all(timeRange.start, timeRange.end) as any[];

    return {
      totalRequests: stats.total || 0,
      successRate: stats.total > 0 ? stats.successes / stats.total : 1,
      avgResponseTime: stats.avgTime || 0,
      slowestEndpoints: slowest.map(s => ({
        endpoint: s.endpoint,
        avgResponseTime: s.avgTime
      }))
    };
  }

  /**
   * Get error stats
   */
  getErrorStats(timeRange: { start: number; end: number }): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: ErrorRecord[];
  } {
    const total = (this.db
      .prepare(
        `SELECT COUNT(*) as count
         FROM error_records
         WHERE timestamp BETWEEN ? AND ?`
      )
      .get(timeRange.start, timeRange.end) as any).count;

    const byType = this.db
      .prepare(
        `SELECT type, COUNT(*) as count
         FROM error_records
         WHERE timestamp BETWEEN ? AND ?
         GROUP BY type`
      )
      .all(timeRange.start, timeRange.end) as any[];

    const recent = this.db
      .prepare(
        `SELECT type, message, stack, context, timestamp
         FROM error_records
         WHERE timestamp BETWEEN ? AND ?
         ORDER BY timestamp DESC
         LIMIT 10`
      )
      .all(timeRange.start, timeRange.end) as any[];

    return {
      totalErrors: total,
      errorsByType: Object.fromEntries(byType.map(b => [b.type, b.count])),
      recentErrors: recent.map(r => ({
        type: r.type,
        message: r.message,
        stack: r.stack,
        context: r.context ? JSON.parse(r.context) : undefined,
        timestamp: r.timestamp
      }))
    };
  }

  /**
   * Get alerts
   */
  getAlerts(timeRange: { start: number; end: number }, severity?: string): PerformanceAlert[] {
    const query = severity
      ? `SELECT * FROM performance_alerts WHERE timestamp BETWEEN ? AND ? AND severity = ? ORDER BY timestamp DESC`
      : `SELECT * FROM performance_alerts WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp DESC`;

    const params = severity ? [timeRange.start, timeRange.end, severity] : [timeRange.start, timeRange.end];

    return this.db.prepare(query).all(...params) as PerformanceAlert[];
  }

  /**
   * Generate performance report
   */
  generateReport(timeRange: { start: number; end: number }): string {
    const metrics = this.getMetrics(timeRange);
    const apiStats = this.getAPIStats(timeRange);
    const errorStats = this.getErrorStats(timeRange);
    const alerts = this.getAlerts(timeRange);

    const avgCPU = metrics.reduce((sum, m) => sum + m.cpu, 0) / metrics.length;
    const avgMemory = metrics.reduce((sum, m) => sum + m.memory, 0) / metrics.length;
    const maxCPU = Math.max(...metrics.map(m => m.cpu));
    const maxMemory = Math.max(...metrics.map(m => m.memory));

    const report = [
      '=== Performance Report ===',
      `Period: ${new Date(timeRange.start).toISOString()} to ${new Date(timeRange.end).toISOString()}`,
      '',
      '--- System Metrics ---',
      `Average CPU: ${avgCPU.toFixed(1)}%`,
      `Peak CPU: ${maxCPU.toFixed(1)}%`,
      `Average Memory: ${avgMemory.toFixed(1)}%`,
      `Peak Memory: ${maxMemory.toFixed(1)}%`,
      '',
      '--- API Performance ---',
      `Total Requests: ${apiStats.totalRequests}`,
      `Success Rate: ${(apiStats.successRate * 100).toFixed(1)}%`,
      `Avg Response Time: ${apiStats.avgResponseTime.toFixed(0)}ms`,
      '',
      '--- Slowest Endpoints ---'
    ];

    apiStats.slowestEndpoints.forEach((e, i) => {
      report.push(`${i + 1}. ${e.endpoint}: ${e.avgResponseTime.toFixed(0)}ms`);
    });

    report.push('', '--- Errors ---', `Total Errors: ${errorStats.totalErrors}`);

    if (Object.keys(errorStats.errorsByType).length > 0) {
      report.push('By Type:');
      for (const [type, count] of Object.entries(errorStats.errorsByType)) {
        report.push(`  ${type}: ${count}`);
      }
    }

    if (alerts.length > 0) {
      report.push('', `--- Alerts (${alerts.length}) ---`);
      alerts.slice(0, 10).forEach((alert, i) => {
        report.push(`${i + 1}. [${alert.severity.toUpperCase()}] ${alert.message}`);
      });
    }

    return report.join('\n');
  }

  /**
   * Set threshold
   */
  setThreshold(type: keyof typeof this.thresholds, value: number): void {
    this.thresholds[type] = value;
    logger.info(`Threshold updated: ${type} = ${value}`);
  }

  /**
   * Clear old data
   */
  clearOldData(olderThan: number): void {
    const deleted = {
      metrics: this.db.prepare('DELETE FROM performance_metrics WHERE timestamp < ?').run(olderThan).changes,
      api: this.db.prepare('DELETE FROM api_performance WHERE timestamp < ?').run(olderThan).changes,
      errors: this.db.prepare('DELETE FROM error_records WHERE timestamp < ?').run(olderThan).changes,
      alerts: this.db.prepare('DELETE FROM performance_alerts WHERE timestamp < ?').run(olderThan).changes
    };

    logger.info('Old data cleared:', deleted as unknown as Error);
  }

  /**
   * Close and cleanup resources
   */
  close(): void {
    // Stop monitoring
    this.stop();

    // Close database
    if (this.db) {
      this.db.close();
      logger.info('Performance monitor closed');
    }
  }
}
