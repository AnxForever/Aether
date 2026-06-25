import { EventEmitter } from 'events';

/**
 * Rate Limiter Configuration
 */
export interface RateLimiterConfig {
  maxTokens: number;
  refillRate: number; // tokens per second
  keyExtractor?: (identifier: string) => string;
}

/**
 * Token Bucket State
 */
interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

/**
 * Rate Limiter Events
 */
export interface RateLimiterEvents {
  'limit:exceeded': (identifier: string) => void;
  'limit:allowed': (identifier: string, remaining: number) => void;
  'bucket:created': (identifier: string) => void;
  'bucket:cleaned': (count: number) => void;
}

/**
 * Token Bucket Rate Limiter
 *
 * Algorithm:
 * - Each client gets a bucket with maxTokens capacity
 * - Tokens refill at refillRate per second
 * - Each request consumes 1 token
 * - Request blocked if no tokens available
 *
 * Features:
 * - Per-client rate limiting (by userId, IP, or custom key)
 * - Automatic token refill
 * - Periodic bucket cleanup for inactive clients
 * - Event emission for monitoring
 */
export class RateLimiter extends EventEmitter {
  private config: Required<RateLimiterConfig>;
  private buckets: Map<string, TokenBucket>;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor(config: RateLimiterConfig) {
    super();
    this.config = {
      keyExtractor: (id) => id,
      ...config,
    };
    this.buckets = new Map();
    this.cleanupInterval = null;

    // Start periodic cleanup (every 5 minutes)
    this.startCleanup();
  }

  /**
   * Check if request is allowed for given identifier
   *
   * @param identifier - User ID, IP address, or custom key
   * @param cost - Token cost (default: 1, higher for unauthenticated users)
   * @returns true if allowed, false if rate limited
   */
  public async allow(identifier: string, cost: number = 1): Promise<boolean> {
    const key = this.config.keyExtractor(identifier);
    const bucket = this.getOrCreateBucket(key);

    // Refill tokens based on elapsed time
    this.refillBucket(bucket);

    // Check if enough tokens available
    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      this.emit('limit:allowed', key, Math.floor(bucket.tokens));
      return true;
    }

    this.emit('limit:exceeded', key);
    return false;
  }

  /**
   * Get current token count for identifier
   */
  public getTokens(identifier: string): number {
    const key = this.config.keyExtractor(identifier);
    const bucket = this.buckets.get(key);

    if (!bucket) {
      return this.config.maxTokens;
    }

    this.refillBucket(bucket);
    return Math.floor(bucket.tokens);
  }

  /**
   * Reset bucket for identifier (admin operation)
   */
  public reset(identifier: string): void {
    const key = this.config.keyExtractor(identifier);
    this.buckets.delete(key);
  }

  /**
   * Get or create token bucket for identifier
   */
  private getOrCreateBucket(key: string): TokenBucket {
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = {
        tokens: this.config.maxTokens,
        lastRefill: Date.now(),
      };
      this.buckets.set(key, bucket);
      this.emit('bucket:created', key);
    }

    return bucket;
  }

  /**
   * Refill bucket based on elapsed time
   */
  private refillBucket(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;

    if (elapsedSeconds > 0) {
      const tokensToAdd = elapsedSeconds * this.config.refillRate;
      bucket.tokens = Math.min(
        this.config.maxTokens,
        bucket.tokens + tokensToAdd
      );
      bucket.lastRefill = now;
    }
  }

  /**
   * Start periodic cleanup of inactive buckets
   */
  private startCleanup(): void {
    const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
    const INACTIVE_THRESHOLD = 10 * 60 * 1000; // 10 minutes

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [key, bucket] of Array.from(this.buckets.entries())) {
        if (now - bucket.lastRefill > INACTIVE_THRESHOLD) {
          this.buckets.delete(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this.emit('bucket:cleaned', cleanedCount);
      }
    }, CLEANUP_INTERVAL);

    // Prevent cleanup from keeping process alive
    this.cleanupInterval.unref();
  }

  /**
   * Stop cleanup interval and clear all buckets
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.buckets.clear();
    this.removeAllListeners();
  }

  /**
   * Get statistics
   */
  public getStats(): {
    totalBuckets: number;
    config: RateLimiterConfig;
  } {
    return {
      totalBuckets: this.buckets.size,
      config: {
        maxTokens: this.config.maxTokens,
        refillRate: this.config.refillRate,
      },
    };
  }
}

/**
 * Type-safe event emitter for RateLimiter
 */
export interface RateLimiter {
  on<K extends keyof RateLimiterEvents>(
    event: K,
    listener: RateLimiterEvents[K]
  ): this;
  emit<K extends keyof RateLimiterEvents>(
    event: K,
    ...args: Parameters<RateLimiterEvents[K]>
  ): boolean;
}
