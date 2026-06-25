/**
 * Pi-Agent-Core Adapter
 *
 * Adapts the existing Aether-Agent Orchestrator to the pi-agent-core framework
 */

import {
  agentLoop,
  agentLoopContinue,
  type AgentContext,
  type AgentLoopConfig,
  type AgentMessage,
  type AgentTool,
  type AgentToolResult,
  type AgentEvent,
  type BeforeToolCallContext,
  type AfterToolCallContext,
  type ShouldStopAfterTurnContext,
} from '@earendil-works/pi-agent-core';
import { type Model, type Message } from '@earendil-works/pi-ai';
import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';

const logger = createLogger('PiAdapter');

/**
 * Pi-Agent adapter configuration
 */
export interface PiAdapterConfig {
  systemPrompt: string;
  model: Model<any>;
  tools: AgentTool<any>[];
  maxTokens?: number;
  temperature?: number;
  getApiKey?: (provider: string) => Promise<string | undefined>;
}

/**
 * Pi-Agent adapter
 *
 * Provides an interface compatible with the existing Aether Orchestrator
 */
export class PiAgentAdapter extends EventEmitter {
  private context: AgentContext;
  private config: AgentLoopConfig;
  private abortController?: AbortController;

  constructor(config: PiAdapterConfig) {
    super();

    // Initialize context
    this.context = {
      systemPrompt: config.systemPrompt,
      messages: [],
      tools: config.tools,
    };

    // Initialize agent loop config
    this.config = {
      model: config.model,
      maxTokens: config.maxTokens,
      temperature: config.temperature,

      // Message conversion: AgentMessage[] -> Message[]
      convertToLlm: async (messages: AgentMessage[]): Promise<Message[]> => {
        return messages.filter(this.isLlmMessage) as Message[];
      },

      // API key resolution
      getApiKey: config.getApiKey,

      // Tool execution mode: parallel
      toolExecution: 'parallel',

      // Pre-tool-call hook: permission check
      beforeToolCall: async (context: BeforeToolCallContext) => {
        logger.debug(`Tool call before: ${context.toolCall.name}`, context.toolCall.arguments);

        // Trigger permission check event
        const allowed = await this.checkToolPermission(
          context.toolCall.name,
          context.toolCall.arguments as Record<string, any> | undefined
        );

        if (!allowed) {
          return {
            block: true,
            reason: `Tool ${context.toolCall.name} blocked by permission system`,
          };
        }

        return undefined;
      },

      // Post-tool-call hook: result handling
      afterToolCall: async (context: AfterToolCallContext) => {
        logger.debug(`Tool call after: ${context.toolCall.name}`, {
          isError: context.isError,
        });

        // Tool results can be modified here
        return undefined;
      },

      // Check whether to stop after each turn
      shouldStopAfterTurn: async (context: ShouldStopAfterTurnContext) => {
        // Check token limit
        if (this.context.messages.length > 100) {
          logger.warn('Message limit reached, stopping agent');
          return true;
        }

        return false;
      },

      // Steering messages (user interruption)
      getSteeringMessages: async () => {
        // Check for pending user messages
        const pending = await this.getPendingUserMessages();
        return pending;
      },

      // Follow-up messages (continue after agent completion)
      getFollowUpMessages: async () => {
        return [];
      },
    };

    logger.info('Pi-Agent adapter initialized');
  }

  /**
   * Execute agent prompt
   */
  async execute(prompt: string): Promise<AgentMessage[]> {
    logger.info('Starting agent execution');

    // Create user message
    const userMessage: AgentMessage = {
      role: 'user',
      content: [{ type: 'text', text: prompt }],
      timestamp: Date.now(),
    };

    // Create abort controller
    this.abortController = new AbortController();

    try {
      // Start agent loop
      const stream = agentLoop(
        [userMessage],
        this.context,
        this.config,
        this.abortController.signal
      );

      // Process event stream
      for await (const event of stream) {
        this.handleAgentEvent(event);
      }

      // Get result
      const result = await stream.result();

      // Update context
      this.context.messages.push(...result);

      logger.info(`Agent execution completed, ${result.length} messages`);

      return result;
    } catch (error: any) {
      logger.error('Agent execution failed:', error as Error);
      throw error;
    } finally {
      this.abortController = undefined;
    }
  }

