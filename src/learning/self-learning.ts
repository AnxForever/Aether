/**
 * Self-Learning System - Agent performance tracking and improvement
 */

import { createLogger } from '../utils/logger';
import Database from 'better-sqlite3';
import { EventEmitter } from 'events';

const logger = createLogger('SelfLearning');

/**
 * Feedback entry
 */
export interface Feedback {
  id: string;
  sessionId: string;
  messageId: string;
  rating: number; // 1-5
  comment?: string;
  correctedResponse?: string;
  timestamp: number;
}

/**
 * Performance metric
 */
export interface PerformanceMetric {
  id: string;
  type: 'response_time' | 'tool_success' | 'user_satisfaction' | 'error_rate';
  value: number;
  context: Record<string, any>;
  timestamp: number;
}

/**
 * Skill usage statistics
 */
export interface SkillStats {
  skillId: string;
  totalCalls: number;
  successRate: number;
  avgResponseTime: number;
  lastUsed: number;
}

/**
 * Improvement suggestion
 */
export interface ImprovementSuggestion {
  category: 'prompt' | 'skill' | 'performance' | 'accuracy';
  description: string;
  priority: 'low' | 'medium' | 'high';
  dataPoints: any[];
  timestamp: number;
}

/**
 * Self-Learning System
 */
export class SelfLearningSystem extends EventEmitter {
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
      CREATE TABLE IF NOT EXISTS user_feedback (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        messageId TEXT NOT NULL,
        rating INTEGER NOT NULL,
        comment TEXT,
        correctedResponse TEXT,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS performance_metrics (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        value REAL NOT NULL,
        context TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS skill_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        skillId TEXT NOT NULL,
        success INTEGER NOT NULL,
        responseTime INTEGER,
        error TEXT,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS improvement_suggestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        priority TEXT NOT NULL,
        dataPoints TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_feedback_rating ON user_feedback(rating);
      CREATE INDEX IF NOT EXISTS idx_metrics_type ON performance_metrics(type);
      CREATE INDEX IF NOT EXISTS idx_skill_usage_skill ON skill_usage(skillId);
    `);
  }

  /**
   * Record user feedback
   */
  recordFeedback(feedback: Omit<Feedback, 'id' | 'timestamp'>): string {
    const id = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();

    this.db
      .prepare(
        `INSERT INTO user_feedback (id, sessionId, messageId, rating, comment, correctedResponse, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, feedback.sessionId, feedback.messageId, feedback.rating, feedback.comment || null, feedback.correctedResponse || null, timestamp);

    logger.info(`Feedback recorded: ${id} (rating: ${feedback.rating}/5)`);
    this.emit('feedback-received', { id, ...feedback, timestamp });

    // Analyze feedback for improvement suggestions
    if (feedback.rating <= 2) {
      this.analyzeLowRating(feedback);
    }

    return id;
  }

  /**
   * Record performance metric
   */
  recordMetric(metric: Omit<PerformanceMetric, 'id' | 'timestamp'>): void {
    const id = `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();

    this.db
      .prepare(
        `INSERT INTO performance_metrics (id, type, value, context, timestamp)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, metric.type, metric.value, JSON.stringify(metric.context), timestamp);

    this.emit('metric-recorded', { id, ...metric, timestamp });
  }

