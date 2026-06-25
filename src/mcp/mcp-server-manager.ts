/**
 * MCP Server Manager - Model Context Protocol integration
 *
 * 管理 MCP 服务器的启动、停止和工具发现
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';
import { spawn, type ChildProcess } from 'child_process';
import type { AgentTool } from '@earendil-works/pi-agent-core';

const logger = createLogger('MCPManager');

/**
 * MCP 服务器配置
 */
export interface MCPServerConfig {
  /** 服务器名称 */
  name: string;
  /** 命令 */
  command: string;
  /** 参数 */
  args?: string[];
  /** 环境变量 */
  env?: Record<string, string>;
  /** 工作目录 */
  cwd?: string;
}

/**
 * MCP 工具信息
 */
export interface MCPToolInfo {
  name: string;
  description?: string;
  inputSchema: any;
  serverName: string;
}

/**
 * MCP 服务器管理器
 */
export class MCPServerManager extends EventEmitter {
  private servers = new Map<string, MCPServerInstance>();

  /**
   * 启动 MCP 服务器
   */
  async startServer(config: MCPServerConfig): Promise<void> {
    if (this.servers.has(config.name)) {
      throw new Error(`Server already running: ${config.name}`);
    }

    logger.info(`Starting MCP server: ${config.name}`);

    const instance = new MCPServerInstance(config);
    await instance.start();

    this.servers.set(config.name, instance);

    logger.info(`MCP server started: ${config.name}`);
    this.emit('server-started', config.name);
  }

  /**
   * 停止 MCP 服务器
   */
  async stopServer(name: string): Promise<void> {
    const instance = this.servers.get(name);
    if (!instance) {
      throw new Error(`Server not found: ${name}`);
    }

    logger.info(`Stopping MCP server: ${name}`);

    await instance.stop();
    this.servers.delete(name);

    logger.info(`MCP server stopped: ${name}`);
    this.emit('server-stopped', name);
  }

  /**
   * 停止所有服务器
   */
  async stopAll(): Promise<void> {
    const names = Array.from(this.servers.keys());

    for (const name of names) {
      await this.stopServer(name);
    }
  }

  /**
   * 获取服务器实例
   */
  getServer(name: string): MCPServerInstance | undefined {
    return this.servers.get(name);
  }

  /**
   * 列出所有服务器
   */
  listServers(): string[] {
    return Array.from(this.servers.keys());
  }

  /**
   * 发现所有工具
   */
  async discoverTools(): Promise<MCPToolInfo[]> {
    const allTools: MCPToolInfo[] = [];

    for (const [serverName, instance] of this.servers) {
      try {
        const tools = await instance.listTools();

        for (const tool of tools) {
          allTools.push({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            serverName,
          });
        }
      } catch (error: any) {
        logger.error(`Failed to discover tools from ${serverName}:`, error as Error);
      }
    }

    logger.info(`Discovered ${allTools.length} MCP tools`);

    return allTools;
  }

  /**
   * 转换为 AgentTool
   */
  async toAgentTools(): Promise<AgentTool[]> {
    const mcpTools = await this.discoverTools();
    const agentTools: AgentTool[] = [];

    for (const tool of mcpTools) {
      agentTools.push({
        name: `${tool.serverName}:${tool.name}`,
        label: tool.name,
        description: tool.description || '',
        parameters: tool.inputSchema,

        execute: async (toolCallId, params, signal) => {
          try {
            const server = this.servers.get(tool.serverName);
            if (!server) {
              throw new Error(`Server not found: ${tool.serverName}`);
            }

            const result = await server.callTool(tool.name, params);

            return {
              content: [
                {
                  type: 'text',
                  text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
                },
              ],
              details: result,
            };
          } catch (error: any) {
            logger.error(`MCP tool execution failed: ${tool.name}`, error as Error);

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
      });
    }

    return agentTools;
  }
}

/**
 * MCP 服务器实例
 */
class MCPServerInstance {
  private config: MCPServerConfig;
  private client?: Client;
  private transport?: StdioClientTransport;
  private process?: ChildProcess;

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    // Spawn 服务器进程
    this.process = spawn(this.config.command, this.config.args || [], {
      cwd: this.config.cwd,
      env: {
        ...process.env,
        ...this.config.env,
      },
    });

    // 创建 stdio transport
    this.transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args,
      env: this.config.env,
    });

    // 创建 client
    this.client = new Client(
      {
        name: 'aether',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    // 连接
    await this.client.connect(this.transport);

    logger.debug(`MCP server connected: ${this.config.name}`);
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = undefined;
    }

    if (this.transport) {
      await this.transport.close();
      this.transport = undefined;
    }

    if (this.process) {
      this.process.kill();
      this.process = undefined;
    }

    logger.debug(`MCP server stopped: ${this.config.name}`);
  }

  /**
   * 列出工具
   */
  async listTools(): Promise<any[]> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    const response = await this.client.listTools();
    return response.tools;
  }

  /**
   * 调用工具
   */
  async callTool(name: string, params: any): Promise<any> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    const response = await this.client.callTool({
      name,
      arguments: params,
    });

    return response.content;
  }

  /**
   * 列出资源
   */
  async listResources(): Promise<any[]> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    const response = await this.client.listResources();
    return response.resources;
  }

  /**
   * 读取资源
   */
  async readResource(uri: string): Promise<any> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    const response = await this.client.readResource({ uri });
    return response.contents;
  }
}
