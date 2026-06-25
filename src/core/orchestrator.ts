/**
 * Orchestrator - Main coordination engine
 *
 * Coordinates all agent components: connectors, tools, memory, etc.
 */

import { EventEmitter } from 'events';
import { Cycle, CycleStatus, UserInput, AgentContext, Message } from '../types';
import { Pipeline } from './pipeline';
import { CycleManager } from './cycle-manager';
import { connectorRegistry } from '../connectors';
import { randomUUID } from 'crypto';
import { LearningIntegration } from './learning-integration';
import { SkillCreator } from '../learning/skill-creator';
import { SkillCreatorIntegration } from './skill-creator-integration';
import { WorkflowIntegration } from './workflow-integration';
import { skillRegistry } from '../skills/registry';
import { createLogger } from '../utils/logger';
import { join } from 'path';

const logger = createLogger('Orchestrator');

export interface OrchestratorConfig {
  defaultModel: string;
  defaultProvider: string;
  maxConcurrentCycles: number;
  dataDir?: string;
  enableLearning?: boolean;
  enableWorkflows?: boolean;
}

export class Orchestrator extends EventEmitter {
  private pipeline: Pipeline;
  private cycleManager: CycleManager;
  private config: OrchestratorConfig;
  private activeCycles: Map<string, Cycle> = new Map();
  private learningIntegration?: LearningIntegration;
  private skillCreatorIntegration?: SkillCreatorIntegration;
  private workflowIntegration?: WorkflowIntegration;

  constructor(config: OrchestratorConfig) {
    super();
    this.config = config;
    this.pipeline = new Pipeline();
    this.cycleManager = new CycleManager();

    // Initialize learning integration if enabled
    if (config.enableLearning !== false && config.dataDir) {
      this.learningIntegration = new LearningIntegration({
        dataDir: config.dataDir,
        enablePersistence: true,
        autoApplyImprovements: true,
        learningCycleInterval: 3600000 // 1 hour
      });

      this.learningIntegration.start();
      logger.info('Learning integration enabled');

      // Initialize skill creator integration
      const skillsDir = join(config.dataDir, 'skills', 'dynamic');
      const skillCreator = new SkillCreator(skillsDir);
      this.skillCreatorIntegration = new SkillCreatorIntegration(
        skillCreator,
        skillRegistry
      );
      logger.info('Skill creator integration enabled');
    }

    // Initialize workflow integration if enabled
    if (config.enableWorkflows !== false && config.dataDir) {
      this.workflowIntegration = new WorkflowIntegration({
        dataDir: config.dataDir,
        enableScheduler: true,
        autoRegisterTemplates: true
      });
      logger.info('Workflow integration enabled');
    }
  }

  /**
   * Process user input
   */
  async processInput(
    input: UserInput,
    context: AgentContext
  ): Promise<Message> {
    // Check concurrent cycle limit
    if (this.activeCycles.size >= this.config.maxConcurrentCycles) {
      throw new Error('Maximum concurrent cycles reached');
    }

    // Create cycle
    const cycle = this.cycleManager.createCycle(input, context);
    this.activeCycles.set(cycle.id, cycle);

    this.emit('cycle:start', cycle);

    try {
      // Run pipeline
      const result = await this.pipeline.execute({
        cycle,
        config: this.config,
        connectorRegistry,
        skillRegistry,
        learningIntegration: this.learningIntegration,
        skillCreatorIntegration: this.skillCreatorIntegration
      });

      // Update cycle status
      cycle.status = 'completed';
      cycle.endTime = Date.now();

      // Record to learning system
      if (this.learningIntegration) {
        await this.learningIntegration.recordCycle(cycle, result).catch(err => {
          logger.error('Failed to record cycle to learning system:', err);
        });
      }

      this.emit('cycle:complete', cycle);

      return result;
    } catch (error) {
      cycle.status = 'failed';
      cycle.endTime = Date.now();

      // Record failure to learning system
      if (this.learningIntegration) {
        await this.learningIntegration.recordCycle(cycle, null, error as Error).catch(err => {
          logger.error('Failed to record failure to learning system:', err);
        });
      }

      this.emit('cycle:error', { cycle, error });

      throw error;
    } finally {
      this.activeCycles.delete(cycle.id);
    }
  }