  /**
   * Record skill usage
   */
  recordSkillUsage(skillId: string, success: boolean, responseTime?: number, error?: string): void {
    this.db
      .prepare(
        `INSERT INTO skill_usage (skillId, success, responseTime, error, timestamp)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(skillId, success ? 1 : 0, responseTime || null, error || null, Date.now());

    logger.info(`Skill usage recorded: ${skillId} (success: ${success})`);
  }

  /**
   * Get skill statistics
   */
  getSkillStats(skillId: string): SkillStats | null {
    const stats = this.db
      .prepare(
        `SELECT
           COUNT(*) as totalCalls,
           AVG(CASE WHEN success = 1 THEN 1.0 ELSE 0.0 END) as successRate,
           AVG(responseTime) as avgResponseTime,
           MAX(timestamp) as lastUsed
         FROM skill_usage
         WHERE skillId = ?`
      )
      .get(skillId) as any;

    if (!stats || stats.totalCalls === 0) return null;

    return {
      skillId,
      totalCalls: stats.totalCalls,
      successRate: stats.successRate,
      avgResponseTime: stats.avgResponseTime || 0,
      lastUsed: stats.lastUsed
    };
  }

  /**
   * Get all skill statistics
   */
  getAllSkillStats(): SkillStats[] {
    const skillIds = this.db
      .prepare('SELECT DISTINCT skillId FROM skill_usage')
      .all() as { skillId: string }[];

    return skillIds
      .map(row => this.getSkillStats(row.skillId))
      .filter((stats): stats is SkillStats => stats !== null);
  }

  /**
   * Get average user satisfaction
   */
  getAverageRating(timeRange?: { start: number; end: number }): number {
    let query = 'SELECT AVG(rating) as avgRating FROM user_feedback';
    const params: any[] = [];

    if (timeRange) {
      query += ' WHERE timestamp BETWEEN ? AND ?';
      params.push(timeRange.start, timeRange.end);
    }

    const result = this.db.prepare(query).get(...params) as { avgRating: number };
    return result.avgRating || 0;
  }

  /**
   * Analyze low rating feedback
   */
  private analyzeLowRating(feedback: Omit<Feedback, 'id' | 'timestamp'>): void {
    // Check for patterns in low ratings
    const recentLowRatings = this.db
      .prepare(
        `SELECT * FROM user_feedback
         WHERE rating <= 2 AND timestamp > ?
         ORDER BY timestamp DESC LIMIT 10`
      )
      .all(Date.now() - 24 * 60 * 60 * 1000) as Feedback[];

    if (recentLowRatings.length >= 3) {
      this.createImprovementSuggestion({
        category: 'accuracy',
        description: `Multiple low ratings detected (${recentLowRatings.length} in last 24h). Review response quality.`,
        priority: 'high',
        dataPoints: recentLowRatings
      });
    }
  }

  /**
   * Create improvement suggestion
   */
  createImprovementSuggestion(suggestion: Omit<ImprovementSuggestion, 'timestamp'>): void {
    this.db
      .prepare(
        `INSERT INTO improvement_suggestions (category, description, priority, dataPoints, timestamp)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(suggestion.category, suggestion.description, suggestion.priority, JSON.stringify(suggestion.dataPoints), Date.now());

    logger.info(`Improvement suggestion created: ${suggestion.category} - ${suggestion.priority}`);
    this.emit('suggestion-created', suggestion);
  }

  /**
   * Get improvement suggestions
   */
  getImprovementSuggestions(status: 'pending' | 'reviewed' | 'implemented' = 'pending'): ImprovementSuggestion[] {
    const rows = this.db
      .prepare('SELECT * FROM improvement_suggestions WHERE status = ? ORDER BY timestamp DESC')
      .all(status) as any[];

    return rows.map(row => ({
      category: row.category,
      description: row.description,
      priority: row.priority,
      dataPoints: JSON.parse(row.dataPoints),
      timestamp: row.timestamp
    }));
  }

  /**
   * Generate performance report
   */
  async generateReport(timeRange: { start: number; end: number }): Promise<string> {
    const avgRating = this.getAverageRating(timeRange);

    const feedbackCount = (this.db
      .prepare('SELECT COUNT(*) as count FROM user_feedback WHERE timestamp BETWEEN ? AND ?')
      .get(timeRange.start, timeRange.end) as any).count;

    const skillStats = this.getAllSkillStats();
    const topSkills = skillStats
      .sort((a, b) => b.totalCalls - a.totalCalls)
      .slice(0, 5);

    const suggestions = this.getImprovementSuggestions('pending');

    const report = [
      '=== Self-Learning Performance Report ===',
      `Period: ${new Date(timeRange.start).toISOString()} to ${new Date(timeRange.end).toISOString()}`,
      '',
      '--- User Satisfaction ---',
      `Average Rating: ${avgRating.toFixed(2)}/5.0`,
      `Total Feedback: ${feedbackCount}`,
      '',
      '--- Top Skills ---'
    ];

    topSkills.forEach((skill, i) => {
      report.push(
        `${i + 1}. ${skill.skillId}`,
        `   Calls: ${skill.totalCalls}`,
        `   Success Rate: ${(skill.successRate * 100).toFixed(1)}%`,
        `   Avg Response Time: ${skill.avgResponseTime.toFixed(0)}ms`
      );
    });

    if (suggestions.length > 0) {
      report.push('', '--- Pending Improvements ---');
      suggestions.forEach((s, i) => {
        report.push(`${i + 1}. [${s.priority.toUpperCase()}] ${s.category}: ${s.description}`);
      });
    }

    return report.join('\n');
  }

  /**
   * Export learning data
   */
  exportData(): {
    feedback: Feedback[];
    metrics: PerformanceMetric[];
    skillStats: SkillStats[];
    suggestions: ImprovementSuggestion[];
  } {
    const feedback = this.db.prepare('SELECT * FROM user_feedback ORDER BY timestamp DESC').all() as Feedback[];

    const metrics = this.db
      .prepare('SELECT * FROM performance_metrics ORDER BY timestamp DESC')
      .all()
      .map((row: any) => ({
        ...row,
        context: JSON.parse(row.context)
      })) as PerformanceMetric[];

    const skillStats = this.getAllSkillStats();

    const suggestions = this.db
      .prepare('SELECT * FROM improvement_suggestions ORDER BY timestamp DESC')
      .all()
      .map((row: any) => ({
        category: row.category,
        description: row.description,
        priority: row.priority,
        dataPoints: JSON.parse(row.dataPoints),
        timestamp: row.timestamp
      })) as ImprovementSuggestion[];

    return { feedback, metrics, skillStats, suggestions };
  }
}
