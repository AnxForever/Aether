/**
 * Learning Integration - Connect Self-Learning System to Orchestrator
 *
 * This module integrates both SelfLearningSystem (persistent) and FeedbackLoop (in-memory)
 * into the main orchestration flow.
 */

import { EventEmitter } from 'events';
import { SelfLearningSystem } from '../learning/self-learning';
import { FeedbackLoop, Interaction } from '../learning/feedback-loop';
import { SelfImprovement } from '../learning/self-improvement';
import { createLogger } from '../utils/logger';
import { join } from 'path';
import { Cycle } from '../types';

const logger = createLogger('LearningIntegration');

export interface LearningIntegrationConfig {
  dataDir: string;
  enablePersistence?: boolean;
  autoApplyImprovements?: boolean;
  learningCycleInterval?: number; // in milliseconds
}

/**
 * Learning Integration Manager
 * Coordinates between SelfLearningSystem, FeedbackLoop, and main orchestrator
 */
export class LearningIntegration extends EventEmitter {
  private selfLearning?: SelfLearningSystem;
  private feedbackLoop: FeedbackLoop;
  private selfImprovement: SelfImprovement;
  private config: Required<LearningIntegrationConfig>;
  private cycleTimer?: NodeJS.Timeout;

  constructor(config: LearningIntegrationConfig) {
    super();

    this.config = {
      enablePersistence: true,
      autoApplyImprovements: true,
      learningCycleInterval: 3600000, // 1 hour
      ...config
    };

    // Initialize self-improvement
    this.selfImprovement = new SelfImprovement();

    // Initialize feedback loop
    this.feedbackLoop = new FeedbackLoop(this.selfImprovement);

    // Initialize persistent learning if enabled
    if (this.config.enablePersistence) {
      const dbPath = join(this.config.dataDir, 'learning.db');
      this.selfLearning = new SelfLearningSystem(dbPath);
      logger.info(`Persistent learning enabled: ${dbPath}`);
    }

    this.setupEventListeners();
  }

  /**
   * Start learning system
   */
  start(): void {
    // Start learning cycle
    this.feedbackLoop.startCycle();

    // Schedule periodic cycle rotation
    this.cycleTimer = setInterval(() => {
      this.rotateLearningCycle();
    }, this.config.learningCycleInterval);

    logger.info('Learning integration started');
    this.emit('started');
  }

  /**
   * Stop learning system
   */
  stop(): void {
    if (this.cycleTimer) {
      clearInterval(this.cycleTimer);
      this.cycleTimer = undefined;
    }

    this.feedbackLoop.endCycle();
    logger.info('Learning integration stopped');
    this.emit('stopped');
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen to feedback loop events
    this.feedbackLoop.on('improvement-applied', (data) => {
      logger.info('Improvement applied:', data);
      this.emit('improvement-applied', data);
    });

    this.feedbackLoop.on('cycle-end', (cycle) => {
      logger.info('Learning cycle ended:', {
        id: cycle.id,
        interactions: cycle.interactionCount,
        improvements: cycle.improvementsApplied,
        metrics: cycle.metrics
      });
      this.emit('cycle-completed', cycle);
    });

    // Listen to self-learning events if enabled
    if (this.selfLearning) {
      this.selfLearning.on('feedback-received', (feedback) => {
        this.emit('feedback-recorded', feedback);
      });

      this.selfLearning.on('suggestion-created', (suggestion) => {
        logger.warn('Improvement suggestion:', suggestion);
        this.emit('improvement-suggested', suggestion);
      });
    }
  }

  /**
   * Record cycle completion (called by Orchestrator)
   */
  async recordCycle(cycle: Cycle, result: any, error?: Error): Promise<void> {
    const responseTime = cycle.endTime ? cycle.endTime - cycle.startTime : 0;
    const success = cycle.status === 'completed' && !error;

    // Record to feedback loop (in-memory)
    this.feedbackLoop.recordInteraction({
      sessionId: cycle.sessionId,
      userInput: cycle.input.transcript,
      agentResponse: result?.content || '',
      responseTime,
      toolsUsed: [], // TODO: extract from cycle
      success
    });

    // Record to persistent learning
    if (this.selfLearning) {
      await this.selfLearning.recordMetric({
        type: 'response_time',
        value: responseTime,
        context: {
          sessionId: cycle.sessionId,
          status: cycle.status,
          success
        }
      });

      // Record error rate
      await this.selfLearning.recordMetric({
        type: 'error_rate',
        value: error ? 1 : 0,
        context: {
          sessionId: cycle.sessionId,
          error: error?.message
        }
      });
    }

    logger.debug('Cycle recorded for learning', {
      cycleId: cycle.id,
      responseTime,
      success
    });
  }

