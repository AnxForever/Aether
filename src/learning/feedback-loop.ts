/**
 * Feedback Loop - Continuous learning from interactions
 */

import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';
import { SelfImprovement, Feedback } from './self-improvement';

const logger = createLogger('FeedbackLoop');

/**
 * Interaction record
 */
export interface Interaction {
  id: string;
  timestamp: number;
  sessionId: string;
  userInput: string;
  agentResponse: string;
  responseTime: number;
  toolsUsed: string[];
  success: boolean;
}

/**
 * Learning cycle
 */
export interface LearningCycle {
  id: string;
  startTime: number;
  endTime: number;
  interactionCount: number;
  improvementsApplied: number;
  metrics: {
    averageResponseTime: number;
    successRate: number;
    userSatisfaction: number;
  };
}

/**
 * Feedback Loop System
 */
export class FeedbackLoop extends EventEmitter {
  private selfImprovement: SelfImprovement;
  private interactions: Interaction[] = [];
  private currentCycle: LearningCycle | null = null;
  private cycleHistory: LearningCycle[] = [];

  constructor(selfImprovement: SelfImprovement) {
    super();
    this.selfImprovement = selfImprovement;
  }

  /**
   * Start learning cycle
   */
  startCycle(): void {
    if (this.currentCycle) {
      this.endCycle();
    }

    this.currentCycle = {
      id: this.generateId(),
      startTime: Date.now(),
      endTime: 0,
      interactionCount: 0,
      improvementsApplied: 0,
      metrics: {
        averageResponseTime: 0,
        successRate: 0,
        userSatisfaction: 0
      }
    };

    logger.info('Learning cycle started');
    this.emit('cycle-start', this.currentCycle);
  }

  /**
   * End learning cycle
   */
  endCycle(): void {
    if (!this.currentCycle) return;

    this.currentCycle.endTime = Date.now();
    this.currentCycle.metrics = this.calculateCycleMetrics();

    this.cycleHistory.push(this.currentCycle);
    logger.info(`Learning cycle ended: ${this.currentCycle.id}`);

    this.emit('cycle-end', this.currentCycle);
    this.currentCycle = null;
  }

  /**
   * Record interaction
   */
  recordInteraction(interaction: Omit<Interaction, 'id' | 'timestamp'>): void {
    const record: Interaction = {
      id: this.generateId(),
      timestamp: Date.now(),
      ...interaction
    };

    this.interactions.push(record);

    if (this.currentCycle) {
      this.currentCycle.interactionCount++;
    }

    // Analyze interaction
    this.analyzeInteraction(record);

    this.emit('interaction', record);
  }

  /**
   * Analyze interaction for learning
   */
  private analyzeInteraction(interaction: Interaction): void {
    // Check for patterns
    if (!interaction.success) {
      // Record negative feedback
      this.selfImprovement.recordFeedback({
        type: 'negative',
        context: interaction.userInput,
        userInput: interaction.userInput,
        agentResponse: interaction.agentResponse,
        userFeedback: 'Interaction failed'
      });
    } else if (interaction.responseTime < 2000) {
      // Fast and successful - positive feedback
      this.selfImprovement.recordFeedback({
        type: 'positive',
        context: interaction.userInput,
        userInput: interaction.userInput,
        agentResponse: interaction.agentResponse,
        userFeedback: 'Fast response'
      });
    }

    // Check if improvement needed
    this.checkForImprovements();
  }

  /**
   * Check and apply improvements
   */
  private checkForImprovements(): void {
    const improvements = this.selfImprovement.getImprovements();

    for (const { pattern, suggestion } of improvements) {
      // Apply improvement
      this.selfImprovement.applyImprovement(pattern);

      if (this.currentCycle) {
        this.currentCycle.improvementsApplied++;
      }

      logger.info(`Applied improvement: ${pattern}`);
      this.emit('improvement-applied', { pattern, suggestion });
    }
  }

  /**
   * Calculate cycle metrics
   */
  private calculateCycleMetrics() {
    const cycleInteractions = this.interactions.filter(
      i => this.currentCycle && i.timestamp >= this.currentCycle.startTime
    );

    if (cycleInteractions.length === 0) {
      return {
        averageResponseTime: 0,
        successRate: 0,
        userSatisfaction: 0
      };
    }

    const totalResponseTime = cycleInteractions.reduce((sum, i) => sum + i.responseTime, 0);
    const successCount = cycleInteractions.filter(i => i.success).length;

    return {
      averageResponseTime: totalResponseTime / cycleInteractions.length,
      successRate: successCount / cycleInteractions.length,
      userSatisfaction: successCount / cycleInteractions.length // Simplified
    };
  }

  /**
   * Get cycle history
   */
  getCycleHistory(): LearningCycle[] {
    return this.cycleHistory;
  }

  /**
   * Get current cycle
   */
  getCurrentCycle(): LearningCycle | null {
    return this.currentCycle;
  }

  /**
   * Get interaction history
   */
  getInteractionHistory(limit?: number): Interaction[] {
    const history = this.interactions.slice();
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.interactions = [];
    this.cycleHistory = [];
    logger.info('Feedback loop history cleared');
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `lc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const totalInteractions = this.interactions.length;
    const successfulInteractions = this.interactions.filter(i => i.success).length;
    const averageResponseTime =
      this.interactions.reduce((sum, i) => sum + i.responseTime, 0) / totalInteractions || 0;

    return {
      totalInteractions,
      successRate: successfulInteractions / totalInteractions || 0,
      averageResponseTime,
      totalCycles: this.cycleHistory.length,
      totalImprovements: this.cycleHistory.reduce((sum, c) => sum + c.improvementsApplied, 0)
    };
  }
}
