/**
 * MCP Example
 *
 * 演示如何使用 Model Context Protocol
 */

import { MCPServerManager, type MCPServerConfig } from './mcp-server-manager';
import { createLogger } from '../utils/logger';

const logger = createLogger('MCPExample');

/**
 * 示例：启动基础 MCP 服务器
 */
export async function exampleBasicServer() {
  const manager = new MCPServerManager();

  // 配置服务器（示例：假设有一个 mcp-server 命令）
  const config: MCPServerConfig = {
    name: 'example-server',
    command: 'node',
    args: ['./mcp-server.js'],
  };

  try {
    // 启动服务器
    await manager.startServer(config);

    logger.info('Server started successfully');

    // 发现工具
    const tools = await manager.discoverTools();
    logger.info(`Discovered ${tools.length} tools:`, tools.map(t => t.name));

    // 停止服务器
    await manager.stopServer('example-server');

    logger.info('Server stopped');
  } catch (error: any) {
    logger.error('Example failed:', error);
  }
}

/**
 * 示例：多个 MCP 服务器
 */
export async function exampleMultipleServers() {
  const manager = new MCPServerManager();

  const servers: MCPServerConfig[] = [
    {
      name: 'filesystem',
      command: 'mcp-server-filesystem',
      args: ['--root', '/tmp'],
    },
    {
      name: 'github',
      command: 'mcp-server-github',
      env: {
        GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
      },
    },
    {
      name: 'postgres',
      command: 'mcp-server-postgres',
      env: {
        DATABASE_URL: process.env.DATABASE_URL || '',
      },
    },
  ];

  try {
    // 启动所有服务器
    for (const config of servers) {
      await manager.startServer(config);
    }

    logger.info(`Started ${servers.length} servers`);

    // 列出服务器
    const running = manager.listServers();
    logger.info('Running servers:', running);

    // 发现所有工具
    const tools = await manager.discoverTools();
    logger.info(`Total tools: ${tools.length}`);

    // 按服务器分组
    const byServer = tools.reduce((acc, tool) => {
      if (!acc[tool.serverName]) {
        acc[tool.serverName] = [];
      }
      acc[tool.serverName].push(tool.name);
      return acc;
    }, {} as Record<string, string[]>);

    logger.info('Tools by server:', byServer);

    // 停止所有
    await manager.stopAll();

    logger.info('All servers stopped');
  } catch (error: any) {
    logger.error('Example failed:', error);
  }
}

/**
 * 示例：与 pi-agent 集成
 */
export async function exampleIntegrationWithAgent() {
  const manager = new MCPServerManager();

  // 启动 MCP 服务器
  await manager.startServer({
    name: 'example',
    command: 'mcp-server-example',
  });

  // 转换为 AgentTool
  const tools = await manager.toAgentTools();

  logger.info(`Converted ${tools.length} MCP tools to AgentTool`);

  for (const tool of tools) {
    logger.info(`  - ${tool.name}: ${tool.description}`);
  }

  // 可以传递给 PiAgentAdapter
  // const adapter = new PiAgentAdapter({
  //   systemPrompt: 'You are a helpful assistant.',
  //   model: { provider: 'anthropic', name: 'claude-3-5-sonnet-20241022' },
  //   tools,
  // });

  await manager.stopAll();
}

/**
 * 示例：事件监听
 */
export async function exampleEventListening() {
  const manager = new MCPServerManager();

  // 监听事件
  manager.on('server-started', (name) => {
    logger.info(`Event: Server started - ${name}`);
  });

  manager.on('server-stopped', (name) => {
    logger.info(`Event: Server stopped - ${name}`);
  });

  // 启动和停止
  await manager.startServer({
    name: 'test',
    command: 'mcp-server-test',
  });

  await manager.stopServer('test');
}

/**
 * 示例：错误处理
 */
export async function exampleErrorHandling() {
  const manager = new MCPServerManager();

  try {
    // 尝试启动不存在的服务器
    await manager.startServer({
      name: 'nonexistent',
      command: 'nonexistent-command',
    });
  } catch (error: any) {
    logger.error('Expected error:', error.message);
  }

  try {
    // 尝试停止不存在的服务器
    await manager.stopServer('nonexistent');
  } catch (error: any) {
    logger.error('Expected error:', error.message);
  }

  try {
    // 尝试重复启动
    await manager.startServer({
      name: 'duplicate',
      command: 'echo',
      args: ['test'],
    });

    await manager.startServer({
      name: 'duplicate',
      command: 'echo',
      args: ['test'],
    });
  } catch (error: any) {
    logger.error('Expected error:', error.message);
    await manager.stopAll();
  }
}

/**
 * 运行所有示例
 */
export async function runAllMCPExamples() {
  logger.info('=== Example 1: Basic Server ===');
  await exampleBasicServer().catch(e => logger.warn('Skipped:', e.message));

  logger.info('\n=== Example 2: Multiple Servers ===');
  await exampleMultipleServers().catch(e => logger.warn('Skipped:', e.message));

  logger.info('\n=== Example 3: Integration with Agent ===');
  await exampleIntegrationWithAgent().catch(e => logger.warn('Skipped:', e.message));

  logger.info('\n=== Example 4: Event Listening ===');
  await exampleEventListening().catch(e => logger.warn('Skipped:', e.message));

  logger.info('\n=== Example 5: Error Handling ===');
  await exampleErrorHandling();

  logger.info('\n=== All MCP examples completed ===');
}

// 如果直接运行此文件
if (require.main === module) {
  runAllMCPExamples().catch(error => {
    logger.error('MCP examples failed:', error);
    process.exit(1);
  });
}
