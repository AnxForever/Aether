/**
 * Skill Optimizer - Optimize skill performance and usage
 */

import { createLogger } from '../utils/logger';
import { SkillStats } from './self-learning';

const logger = createLogger('SkillOptimizer');

/**
 * Optimization recommendation
 */
export interface OptimizationRecommendation {
  skillId: string;
  type: 'cache' | 'timeout' | 'retry' | 'parameter' | 'alternative';
  description: string;
  expectedImprovement: string;
  priority: 'low' | 'medium' | 'high';
}

/**
 * Skill cache entry
 */
interface CacheEntry {
  key: string;
  result: any;
  timestamp: number;
  hits: number;
}

/**
 * Skill Optimizer
 */
export class SkillOptimizer {
  private cache = new Map<string, CacheEntry>();
  private maxCacheSize = 100;
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Analyze skill performance
   */
  analyzePerformance(stats: SkillStats[]): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    for (const stat of stats) {
      // Check success rate
      if (stat.successRate < 0.8) {
        recommendations.push({
          skillId: stat.skillId,
          type: 'retry',
          description: `Success rate is ${(stat.successRate * 100).toFixed(1)}%. Consider adding retry logic.`,
          expectedImprovement: 'Increase success rate to 90%+',
          priority: 'high'
        });
      }

      // Check response time
      if (stat.avgResponseTime > 5000) {
        recommendations.push({
          skillId: stat.skillId,
          type: 'timeout',
          description: `Average response time is ${stat.avgResponseTime}ms. Consider adding caching or increasing timeout.`,
          expectedImprovement: 'Reduce response time by 50%',
          priority: 'medium'
        });
      }

      // Check if rarely used
      const daysSinceLastUse = (Date.now() - stat.lastUsed) / (24 * 60 * 60 * 1000);
      if (daysSinceLastUse > 30 && stat.totalCalls < 10) {
        recommendations.push({
          skillId: stat.skillId,
          type: 'alternative',
          description: `Skill hasn't been used in ${daysSinceLastUse.toFixed(0)} days. Consider removing or replacing.`,
          expectedImprovement: 'Reduce maintenance overhead',
          priority: 'low'
        });
      }

      // Check if frequently used - suggest caching
      if (stat.totalCalls > 100 && stat.avgResponseTime > 1000) {
        recommendations.push({
          skillId: stat.skillId,
          type: 'cache',
          description: `Highly used skill (${stat.totalCalls} calls) with ${stat.avgResponseTime}ms response time. Add caching.`,
          expectedImprovement: 'Reduce response time by 80%',
          priority: 'high'
        });
      }
    }

    logger.info(`Generated ${recommendations.length} optimization recommendations`);
    return recommendations;
  }

  /**
   * Cache skill result
   */
  cacheResult(skillId: string, parameters: any, result: any): void {
    const key = this.generateCacheKey(skillId, parameters);

    // Check cache size
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldest();
    }

    const existing = this.cache.get(key);

    if (existing) {
      existing.hits++;
      existing.timestamp = Date.now();
    } else {
      this.cache.set(key, {
        key,
        result,
        timestamp: Date.now(),
        hits: 1
      });
    }

    logger.debug(`Cached result for ${skillId}`);
  }

  /**
   * Get cached result
   */
  getCachedResult(skillId: string, parameters: any): any | null {
    const key = this.generateCacheKey(skillId, parameters);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    logger.debug(`Cache hit for ${skillId} (${entry.hits} hits)`);

    return entry.result;
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(skillId: string, parameters: any): string {
    const paramStr = JSON.stringify(parameters);
    return `${skillId}:${paramStr}`;
  }

  /**
   * Evict oldest cache entry
   */
  private evictOldest(): void {
    let oldest: CacheEntry | null = null;

    for (const entry of this.cache.values()) {
      if (!oldest || entry.timestamp < oldest.timestamp) {
        oldest = entry;
      }
    }

    if (oldest) {
      this.cache.delete(oldest.key);
      logger.debug('Evicted oldest cache entry');
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: { key: string; hits: number; age: number }[];
  } {
    const entries: { key: string; hits: number; age: number }[] = [];
    let totalHits = 0;

    for (const entry of this.cache.values()) {
      entries.push({
        key: entry.key,
        hits: entry.hits,
        age: Date.now() - entry.timestamp
      });
      totalHits += entry.hits;
    }

    const hitRate = this.cache.size > 0 ? totalHits / this.cache.size : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hitRate,
      entries: entries.sort((a, b) => b.hits - a.hits)
    };
  }

  /**
   * Optimize skill parameters
   */
  optimizeParameters(skillId: string, historicalResults: any[]): Record<string, any> {
    // Analyze historical results to find optimal parameters
    // This is a simplified implementation

    const optimized: Record<string, any> = {};

    // Find most common successful parameters
    const successful = historicalResults.filter(r => r.success);

    if (successful.length > 0) {
      // Extract common parameter patterns
      const parameterCounts: Record<string, number> = {};

      for (const result of successful) {
        const paramStr = JSON.stringify(result.parameters);
        parameterCounts[paramStr] = (parameterCounts[paramStr] || 0) + 1;
      }

      // Find most common
      let maxCount = 0;
      let bestParams = '';

      for (const [params, count] of Object.entries(parameterCounts)) {
        if (count > maxCount) {
          maxCount = count;
          bestParams = params;
        }
      }

      if (bestParams) {
        logger.info(`Optimal parameters found for ${skillId}: ${bestParams} (${maxCount} successes)`);
        return JSON.parse(bestParams);
      }
    }

    return optimized;
  }

  /**
   * Set cache TTL
   */
  setCacheTTL(ttl: number): void {
    this.cacheTTL = ttl;
    logger.info(`Cache TTL set to ${ttl}ms`);
  }

  /**
   * Set max cache size
   */
  setMaxCacheSize(size: number): void {
    this.maxCacheSize = size;

    // Evict entries if over new limit
    while (this.cache.size > this.maxCacheSize) {
      this.evictOldest();
    }

    logger.info(`Max cache size set to ${size}`);
  }
}
