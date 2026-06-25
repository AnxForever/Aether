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
  skillRegistry?: any; // Optional skill registry for tool execution
  learningIntegration?: any; // Optional learning integration
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
    const { aiResponse, skillRegistry, learningIntegration } = context;

    // Check for tool calls
    if (!aiResponse.toolCalls || aiResponse.toolCalls.length === 0) {
      return context;
    }

    // If no skill registry provided, skip tool execution
    if (!skillRegistry) {
      logger.warn('Tool execution requested but no skillRegistry provided');
      return context;
    }

    const toolResults: Array<{ id: string; result: any; error?: string }> = [];

    // Execute each tool call
    for (const toolCall of aiResponse.toolCalls) {
      const startTime = Date.now();
      let success = false;
      let error: string | undefined;

      try {
        logger.info(`Executing tool: ${toolCall.name}`, { args: toolCall.arguments });

        // Find tool in skill registry
        const tool = skillRegistry.findTool(toolCall.name);

        if (!tool) {
          error = `Tool '${toolCall.name}' not found`;
          logger.error(error);
          toolResults.push({
            id: toolCall.id,
            result: null,
            error
          });
          continue;
        }

        // Execute tool handler
        const result = await tool.handler(toolCall.arguments, {
          sessionId: context.cycle.sessionId || 'unknown',
          userId: context.cycle.userId,
          workingDir: process.cwd(),
          env: process.env as Record<string, string>
        });

        success = !result.error;
        error = result.error;

        toolResults.push({
          id: toolCall.id,
          result: result.data,
          error: result.error
        });

        logger.info(`Tool execution completed: ${toolCall.name}`, {
          success
        });

      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        logger.error(`Tool execution failed: ${toolCall.name}`, err instanceof Error ? err : new Error(String(err)));
        toolResults.push({
          id: toolCall.id,
          result: null,
          error
        });
      } finally {
        // Record skill usage to learning system
        if (learningIntegration) {
          const responseTime = Date.now() - startTime;
          learningIntegration.recordSkillUsage(
            toolCall.name,
            success,
            responseTime,
            error
          ).catch((err: Error) => {
            logger.error('Failed to record skill usage:', err);
          });
        }
      }
    }

    return {
      ...context,
      toolResults
    };
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
