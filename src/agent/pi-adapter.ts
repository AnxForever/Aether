/**
 * Pi-Agent-Core Adapter
 *
 * 将 Nexus-Agent 的现有 Orchestrator 适配到 pi-agent-core 框架
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
 * Pi-Agent 适配器配置
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
 * Pi-Agent 适配器
 *
 * 提供与现有 Nexus Orchestrator 兼容的接口
 */
export class PiAgentAdapter extends EventEmitter {
  private context: AgentContext;
  private config: AgentLoopConfig;
  private abortController?: AbortController;

  constructor(config: PiAdapterConfig) {
    super();

    // 初始化 context
    this.context = {
      systemPrompt: config.systemPrompt,
      messages: [],
      tools: config.tools,
    };

    // 初始化 agent loop config
    this.config = {
      model: config.model,
      maxTokens: config.maxTokens,
      temperature: config.temperature,

      // 消息转换：AgentMessage[] -> Message[]
      convertToLlm: async (messages: AgentMessage[]): Promise<Message[]> => {
        return messages.filter(this.isLlmMessage) as Message[];
      },

      // API key 解析
      getApiKey: config.getApiKey,

      // 工具执行模式：并行
      toolExecution: 'parallel',

      // 工具调用前钩子：权限检查
      beforeToolCall: async (context: BeforeToolCallContext) => {
        logger.debug(`Tool call before: ${context.toolCall.name}`, context.toolCall.arguments);

        // 触发权限检查事件
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

      // 工具调用后钩子：结果处理
      afterToolCall: async (context: AfterToolCallContext) => {
        logger.debug(`Tool call after: ${context.toolCall.name}`, {
          isError: context.isError,
        });

        // 可以在这里修改工具结果
        return undefined;
      },

      // 每轮结束后检查是否应该停止
      shouldStopAfterTurn: async (context: ShouldStopAfterTurnContext) => {
        // 检查 token 限制
        if (this.context.messages.length > 100) {
          logger.warn('Message limit reached, stopping agent');
          return true;
        }

        return false;
      },

      // 转向消息（用户中断）
      getSteeringMessages: async () => {
        // 检查是否有待处理的用户消息
        const pending = await this.getPendingUserMessages();
        return pending;
      },

      // 后续消息（agent 完成后继续）
      getFollowUpMessages: async () => {
        return [];
      },
    };

    logger.info('Pi-Agent adapter initialized');
  }

  /**
   * 执行 agent prompt
   */
  async execute(prompt: string): Promise<AgentMessage[]> {
    logger.info('Starting agent execution');

    // 创建用户消息
    const userMessage: AgentMessage = {
      role: 'user',
      content: [{ type: 'text', text: prompt }],
      timestamp: Date.now(),
    };

    // 创建 abort controller
    this.abortController = new AbortController();

    try {
      // 启动 agent loop
      const stream = agentLoop(
        [userMessage],
        this.context,
        this.config,
        this.abortController.signal
      );

      // 处理事件流
      for await (const event of stream) {
        this.handleAgentEvent(event);
      }

      // 获取结果
      const result = await stream.result();

      // 更新 context
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
   * 继续执行（从上次中断处）
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
   * 中止当前执行
   */
  abort(): void {
    if (this.abortController) {
      logger.info('Aborting agent execution');
      this.abortController.abort();
    }
  }

  /**
   * 添加工具
   */
  addTool(tool: AgentTool<any>): void {
    if (!this.context.tools) {
      this.context.tools = [];
    }
    this.context.tools.push(tool);
    logger.debug(`Tool added: ${tool.name}`);
  }

  /**
   * 移除工具
   */
  removeTool(toolName: string): void {
    if (this.context.tools) {
      this.context.tools = this.context.tools.filter(t => t.name !== toolName);
      logger.debug(`Tool removed: ${toolName}`);
    }
  }

  /**
   * 获取消息历史
   */
  getMessages(): AgentMessage[] {
    return [...this.context.messages];
  }

  /**
   * 清空消息历史
   */
  clearMessages(): void {
    this.context.messages = [];
    logger.debug('Messages cleared');
  }

  /**
   * 更新系统提示词
   */
  updateSystemPrompt(prompt: string): void {
    this.context.systemPrompt = prompt;
    logger.debug('System prompt updated');
  }

  /**
   * 处理 agent 事件
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
   * 检查工具权限
   */
  private async checkToolPermission(
    toolName: string,
    args: any
  ): Promise<boolean> {
    // 触发权限检查事件，等待外部处理
    return new Promise(resolve => {
      this.emit('permission-check', { toolName, args }, (allowed: boolean) => {
        resolve(allowed);
      });

      // 默认超时 30 秒后允许
      setTimeout(() => resolve(true), 30000);
    });
  }

  /**
   * 获取待处理的用户消息
   */
  private async getPendingUserMessages(): Promise<AgentMessage[]> {
    // 触发事件获取待处理消息
    return new Promise(resolve => {
      this.emit('get-pending-messages', (messages: AgentMessage[]) => {
        resolve(messages);
      });

      // 默认返回空数组
      setTimeout(() => resolve([]), 100);
    });
  }

  /**
   * 判断是否是 LLM 消息
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
 * 将 Nexus 工具转换为 pi-agent-core 工具
 */
export function convertNexusToolToPiTool(
  nexusTool: any
): AgentTool<any> {
  return {
    name: nexusTool.name,
    label: nexusTool.description || nexusTool.name,
    description: nexusTool.description || '',
    parameters: nexusTool.parameters || { type: 'object', properties: {} },

    execute: async (
      toolCallId: string,
      params: any,
      signal?: AbortSignal
    ): Promise<AgentToolResult<any>> => {
      try {
        const result = await nexusTool.execute(params, signal);

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