  /**
   * Stream response
   */
  async *streamResponse(
    input: UserInput,
    context: AgentContext
  ): AsyncIterable<string> {
    const cycle = this.cycleManager.createCycle(input, context);
    this.activeCycles.set(cycle.id, cycle);

    this.emit('cycle:start', cycle);

    try {
      // Get connector
      const connector = connectorRegistry.get(this.config.defaultProvider as any);
      if (!connector) {
        throw new Error(`Connector not found: ${this.config.defaultProvider}`);
      }

      // Build messages
      const messages: Message[] = [
        {
          id: randomUUID(),
          role: 'user',
          content: input.transcript,
          timestamp: Date.now()
        }
      ];

      // Stream from connector
      for await (const chunk of connector.streamResponse({
        model: this.config.defaultModel,
        messages,
        stream: true
      })) {
        if (chunk.type === 'text') {
          yield chunk.content;
        }
      }

      cycle.status = 'completed';
      cycle.endTime = Date.now();

      this.emit('cycle:complete', cycle);
    } catch (error) {
      cycle.status = 'failed';
      cycle.endTime = Date.now();

      this.emit('cycle:error', { cycle, error });

      throw error;
    } finally {
      this.activeCycles.delete(cycle.id);
    }
  }

  /**
   * Cancel cycle
   */
  cancelCycle(cycleId: string): void {
    const cycle = this.activeCycles.get(cycleId);
    if (cycle) {
      cycle.status = 'failed';
      this.activeCycles.delete(cycleId);
      this.emit('cycle:cancelled', cycle);
    }
  }

  /**
   * Get active cycles
   */
  getActiveCycles(): Cycle[] {
    return Array.from(this.activeCycles.values());
  }

  /**
   * Check if processing
   */
  isProcessing(): boolean {
    return this.activeCycles.size > 0;
  }

  /**
   * Get learning integration
   */
  getLearningIntegration(): LearningIntegration | undefined {
    return this.learningIntegration;
  }

  /**
   * Get workflow integration
   */
  getWorkflowIntegration(): WorkflowIntegration | undefined {
    return this.workflowIntegration;
  }

  /**
   * Record user feedback
   */
  async recordUserFeedback(
    sessionId: string,
    messageId: string,
    rating: number,
    comment?: string,
    correctedResponse?: string
  ): Promise<string | null> {
    if (!this.learningIntegration) {
      logger.warn('User feedback received but learning is not enabled');
      return null;
    }

    return await this.learningIntegration.recordUserFeedback(
      sessionId,
      messageId,
      rating,
      comment,
      correctedResponse
    );
  }

  /**
   * Get learning statistics
   */
  async getLearningStats(): Promise<any> {
    if (!this.learningIntegration) {
      return null;
    }

    return {
      feedbackLoop: this.learningIntegration.getFeedbackLoopStats(),
      currentCycle: this.learningIntegration.getCurrentCycle(),
      averageSatisfaction: await this.learningIntegration.getAverageSatisfaction()
    };
  }

  /**
   * Generate learning report
   */
  async generateLearningReport(timeRange: { start: number; end: number }): Promise<string | null> {
    if (!this.learningIntegration) {
      return null;
    }

    return await this.learningIntegration.generateReport(timeRange);
  }

  /**
   * Get skill creator integration
   */
  getSkillCreatorIntegration(): SkillCreatorIntegration | undefined {
    return this.skillCreatorIntegration;
  }

  /**
   * Create skill from description
   */
  async createSkill(description: string): Promise<{
    success: boolean;
    skillId?: string;
    error?: string;
  }> {
    if (!this.skillCreatorIntegration) {
      return {
        success: false,
        error: 'Skill creator not enabled. Enable learning to use dynamic skill creation.'
      };
    }

    return await this.skillCreatorIntegration.createSkillFromRequest(description);
  }

  /**
   * Initialize orchestrator
   */
  async initialize(): Promise<void> {
    // Initialize workflow integration
    if (this.workflowIntegration) {
      await this.workflowIntegration.initialize();

      // Register workflow skill
      const { createWorkflowSkill } = await import('../workflow/workflow-skill');
      const workflowSkill = createWorkflowSkill(this.workflowIntegration);
      skillRegistry.register(workflowSkill);
      logger.info('Workflow skill registered');
    }

    logger.info('Orchestrator initialized');
  }

  /**
   * Process message (wrapper for processInput)
   */
  async processMessage(message: Message, sessionId?: string): Promise<Message> {
    const input: UserInput = {
      transcript: message.content
    };

    const context: AgentContext = {
      sessionId: sessionId || randomUUID(),
      deviceId: 'gateway',
      settings: {
        model: this.config.defaultModel,
        language: 'en',
        theme: 'dark'
      },
      capabilities: []
    };

    const response = await this.processInput(input, context);

    return response;
  }

  /**
   * Get available skills
   */
  getAvailableSkills(): any[] {
    // TODO: Implement skill registry integration
    logger.warn('getAvailableSkills not yet implemented');
    return [];
  }

  /**
   * Get specific skill
   */
  getSkill(skillId: string): any | null {
    // TODO: Implement skill registry integration
    logger.warn('getSkill not yet implemented');
    return null;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.learningIntegration) {
      this.learningIntegration.stop();
    }

    if (this.workflowIntegration) {
      await this.workflowIntegration.cleanup();
    }
  }
}
