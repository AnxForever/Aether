/**
 * Pipeline - Multi-stage processing pipeline
 *
 * Processes agent cycles through multiple stages
 */

import { Cycle, Message, PipelineStage } from '../types';
import { randomUUID } from 'crypto';
import { createLogger } from '../utils/logger';

const logger = createLogger('Pipeline');

export interface PipelineContext {
  cycle: Cycle;
  config: any;
  connectorRegistry: any;
}

export class Pipeline {
  private stages: PipelineStage[] = [];

  constructor() {
    // Initialize stages
    this.stages = [
      { name: 'context', execute: this.contextStage.bind(this) },
      { name: 'inference', execute: this.inferenceStage.bind(this) },
      { name: 'tool-execution', execute: this.toolExecutionStage.bind(this) },
      { name: 'response', execute: this.responseStage.bind(this) }
    ];
  }

  /**
   * Execute pipeline
   */
  async execute(context: PipelineContext): Promise<Message> {
    let data: any = context;

    for (const stage of this.stages) {
      try {
        data = await stage.execute(data);
      } catch (error) {
        logger.error(`Pipeline stage '${stage.name}' failed:`, error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    }

    return data;
  }

  /**
   * Stage 1: Context preparation
   */
  private async contextStage(context: PipelineContext): Promise<any> {
    const { cycle } = context;

    // Build message history
    const messages: Message[] = [
      {
        id: randomUUID(),
        role: 'user',
        content: cycle.input.transcript,
        timestamp: Date.now()
      }
    ];

    return {
      ...context,
      messages
    };
  }

  /**
   * Stage 2: AI inference
   */
  private async inferenceStage(context: any): Promise<any> {
    const { config, connectorRegistry, messages } = context;

    // Get connector
    const connector = connectorRegistry.get(config.defaultProvider);
    if (!connector) {
      throw new Error(`Connector not found: ${config.defaultProvider}`);
    }

    // Get response
    const response = await connector.getResponse({
      model: config.defaultModel,
      messages
    });

    return {
      ...context,
      aiResponse: response
    };
  }

  /**
   * Stage 3: Tool execution (if needed)
   */
  private async toolExecutionStage(context: any): Promise<any> {
    const { aiResponse } = context;

    // Check for tool calls
    if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
      // TODO: Execute tools
      logger.warn('Tool execution not yet implemented');
    }

    return context;
  }

  /**
   * Stage 4: Response formatting
   */
  private async responseStage(context: any): Promise<Message> {
    const { aiResponse } = context;

    return {
      id: randomUUID(),
      role: 'assistant',
      content: aiResponse.content,
      timestamp: Date.now(),
      metadata: {
        finishReason: aiResponse.finishReason,
        usage: aiResponse.usage
      }
    };
  }

  /**
   * Add custom stage
   */
  addStage(stage: PipelineStage): void {
    this.stages.push(stage);
  }

  /**
   * Get stages
   */
  getStages(): PipelineStage[] {
    return [...this.stages];
  }
}
