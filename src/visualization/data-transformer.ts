/**
 * Data Transformer - Transform and aggregate data for visualization
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('DataTransformer');

/**
 * Aggregation function
 */
export type AggregationFunction = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'median' | 'std';

/**
 * Transform options
 */
export interface TransformOptions {
  groupBy?: string;
  aggregate?: Record<string, AggregationFunction>;
  filter?: (row: any) => boolean;
  sort?: { field: string; order: 'asc' | 'desc' };
  limit?: number;
}

/**
 * Data Transformer
 */
export class DataTransformer {
  /**
   * Transform data
   */
  transform(data: any[], options: TransformOptions = {}): any[] {
    logger.info('Transforming data', { rows: data.length, options });

    let result = [...data];

    // Filter
    if (options.filter) {
      result = result.filter(options.filter);
    }

    // Group by and aggregate
    if (options.groupBy && options.aggregate) {
      result = this.groupAndAggregate(result, options.groupBy, options.aggregate);
    }

    // Sort
    if (options.sort) {
      result = this.sort(result, options.sort.field, options.sort.order);
    }

    // Limit
    if (options.limit) {
      result = result.slice(0, options.limit);
    }

    logger.info('Transform complete', { resultRows: result.length });

    return result;
  }

  /**
   * Group by and aggregate
   */
  private groupAndAggregate(
    data: any[],
    groupByField: string,
    aggregations: Record<string, AggregationFunction>
  ): any[] {
    const groups = new Map<any, any[]>();

    // Group data
    for (const row of data) {
      const key = row[groupByField];
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    }

    // Aggregate each group
    const result: any[] = [];

    for (const [key, rows] of groups.entries()) {
      const aggregated: any = { [groupByField]: key };

      for (const [field, func] of Object.entries(aggregations)) {
        aggregated[field] = this.aggregate(rows, field, func);
      }

      result.push(aggregated);
    }

    return result;
  }

  /**
   * Aggregate values
   */
  private aggregate(rows: any[], field: string, func: AggregationFunction): number {
    const values = rows.map(row => row[field]).filter(v => typeof v === 'number' && !isNaN(v));

    if (values.length === 0) return 0;

    switch (func) {
      case 'sum':
        return values.reduce((sum, v) => sum + v, 0);

      case 'avg':
        return values.reduce((sum, v) => sum + v, 0) / values.length;

      case 'min':
        return Math.min(...values);

      case 'max':
        return Math.max(...values);

      case 'count':
        return values.length;

      case 'median':
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

      case 'std':
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        return Math.sqrt(variance);

      default:
        return 0;
    }
  }

