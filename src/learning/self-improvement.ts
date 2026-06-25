/**
 * Self Improvement - Agent self-optimization system
 */

import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';

const logger = createLogger('SelfImprovement');

/**
 * Improvement feedback
 */
export interface Feedback {
  id: string;
  timestamp: number;
  type: 'positive' | 'negative' | 'correction';
  context: string;
  userInput: string;
  agentResponse: string;
  userFeedback: string;
  improvement?: string;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  successRate: number;
  averageResponseTime: number;
  userSatisfaction: number;
  errorRate: number;
  improvementCount: number;
}

/**
 * Self Improvement System
 */
export class SelfImprovement extends EventEmitter {
  private feedbackHistory: Feedback[] = [];
  private patterns = new Map<string, { count: number; success: number }>();
  private improvements = new Map<string, string>();

  constructor() {
    super();
  }

  /**
   * Record feedback
   */
  recordFeedback(feedback: Omit<Feedback, 'id' | 'timestamp'>): void {
    const entry: Feedback = {
      id: this.generateId(),
      timestamp: Date.now(),
      ...feedback
    };

    this.feedbackHistory.push(entry);
    logger.info(`Recorded ${feedback.type} feedback`);

    // Analyze feedback
    this.analyzeFeedback(entry);

    // Emit event
    this.emit('feedback', entry);
  }

  /**
   * Analyze feedback and extract patterns
   */
  private analyzeFeedback(feedback: Feedback): void {
    // Extract pattern from context
    const pattern = this.extractPattern(feedback.context);

    if (!this.patterns.has(pattern)) {
      this.patterns.set(pattern, { count: 0, success: 0 });
    }

    const stats = this.patterns.get(pattern)!;
    stats.count++;

    if (feedback.type === 'positive') {
      stats.success++;
    }

    // Check if pattern needs improvement
    if (stats.count >= 5 && stats.success / stats.count < 0.6) {
      this.suggestImprovement(pattern, feedback);
    }
  }

  /**
   * Extract pattern from context
   */
  private extractPattern(context: string): string {
    // Simple pattern extraction - in production, use NLP
    const words = context.toLowerCase().split(/\s+/);
    return words.slice(0, 3).join(' ');
  }

  /**
   * Suggest improvement
   */
  private suggestImprovement(pattern: string, feedback: Feedback): void {
    if (this.improvements.has(pattern)) return;

    const improvement = this.generateImprovement(pattern, feedback);
    this.improvements.set(pattern, improvement);

    logger.info(`Suggested improvement for pattern: ${pattern}`);
    this.emit('improvement', { pattern, improvement });
  }

  /**
   * Generate improvement suggestion
   */
  private generateImprovement(pattern: string, feedback: Feedback): string {
    // Analyze feedback and generate improvement
    return `When handling "${pattern}", consider: ${feedback.userFeedback}`;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const total = this.feedbackHistory.length;
    if (total === 0) {
      return {
        successRate: 0,
        averageResponseTime: 0,
        userSatisfaction: 0,
        errorRate: 0,
        improvementCount: 0
      };
    }

    const positive = this.feedbackHistory.filter(f => f.type === 'positive').length;
    const negative = this.feedbackHistory.filter(f => f.type === 'negative').length;

    return {
      successRate: positive / total,
      averageResponseTime: 0, // Calculate from actual timing data
      userSatisfaction: positive / total,
      errorRate: negative / total,
      improvementCount: this.improvements.size
    };
  }

  /**
   * Get improvement suggestions
   */
  getImprovements(): Array<{ pattern: string; suggestion: string }> {
    return Array.from(this.improvements.entries()).map(([pattern, suggestion]) => ({
      pattern,
      suggestion
    }));
  }

  /**
   * Get feedback history
   */
  getHistory(limit?: number): Feedback[] {
    const history = this.feedbackHistory.slice();
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Apply improvement
   */
  applyImprovement(pattern: string): void {
    const improvement = this.improvements.get(pattern);
    if (!improvement) {
      throw new Error(`No improvement found for pattern: ${pattern}`);
    }

    logger.info(`Applied improvement: ${pattern}`);
    this.emit('improvement-applied', { pattern, improvement });
  }

  /**
   * Clear feedback history
   */
  clearHistory(): void {
    this.feedbackHistory = [];
    this.patterns.clear();
    this.improvements.clear();
    logger.info('Feedback history cleared');
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export learning data
   */
  exportData(): {
    feedback: Feedback[];
    patterns: Array<[string, { count: number; success: number }]>;
    improvements: Array<[string, string]>;
  } {
    return {
      feedback: this.feedbackHistory,
      patterns: Array.from(this.patterns.entries()),
      improvements: Array.from(this.improvements.entries())
    };
  }

  /**
   * Import learning data
   */
  importData(data: ReturnType<typeof this.exportData>): void {
    this.feedbackHistory = data.feedback;
    this.patterns = new Map(data.patterns);
    this.improvements = new Map(data.improvements);
    logger.info('Learning data imported');
  }
}
