/**
 * Pi-Agent Integration Example
 *
 * 演示如何使用 pi-agent-core 适配器
 */

import { PiAgentAdapter, convertNexusToolToPiTool } from './pi-adapter';
import { createLogger } from '../utils/logger';
import type { AgentTool } from '@earendil-works/pi-agent-core';

const logger = createLogger('PiExample');

/**
 * 示例：基础对话
 */
export async function exampleBasicChat() {
  // 创建适配器
  const adapter = new PiAgentAdapter({
    systemPrompt: 'You are a helpful assistant.',
    model: {
      provider: 'anthropic',
      name: 'claude-3-5-sonnet-20241022',
    },
    tools: [],
    getApiKey: async (provider: string) => {
      return process.env.ANTHROPIC_API_KEY;
    },
  });

  // 监听事件
  adapter.on('message-update', ({ message, delta }) => {
    if (delta.type === 'content_block_delta' && delta.delta.type === 'text_delta') {
      process.stdout.write(delta.delta.text);
    }
  });

  // 执行对话
  const messages = await adapter.execute('Hello! How are you?');

  logger.info('Chat completed', { messageCount: messages.length });
}

/**
 * 示例：带工具调用
 */
export async function exampleWithTools() {
  // 定义工具
  const calculatorTool: AgentTool = {
    name: 'calculator',
    label: 'Calculator',
    description: 'Perform basic arithmetic operations',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['add', 'subtract', 'multiply', 'divide'],
          description: 'The operation to perform',
        },
        a: {
          type: 'number',
          description: 'First number',
        },
        b: {
          type: 'number',
          description: 'Second number',
        },
      },
      required: ['operation', 'a', 'b'],
    },
    execute: async (toolCallId, params) => {
      const { operation, a, b } = params as {
        operation: 'add' | 'subtract' | 'multiply' | 'divide';
        a: number;
        b: number;
      };

      let result: number;

      switch (operation) {
        case 'add':
          result = a + b;
          break;
        case 'subtract':
          result = a - b;
          break;
        case 'multiply':
          result = a * b;
          break;
        case 'divide':
          if (b === 0) {
            return {
              content: [{ type: 'text', text: 'Error: Division by zero' }],
              details: { error: 'Division by zero' },
            };
          }
          result = a / b;
          break;
      }

      return {
        content: [
          {
            type: 'text',
            text: `${a} ${operation} ${b} = ${result}`,
          },
        ],
        details: { operation, a, b, result },
      };
    },
  };

  // 创建适配器
  const adapter = new PiAgentAdapter({
    systemPrompt: 'You are a helpful assistant with calculator capabilities.',
    model: {
      provider: 'anthropic',
      name: 'claude-3-5-sonnet-20241022',
    },
    tools: [calculatorTool],
    getApiKey: async () => process.env.ANTHROPIC_API_KEY,
  });

  // 监听工具调用
  adapter.on('tool-start', ({ toolName, args }) => {
    logger.info(`Tool called: ${toolName}`, args);
  });

  adapter.on('tool-end', ({ toolName, result, isError }) => {
    logger.info(`Tool completed: ${toolName}`, { result, isError });
  });

  // 执行对话
  const messages = await adapter.execute('What is 123 + 456?');

  logger.info('Chat with tools completed', { messageCount: messages.length });
}

/**
 * 示例：权限控制
 */
export async function exampleWithPermissions() {
  // 危险工具
  const deleteFileTool: AgentTool = {
    name: 'delete_file',
    label: 'Delete File',
    description: 'Delete a file from the filesystem',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to delete',
        },
      },
      required: ['path'],
    },
    execute: async (toolCallId, params) => {
      const { path } = params as { path: string };

      // 实际删除逻辑（这里只是模拟）
      logger.warn(`Deleting file: ${path}`);

      return {
        content: [{ type: 'text', text: `File deleted: ${path}` }],
        details: { path, deleted: true },
      };
    },
  };

  const adapter = new PiAgentAdapter({
    systemPrompt: 'You are a file management assistant.',
    model: {
      provider: 'anthropic',
      name: 'claude-3-5-sonnet-20241022',
    },
    tools: [deleteFileTool],
    getApiKey: async () => process.env.ANTHROPIC_API_KEY,
  });

  // 实现权限检查
  adapter.on('permission-check', ({ toolName, args }, callback) => {
    logger.warn(`Permission check: ${toolName}`, args);

    // 这里可以弹出 UI 让用户确认
    // 现在自动拒绝所有删除操作
    const allowed = false;

    callback(allowed);
  });

  // 执行对话
  try {
    await adapter.execute('Delete the file /tmp/test.txt');
  } catch (error) {
    logger.error('Execution failed (expected):', error);
  }
}

/**
 * 示例：中断和继续
 */
export async function exampleAbortAndContinue() {
  const adapter = new PiAgentAdapter({
    systemPrompt: 'You are a helpful assistant.',
    model: {
      provider: 'anthropic',
      name: 'claude-3-5-sonnet-20241022',
    },
    tools: [],
    getApiKey: async () => process.env.ANTHROPIC_API_KEY,
  });

  // 2 秒后中止
  setTimeout(() => {
    logger.warn('Aborting execution...');
    adapter.abort();
  }, 2000);

  try {
    await adapter.execute('Write a very long story about a cat.');
  } catch (error: any) {
    logger.info('Execution aborted (expected)');
  }

  // 继续执行
  logger.info('Continuing execution...');
  const messages = await adapter.continue();

  logger.info('Continuation completed', { messageCount: messages.length });
}

/**
 * 运行所有示例
 */
export async function runAllExamples() {
  logger.info('=== Example 1: Basic Chat ===');
  await exampleBasicChat();

  logger.info('\n=== Example 2: With Tools ===');
  await exampleWithTools();

  logger.info('\n=== Example 3: With Permissions ===');
  await exampleWithPermissions();

  logger.info('\n=== Example 4: Abort and Continue ===');
  await exampleAbortAndContinue();

  logger.info('\n=== All examples completed ===');
}

// 如果直接运行此文件
if (require.main === module) {
  runAllExamples().catch(error => {
    logger.error('Examples failed:', error);
    process.exit(1);
  });
}