  /**
   * Continue execution (from last interruption)
   */
  async continue(): Promise<AgentMessage[]> {
    logger.info('Continuing agent execution');

    if (this.context.messages.length === 0) {
      throw new Error('Cannot continue: no messages in context');
    }

    const lastMessage = this.context.messages[this.context.messages.length - 1];
    if (lastMessage.role === 'assistant') {
      throw new Error('Cannot continue from assistant message');
    }

    this.abortController = new AbortController();

    try {
      const stream = agentLoopContinue(
        this.context,
        this.config,
        this.abortController.signal
      );

      for await (const event of stream) {
        this.handleAgentEvent(event);
      }

      const result = await stream.result();

      this.context.messages.push(...result);

      logger.info(`Agent continuation completed, ${result.length} messages`);

      return result;
    } catch (error: any) {
      logger.error('Agent continuation failed:', error as Error);
      throw error;
    } finally {
      this.abortController = undefined;
    }
  }

  /**
   * Abort current execution
   */
  abort(): void {
    if (this.abortController) {
      logger.info('Aborting agent execution');
      this.abortController.abort();
    }
  }

  /**
   * Add tool
   */
  addTool(tool: AgentTool<any>): void {
    if (!this.context.tools) {
      this.context.tools = [];
    }
    this.context.tools.push(tool);
    logger.debug(`Tool added: ${tool.name}`);
  }

  /**
   * Remove tool
   */
  removeTool(toolName: string): void {
    if (this.context.tools) {
      this.context.tools = this.context.tools.filter(t => t.name !== toolName);
      logger.debug(`Tool removed: ${toolName}`);
    }
  }

  /**
   * Get message history
   */
  getMessages(): AgentMessage[] {
    return [...this.context.messages];
  }

  /**
   * Clear message history
   */
  clearMessages(): void {
    this.context.messages = [];
    logger.debug('Messages cleared');
  }

  /**
   * Update system prompt
   */
  updateSystemPrompt(prompt: string): void {
    this.context.systemPrompt = prompt;
    logger.debug('System prompt updated');
  }

  /**
   * Handle agent event
   */
  private handleAgentEvent(event: AgentEvent): void {
    switch (event.type) {
      case 'agent_start':
        this.emit('start');
        break;

      case 'agent_end':
        this.emit('end', event.messages);
        break;

      case 'turn_start':
        this.emit('turn-start');
        break;

      case 'turn_end':
        this.emit('turn-end', {
          message: event.message,
          toolResults: event.toolResults,
        });
        break;

      case 'message_start':
        this.emit('message-start', event.message);
        break;

      case 'message_update':
        this.emit('message-update', {
          message: event.message,
          delta: event.assistantMessageEvent,
        });
        break;

      case 'message_end':
        this.emit('message-end', event.message);
        break;

      case 'tool_execution_start':
        this.emit('tool-start', {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args,
        });
        break;

      case 'tool_execution_update':
        this.emit('tool-update', {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          partialResult: event.partialResult,
        });
        break;

      case 'tool_execution_end':
        this.emit('tool-end', {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          result: event.result,
          isError: event.isError,
        });
        break;
    }
  }

  /**
   * Check tool permission
   */
  private async checkToolPermission(
    toolName: string,
    args: any
  ): Promise<boolean> {
    // Trigger permission check event, wait for external handling
    return new Promise(resolve => {
      this.emit('permission-check', { toolName, args }, (allowed: boolean) => {
        resolve(allowed);
      });

      // Default: allow after 30 second timeout
      setTimeout(() => resolve(true), 30000);
    });
  }

  /**
   * Get pending user messages
   */
  private async getPendingUserMessages(): Promise<AgentMessage[]> {
    // Trigger event to get pending messages
    return new Promise(resolve => {
      this.emit('get-pending-messages', (messages: AgentMessage[]) => {
        resolve(messages);
      });

      // Default: return empty array
      setTimeout(() => resolve([]), 100);
    });
  }

  /**
   * Check if message is an LLM message
   */
  private isLlmMessage(message: AgentMessage): message is Message {
    return (
      message.role === 'user' ||
      message.role === 'assistant' ||
      message.role === 'toolResult'
    );
  }
}

/**
 * Convert Aether tool to pi-agent-core tool
 */
export function convertAetherToolToPiTool(
  aetherTool: any
): AgentTool<any> {
  return {
    name: aetherTool.name,
    label: aetherTool.description || aetherTool.name,
    description: aetherTool.description || '',
    parameters: aetherTool.parameters || { type: 'object', properties: {} },

    execute: async (
      toolCallId: string,
      params: any,
      signal?: AbortSignal
    ): Promise<AgentToolResult<any>> => {
      try {
        const result = await aetherTool.execute(params, signal);

        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result),
            },
          ],
          details: result,
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          details: { error: error.message },
        };
      }
    },
  };
}
