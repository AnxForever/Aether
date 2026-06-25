/**
 * Recommendation Engine - AI-driven recommendation system
 */

import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';
import Database from 'better-sqlite3';

const logger = createLogger('RecommendationEngine');

/**
 * Recommendation type
 */
export type RecommendationType =
  | 'skill'
  | 'workflow'
  | 'content'
  | 'collaborator'
  | 'code_snippet'
  | 'learning_path';

/**
 * Recommendation item
 */
export interface RecommendationItem {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  score: number;
  reason: string;
  metadata?: Record<string, any>;
}

/**
 * User interaction
 */
export interface UserInteraction {
  userId: string;
  itemId: string;
  itemType: RecommendationType;
  action: 'view' | 'use' | 'like' | 'dislike' | 'skip';
  timestamp: number;
  duration?: number;
  metadata?: Record<string, any>;
}

/**
 * Recommendation Engine
 */
export class RecommendationEngine extends EventEmitter {
  private db: Database.Database;

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
      CREATE TABLE IF NOT EXISTS user_interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        itemId TEXT NOT NULL,
        itemType TEXT NOT NULL,
        action TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        duration INTEGER,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS item_features (
        itemId TEXT PRIMARY KEY,
        itemType TEXT NOT NULL,
        features TEXT NOT NULL,
        tags TEXT,
        popularity REAL DEFAULT 0,
        quality REAL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS user_preferences (
        userId TEXT PRIMARY KEY,
        preferences TEXT NOT NULL,
        lastUpdated INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_interactions_user ON user_interactions(userId);
      CREATE INDEX IF NOT EXISTS idx_interactions_item ON user_interactions(itemId);
      CREATE INDEX IF NOT EXISTS idx_features_type ON item_features(itemType);
    `);

    logger.info('Recommendation engine initialized');
  }

  /**
   * Record user interaction
   */
  recordInteraction(interaction: UserInteraction): void {
    this.db
      .prepare(
        `INSERT INTO user_interactions (userId, itemId, itemType, action, timestamp, duration, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        interaction.userId,
        interaction.itemId,
        interaction.itemType,
        interaction.action,
        interaction.timestamp,
        interaction.duration || null,
        JSON.stringify(interaction.metadata || {})
      );

    // Update item popularity
    this.updateItemPopularity(interaction.itemId);

    // Update user preferences
    this.updateUserPreferences(interaction.userId);

    logger.debug(`Interaction recorded: ${interaction.userId} -> ${interaction.itemId} (${interaction.action})`);
  }

  /**
   * Get recommendations for user
   */
  getRecommendations(
    userId: string,
    type?: RecommendationType,
    limit: number = 10
  ): RecommendationItem[] {
    logger.info(`Generating recommendations for user: ${userId}`);

    // Get user preferences
    const userPrefs = this.getUserPreferences(userId);

    // Get user interaction history
    const history = this.getUserHistory(userId, type);
    const interactedItems = new Set(history.map(h => h.itemId));

    // Get candidate items
    const candidates = this.getCandidateItems(type);

    // Score each candidate
    const scored = candidates
      .filter(item => !interactedItems.has(item.id))
      .map(item => {
        const score = this.calculateRecommendationScore(item, userPrefs, history);
        const reason = this.generateReason(item, userPrefs, score);

        return {
          ...item,
          score,
          reason
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    logger.info(`Generated ${scored.length} recommendations for ${userId}`);

    return scored;
  }

  /**
   * Calculate recommendation score
   */
  private calculateRecommendationScore(
    item: RecommendationItem,
    userPrefs: Record<string, any>,
    history: UserInteraction[]
  ): number {
    let score = 0;

    // Popularity score (0-30)
    const popularity = this.getItemPopularity(item.id);
    score += popularity * 30;

    // Quality score (0-20)
    const quality = this.getItemQuality(item.id);
    score += quality * 20;

    // User preference match (0-30)
    const prefMatch = this.calculatePreferenceMatch(item, userPrefs);
    score += prefMatch * 30;

    // Collaborative filtering (0-20)
    const collaborativeScore = this.getCollaborativeScore(item.id, history);
    score += collaborativeScore * 20;

    return Math.min(100, score);
  }

  /**
   * Calculate preference match
   */
  private calculatePreferenceMatch(
    item: RecommendationItem,
    userPrefs: Record<string, any>
  ): number {
    if (!item.metadata || !userPrefs.tags) return 0.5;

    const itemTags = item.metadata.tags || [];
    const userTags = userPrefs.tags || [];

    if (itemTags.length === 0 || userTags.length === 0) return 0.5;

    const intersection = itemTags.filter((tag: string) => userTags.includes(tag));
    return intersection.length / Math.max(itemTags.length, userTags.length);
  }

  /**
   * Get collaborative filtering score
   */
  private getCollaborativeScore(itemId: string, history: UserInteraction[]): number {
    // Simplified collaborative filtering
    // In production, use matrix factorization or neural collaborative filtering

    if (history.length === 0) return 0.5;

    // Find similar items based on co-occurrence
    const relatedItems = this.findRelatedItems(itemId);
    const historyItemIds = new Set(history.map(h => h.itemId));

    const overlap = relatedItems.filter(id => historyItemIds.has(id)).length;

    return relatedItems.length > 0 ? overlap / relatedItems.length : 0.5;
  }

  /**
   * Find related items
   */
  private findRelatedItems(itemId: string): string[] {
    // Find items that users who interacted with itemId also interacted with
    const related = this.db
      .prepare(
        `SELECT DISTINCT ui2.itemId, COUNT(*) as count
         FROM user_interactions ui1
         JOIN user_interactions ui2 ON ui1.userId = ui2.userId
         WHERE ui1.itemId = ? AND ui2.itemId != ?
         GROUP BY ui2.itemId
         ORDER BY count DESC
         LIMIT 10`
      )
      .all(itemId, itemId) as { itemId: string; count: number }[];

    return related.map(r => r.itemId);
  }

  /**
   * Get item popularity
   */
  private getItemPopularity(itemId: string): number {
    const row = this.db
      .prepare('SELECT popularity FROM item_features WHERE itemId = ?')
      .get(itemId) as { popularity: number } | undefined;

    return row?.popularity || 0;
  }

  /**
   * Get item quality
   */
  private getItemQuality(itemId: string): number {
    const row = this.db
      .prepare('SELECT quality FROM item_features WHERE itemId = ?')
      .get(itemId) as { quality: number } | undefined;

    return row?.quality || 0.5;
  }

  /**
   * Update item popularity
   */
  private updateItemPopularity(itemId: string): void {
    const interactionCount = (this.db
      .prepare('SELECT COUNT(*) as count FROM user_interactions WHERE itemId = ?')
      .get(itemId) as { count: number }).count;

    const totalInteractions = (this.db
      .prepare('SELECT COUNT(*) as count FROM user_interactions')
      .get() as { count: number }).count;

    const popularity = totalInteractions > 0 ? interactionCount / totalInteractions : 0;

    this.db
      .prepare(
        `INSERT INTO item_features (itemId, itemType, features, popularity)
         VALUES (?, 'unknown', '{}', ?)
         ON CONFLICT(itemId) DO UPDATE SET popularity = ?`
      )
      .run(itemId, popularity, popularity);
  }

  /**
   * Update user preferences
   */
  private updateUserPreferences(userId: string): void {
    // Analyze user history to build preference profile
    const history = this.getUserHistory(userId);

    const itemTypes: Record<string, number> = {};
    const tags: string[] = [];

    for (const interaction of history) {
      itemTypes[interaction.itemType] = (itemTypes[interaction.itemType] || 0) + 1;

      if (interaction.metadata?.tags) {
        tags.push(...interaction.metadata.tags);
      }
    }

    // Count tag frequency
    const tagCounts = tags.reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get top tags
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);

    const preferences = {
      itemTypes,
      tags: topTags,
      interactionCount: history.length
    };

    this.db
      .prepare(
        `INSERT INTO user_preferences (userId, preferences, lastUpdated)
         VALUES (?, ?, ?)
         ON CONFLICT(userId) DO UPDATE SET preferences = ?, lastUpdated = ?`
      )
      .run(
        userId,
        JSON.stringify(preferences),
        Date.now(),
        JSON.stringify(preferences),
        Date.now()
      );
  }

  /**
   * Get user preferences
   */
  private getUserPreferences(userId: string): Record<string, any> {
    const row = this.db
      .prepare('SELECT preferences FROM user_preferences WHERE userId = ?')
      .get(userId) as { preferences: string } | undefined;

    return row ? JSON.parse(row.preferences) : {};
  }

  /**
   * Get user history
   */
  private getUserHistory(userId: string, type?: RecommendationType): UserInteraction[] {
    const query = type
      ? 'SELECT * FROM user_interactions WHERE userId = ? AND itemType = ? ORDER BY timestamp DESC'
      : 'SELECT * FROM user_interactions WHERE userId = ? ORDER BY timestamp DESC';

    const rows = type
      ? this.db.prepare(query).all(userId, type)
      : this.db.prepare(query).all(userId);

    return (rows as any[]).map(row => ({
      userId: row.userId,
      itemId: row.itemId,
      itemType: row.itemType,
      action: row.action,
      timestamp: row.timestamp,
      duration: row.duration,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  /**
   * Get candidate items
   */
  private getCandidateItems(type?: RecommendationType): RecommendationItem[] {
    // This is a simplified implementation
    // In production, query your actual item catalog

    const query = type
      ? 'SELECT * FROM item_features WHERE itemType = ? ORDER BY popularity DESC LIMIT 100'
      : 'SELECT * FROM item_features ORDER BY popularity DESC LIMIT 100';

    const rows = type
      ? this.db.prepare(query).all(type)
      : this.db.prepare(query).all();

    return (rows as any[]).map(row => ({
      id: row.itemId,
      type: row.itemType,
      title: `Item ${row.itemId}`,
      description: 'Description placeholder',
      score: 0,
      reason: '',
      metadata: row.features ? JSON.parse(row.features) : {}
    }));
  }

  /**
   * Generate recommendation reason
   */
  private generateReason(
    item: RecommendationItem,
    userPrefs: Record<string, any>,
    score: number
  ): string {
    if (score > 80) {
      return 'Highly recommended based on your activity';
    } else if (score > 60) {
      return 'Popular among users with similar interests';
    } else if (score > 40) {
      return 'Matches your preferences';
    } else {
      return 'You might find this interesting';
    }
  }

  /**
   * Register item
   */
  registerItem(
    itemId: string,
    itemType: RecommendationType,
    features: Record<string, any>,
    tags?: string[]
  ): void {
    this.db
      .prepare(
        `INSERT INTO item_features (itemId, itemType, features, tags, quality)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(itemId) DO UPDATE SET features = ?, tags = ?, quality = ?`
      )
      .run(
        itemId,
        itemType,
        JSON.stringify(features),
        JSON.stringify(tags || []),
        0.5,
        JSON.stringify(features),
        JSON.stringify(tags || []),
        0.5
      );

    logger.debug(`Item registered: ${itemId} (${itemType})`);
  }

  /**
   * Get recommendation statistics
   */
  getStatistics(userId: string): {
    totalInteractions: number;
    itemTypeDistribution: Record<string, number>;
    topItems: Array<{ itemId: string; count: number }>;
  } {
    const totalInteractions = (this.db
      .prepare('SELECT COUNT(*) as count FROM user_interactions WHERE userId = ?')
      .get(userId) as { count: number }).count;

    const typeDistribution = this.db
      .prepare(
        `SELECT itemType, COUNT(*) as count
         FROM user_interactions
         WHERE userId = ?
         GROUP BY itemType`
      )
      .all(userId) as { itemType: string; count: number }[];

    const itemTypeDistribution = Object.fromEntries(
      typeDistribution.map(row => [row.itemType, row.count])
    );

    const topItems = this.db
      .prepare(
        `SELECT itemId, COUNT(*) as count
         FROM user_interactions
         WHERE userId = ?
         GROUP BY itemId
         ORDER BY count DESC
         LIMIT 5`
      )
      .all(userId) as { itemId: string; count: number }[];

    return {
      totalInteractions,
      itemTypeDistribution,
      topItems
    };
  }

  /**
   * Close and cleanup
   */
  close(): void {
    if (this.db) {
      this.db.close();
      logger.info('Recommendation engine closed');
    }
  }
}