  /**
   * Record skill usage (called by Pipeline)
   */
  async recordSkillUsage(
    skillId: string,
    success: boolean,
    responseTime?: number,
    error?: string
  ): Promise<void> {
    if (this.selfLearning) {
      this.selfLearning.recordSkillUsage(skillId, success, responseTime, error);
    }
  }

  /**
   * Record user feedback (called by UI)
   */
  async recordUserFeedback(
    sessionId: string,
    messageId: string,
    rating: number,
    comment?: string,
    correctedResponse?: string
  ): Promise<string> {
    if (!this.selfLearning) {
      logger.warn('User feedback received but persistent learning is disabled');
      return 'feedback-memory-only';
    }

    const feedbackId = this.selfLearning.recordFeedback({
      sessionId,
      messageId,
      rating,
      comment,
      correctedResponse
    });

    logger.info('User feedback recorded', {
      feedbackId,
      rating,
      hasComment: !!comment
    });

    return feedbackId;
  }

  /**
   * Get improvement suggestions
   */
  async getImprovementSuggestions(): Promise<any[]> {
    if (!this.selfLearning) {
      return [];
    }

    return this.selfLearning.getImprovementSuggestions('pending');
  }

  /**
   * Get skill statistics
   */
  async getSkillStats(skillId?: string): Promise<any> {
    if (!this.selfLearning) {
      return null;
    }

    if (skillId) {
      return this.selfLearning.getSkillStats(skillId);
    }

    return this.selfLearning.getAllSkillStats();
  }

  /**
   * Get average user satisfaction
   */
  async getAverageSatisfaction(timeRange?: { start: number; end: number }): Promise<number> {
    if (!this.selfLearning) {
      return 0;
    }

    return this.selfLearning.getAverageRating(timeRange);
  }

  /**
   * Generate learning report
   */
  async generateReport(timeRange: { start: number; end: number }): Promise<string> {
    const feedbackStats = this.feedbackLoop.getStatistics();

    let report = `=== Learning System Report ===\n\n`;
    report += `--- In-Memory Statistics ---\n`;
    report += `Total Interactions: ${feedbackStats.totalInteractions}\n`;
    report += `Success Rate: ${(feedbackStats.successRate * 100).toFixed(1)}%\n`;
    report += `Average Response Time: ${feedbackStats.averageResponseTime.toFixed(0)}ms\n`;
    report += `Total Learning Cycles: ${feedbackStats.totalCycles}\n`;
    report += `Total Improvements: ${feedbackStats.totalImprovements}\n\n`;

    if (this.selfLearning) {
      const persistentReport = await this.selfLearning.generateReport(timeRange);
      report += `\n${persistentReport}`;
    }

    return report;
  }

  /**
   * Rotate learning cycle
   */
  private rotateLearningCycle(): void {
    logger.info('Rotating learning cycle');
    this.feedbackLoop.endCycle();
    this.feedbackLoop.startCycle();
  }

  /**
   * Export learning data
   */
  async exportData(): Promise<any> {
    const feedbackStats = this.feedbackLoop.getStatistics();
    const feedbackHistory = this.feedbackLoop.getCycleHistory();

    const data: any = {
      feedbackLoop: {
        statistics: feedbackStats,
        cycles: feedbackHistory
      }
    };

    if (this.selfLearning) {
      data.persistent = this.selfLearning.exportData();
    }

    return data;
  }

  /**
   * Get feedback loop statistics
   */
  getFeedbackLoopStats(): any {
    return this.feedbackLoop.getStatistics();
  }

  /**
   * Get current learning cycle
   */
  getCurrentCycle(): any {
    return this.feedbackLoop.getCurrentCycle();
  }
}
