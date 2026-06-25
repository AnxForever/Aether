/**
 * Skill System Example
 *
 * 演示如何使用 SKILL.md 技能系统
 */

import { SkillRegistry, type SkillHandler } from './skill-loader';
import { createLogger } from '../utils/logger';
import { join } from 'path';

const logger = createLogger('SkillExample');

/**
 * 示例：基础技能加载
 */
export async function exampleBasicSkillLoading() {
  const registry = new SkillRegistry(join(__dirname, '../../skills'));

  // 初始化（加载所有 SKILL.md 元数据）
  await registry.initialize();

  // 列出所有技能
  const skills = registry.getAllSkills();
  logger.info(`Loaded ${skills.length} skills:`);

  for (const skill of skills) {
    logger.info(`  - ${skill.name}: ${skill.description}`);
  }
}

/**
 * 示例：技能匹配
 */
export async function exampleSkillMatching() {
  const registry = new SkillRegistry(join(__dirname, '../../skills'));
  await registry.initialize();

  // 用户输入
  const userInput = 'send an email to john@example.com';

  // 匹配技能
  const matched = registry.matchSkills(userInput);

  logger.info(`Matched ${matched.length} skills for: "${userInput}"`);

  for (const skill of matched) {
    logger.info(`  - ${skill.name}: ${skill.description}`);
  }
}

/**
 * 示例：注册处理器
 */
export async function exampleRegisterHandler() {
  const registry = new SkillRegistry(join(__dirname, '../../skills'));
  await registry.initialize();

  // 定义计算器技能处理器
  const calculatorHandler: SkillHandler = {
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['add', 'subtract', 'multiply', 'divide'],
        },
        a: { type: 'number' },
        b: { type: 'number' },
      },
      required: ['operation', 'a', 'b'],
    },
    execute: async (params) => {
      const { operation, a, b } = params;

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
          if (b === 0) throw new Error('Division by zero');
          result = a / b;
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      return {
        operation,
        a,
        b,
        result,
        formatted: `${a} ${operation} ${b} = ${result}`,
      };
    },
  };

  // 注册处理器
  registry.registerHandler('calculator', calculatorHandler);

  // 转换为 AgentTool
  const tool = await registry.toAgentTool('calculator');

  if (tool) {
    logger.info('Calculator tool created:', {
      name: tool.name,
      description: tool.description,
    });

    // 测试执行
    const result = await tool.execute('test-1', {
      operation: 'add',
      a: 123,
      b: 456,
    });

    logger.info('Execution result:', result);
  }
}

/**
 * 示例：延迟加载处理器
 */
export async function exampleLazyLoading() {
  const registry = new SkillRegistry(join(__dirname, '../../skills'));
  await registry.initialize();

  // 注册延迟加载的处理器
  registry.registerHandlerLazy('heavy-skill', async () => {
    logger.info('Loading heavy skill handler...');

    // 模拟加载耗时操作
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      execute: async (params) => {
        return { message: 'Heavy skill executed', params };
      },
    };
  });

  logger.info('Heavy skill registered (not loaded yet)');

  // 首次调用时才加载
  const tool = await registry.toAgentTool('heavy-skill');

  if (tool) {
    logger.info('Heavy skill loaded and ready');
  }
}

/**
 * 示例：与 pi-agent 集成
 */
export async function exampleIntegrationWithPiAgent() {
  const registry = new SkillRegistry(join(__dirname, '../../skills'));
  await registry.initialize();

  // 注册一些处理器
  registry.registerHandler('echo', {
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
      required: ['message'],
    },
    execute: async (params) => {
      return { echo: params.message };
    },
  });

  registry.registerHandler('time', {
    execute: async () => {
      return {
        timestamp: Date.now(),
        iso: new Date().toISOString(),
      };
    },
  });

  // 用户输入
  const userInput = 'what time is it?';

  // 获取匹配的工具
  const tools = await registry.toAgentTools(userInput);

  logger.info(`Got ${tools.length} tools for: "${userInput}"`);

  for (const tool of tools) {
    logger.info(`  - ${tool.name}: ${tool.description}`);
  }

  // 可以将这些工具传递给 PiAgentAdapter
  // const adapter = new PiAgentAdapter({
  //   systemPrompt: 'You are a helpful assistant.',
  //   model: { provider: 'anthropic', name: 'claude-3-5-sonnet-20241022' },
  //   tools,
  // });
}

/**
 * 运行所有示例
 */
export async function runAllSkillExamples() {
  logger.info('=== Example 1: Basic Skill Loading ===');
  await exampleBasicSkillLoading();

  logger.info('\n=== Example 2: Skill Matching ===');
  await exampleSkillMatching();

  logger.info('\n=== Example 3: Register Handler ===');
  await exampleRegisterHandler();

  logger.info('\n=== Example 4: Lazy Loading ===');
  await exampleLazyLoading();

  logger.info('\n=== Example 5: Integration with Pi-Agent ===');
  await exampleIntegrationWithPiAgent();

  logger.info('\n=== All skill examples completed ===');
}

// 如果直接运行此文件
if (require.main === module) {
  runAllSkillExamples().catch(error => {
    logger.error('Skill examples failed:', error);
    process.exit(1);
  });
}