  /**
   * Sort data
   */
  private sort(data: any[], field: string, order: 'asc' | 'desc'): any[] {
    return [...data].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];

      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });
  }

  /**
   * Pivot data
   */
  pivot(
    data: any[],
    rowField: string,
    colField: string,
    valueField: string,
    aggFunc: AggregationFunction = 'sum'
  ): any[] {
    const pivoted = new Map<any, Map<any, number[]>>();

    // Collect values
    for (const row of data) {
      const rowKey = row[rowField];
      const colKey = row[colField];
      const value = row[valueField];

      if (!pivoted.has(rowKey)) {
        pivoted.set(rowKey, new Map());
      }

      const rowMap = pivoted.get(rowKey)!;
      if (!rowMap.has(colKey)) {
        rowMap.set(colKey, []);
      }

      rowMap.get(colKey)!.push(value);
    }

    // Aggregate and convert to array
    const result: any[] = [];

    for (const [rowKey, colMap] of pivoted.entries()) {
      const row: any = { [rowField]: rowKey };

      for (const [colKey, values] of colMap.entries()) {
        row[colKey] = this.aggregate(values.map((v) => ({ [valueField]: v })), valueField, aggFunc);
      }

      result.push(row);
    }

    return result;
  }

  /**
   * Normalize data (0-1 range)
   */
  normalize(data: any[], field: string): any[] {
    const values = data.map(row => row[field]).filter(v => typeof v === 'number');
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    return data.map(row => ({
      ...row,
      [`${field}_normalized`]: range === 0 ? 0 : (row[field] - min) / range
    }));
  }

  /**
   * Calculate moving average
   */
  movingAverage(data: any[], field: string, window: number): any[] {
    return data.map((row, i) => {
      const start = Math.max(0, i - window + 1);
      const values = data.slice(start, i + 1).map(r => r[field]);
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;

      return {
        ...row,
        [`${field}_ma${window}`]: avg
      };
    });
  }

  /**
   * Calculate percentiles
   */
  percentiles(data: any[], field: string, percentiles: number[] = [25, 50, 75]): Record<number, number> {
    const values = data.map(row => row[field]).filter(v => typeof v === 'number').sort((a, b) => a - b);

    const result: Record<number, number> = {};

    for (const p of percentiles) {
      const index = Math.ceil((p / 100) * values.length) - 1;
      result[p] = values[Math.max(0, index)];
    }

    return result;
  }

  /**
   * Bin data into ranges
   */
  bin(data: any[], field: string, binCount: number = 10): any[] {
    const values = data.map(row => row[field]).filter(v => typeof v === 'number');
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binSize = (max - min) / binCount;

    const bins: any[] = [];

    for (let i = 0; i < binCount; i++) {
      const binMin = min + i * binSize;
      const binMax = min + (i + 1) * binSize;

      const binData = data.filter(row => {
        const val = row[field];
        return val >= binMin && (i === binCount - 1 ? val <= binMax : val < binMax);
      });

      bins.push({
        range: `${binMin.toFixed(2)}-${binMax.toFixed(2)}`,
        min: binMin,
        max: binMax,
        count: binData.length,
        data: binData
      });
    }

    return bins;
  }

  /**
   * Detect outliers using IQR method
   */
  detectOutliers(data: any[], field: string): { outliers: any[]; cleaned: any[] } {
    const values = data.map(row => row[field]).filter(v => typeof v === 'number');
    const sorted = [...values].sort((a, b) => a - b);

    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);

    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;

    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const outliers = data.filter(row => {
      const val = row[field];
      return val < lowerBound || val > upperBound;
    });

    const cleaned = data.filter(row => {
      const val = row[field];
      return val >= lowerBound && val <= upperBound;
    });

    logger.info(`Detected ${outliers.length} outliers in field: ${field}`);

    return { outliers, cleaned };
  }

  /**
   * Fill missing values
   */
  fillMissing(data: any[], field: string, strategy: 'mean' | 'median' | 'mode' | 'forward' | 'backward'): any[] {
    const values = data.map(row => row[field]).filter(v => v != null);

    let fillValue: any;

    switch (strategy) {
      case 'mean':
        fillValue = values.reduce((sum, v) => sum + v, 0) / values.length;
        return data.map(row => ({
          ...row,
          [field]: row[field] == null ? fillValue : row[field]
        }));

      case 'median':
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        fillValue = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
        return data.map(row => ({
          ...row,
          [field]: row[field] == null ? fillValue : row[field]
        }));

      case 'mode':
        const counts = new Map<any, number>();
        values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
        fillValue = Array.from(counts.entries()).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
        return data.map(row => ({
          ...row,
          [field]: row[field] == null ? fillValue : row[field]
        }));

      case 'forward':
        // Forward fill: propagate last valid value forward
        let lastValid: any = null;
        return data.map((row) => {
          if (row[field] != null) {
            lastValid = row[field];
            return row;
          }
          return lastValid != null ? { ...row, [field]: lastValid } : row;
        });

      case 'backward':
        // Backward fill: propagate next valid value backward
        let nextValid: any = null;
        return data.slice().reverse().map((row) => {
          if (row[field] != null) {
            nextValid = row[field];
            return row;
          }
          return nextValid != null ? { ...row, [field]: nextValid } : row;
        }).reverse();
    }
  }
}
