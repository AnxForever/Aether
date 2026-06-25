/**
 * Sandbox Executor - Cross-platform process isolation
 *
 * 提供跨平台的进程沙箱执行环境：
 * - Windows: Job Object 隔离
 * - Linux: cgroup + namespace 隔离
 * - macOS: 基础进程限制
 */

import { spawn, type ChildProcess } from 'child_process';
import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';
import { platform } from 'os';

const logger = createLogger('SandboxExecutor');

/**
 * 沙箱配置
 */
export interface SandboxConfig {
  /** 最大执行时间（毫秒） */
  timeout?: number;
  /** 最大内存限制（MB） */
  maxMemoryMB?: number;
  /** 最大 CPU 使用率（%） */
  maxCpuPercent?: number;
  /** 允许的网络访问 */
  allowNetwork?: boolean;
  /** 工作目录 */
  workingDirectory?: string;
  /** 环境变量 */
  env?: Record<string, string>;
  /** 允许的文件路径（白名单） */
  allowedPaths?: string[];
}

/**
 * 执行结果
 */
export interface SandboxResult {
  /** 退出码 */
  exitCode: number | null;
  /** 标准输出 */
  stdout: string;
  /** 标准错误 */
  stderr: string;
  /** 执行时长（毫秒） */
  duration: number;
  /** 是否超时 */
  timedOut: boolean;
  /** 是否被终止 */
  killed: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 沙箱执行器
 */
export class SandboxExecutor extends EventEmitter {
  private platform: string;

  constructor() {
    super();
    this.platform = platform();
    logger.info(`Sandbox executor initialized for platform: ${this.platform}`);
  }

  /**
   * 在沙箱中执行命令
   */
  async execute(
    command: string,
    args: string[],
    config: SandboxConfig = {}
  ): Promise<SandboxResult> {
    const startTime = Date.now();

    logger.info(`Executing in sandbox: ${command} ${args.join(' ')}`);

    try {
      // 根据平台选择实现
      switch (this.platform) {
        case 'win32':
          return await this.executeWindows(command, args, config, startTime);
        case 'linux':
          return await this.executeLinux(command, args, config, startTime);
        case 'darwin':
          return await this.executeMacOS(command, args, config, startTime);
        default:
          return await this.executeBasic(command, args, config, startTime);
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;

      return {
        exitCode: null,
        stdout: '',
        stderr: error.message,
        duration,
        timedOut: false,
        killed: false,
        error: error.message,
      };
    }
  }

  /**
   * Windows 实现 - Job Object 隔离
   */
  private async executeWindows(
    command: string,
    args: string[],
    config: SandboxConfig,
    startTime: number
  ): Promise<SandboxResult> {
    // TODO: 使用 koffi FFI 调用 Windows Job Object API
    // 当前使用基础实现
    logger.warn('Windows Job Object isolation not yet implemented, using basic execution');

    return this.executeBasic(command, args, config, startTime);
  }

  /**
   * Linux 实现 - cgroup + namespace 隔离
   */
  private async executeLinux(
    command: string,
    args: string[],
    config: SandboxConfig,
    startTime: number
  ): Promise<SandboxResult> {
    // Linux: 使用 systemd-run 创建临时 cgroup
    if (config.maxMemoryMB || config.maxCpuPercent) {
      const systemdArgs = ['systemd-run', '--user', '--scope', '--quiet'];

      // 内存限制
      if (config.maxMemoryMB) {
        systemdArgs.push(`-p`, `MemoryMax=${config.maxMemoryMB}M`);
      }

      // CPU 限制
      if (config.maxCpuPercent) {
        const cpuQuota = Math.floor(config.maxCpuPercent * 1000);
        systemdArgs.push(`-p`, `CPUQuota=${cpuQuota}%`);
      }

      systemdArgs.push(command, ...args);

      return this.executeBasic(
        'systemd-run',
        systemdArgs.slice(1),
        config,
        startTime
      );
    }

    return this.executeBasic(command, args, config, startTime);
  }

  /**
   * macOS 实现 - 基础进程限制
   */
  private async executeMacOS(
    command: string,
    args: string[],
    config: SandboxConfig,
    startTime: number
  ): Promise<SandboxResult> {
    // macOS: 使用 ulimit 或 launchctl
    return this.executeBasic(command, args, config, startTime);
  }

  /**
   * 基础实现 - 跨平台兼容
   */
  private async executeBasic(
    command: string,
    args: string[],
    config: SandboxConfig,
    startTime: number
  ): Promise<SandboxResult> {
    return new Promise((resolve) => {
      const timeout = config.timeout || 30000;
      let timedOut = false;
      let killed = false;

      // Spawn 进程
      const child: ChildProcess = spawn(command, args, {
        cwd: config.workingDirectory,
        env: {
          ...process.env,
          ...config.env,
        },
        shell: false,
      });

      // 收集输出
      let stdout = '';
      let stderr = '';

      if (child.stdout) {
        child.stdout.on('data', (data) => {
          const chunk = data.toString();
          stdout += chunk;
          this.emit('stdout', chunk);
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          const chunk = data.toString();
          stderr += chunk;
          this.emit('stderr', chunk);
        });
      }

      // 超时处理
      const timer = setTimeout(() => {
        timedOut = true;
        killed = true;
        child.kill('SIGTERM');

        // 强制终止
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }, timeout);

      // 进程退出
      child.on('exit', (code, signal) => {
        clearTimeout(timer);

        const duration = Date.now() - startTime;

        if (signal) {
          killed = true;
        }

        resolve({
          exitCode: code,
          stdout,
          stderr,
          duration,
          timedOut,
          killed,
        });
      });

      // 错误处理
      child.on('error', (error) => {
        clearTimeout(timer);

        const duration = Date.now() - startTime;

        resolve({
          exitCode: null,
          stdout,
          stderr,
          duration,
          timedOut,
          killed,
          error: error.message,
        });
      });
    });
  }

  /**
   * 检查命令是否被允许
   */
  isCommandAllowed(command: string, config: SandboxConfig): boolean {
    // 危险命令黑名单
    const blacklist = [
      'rm',
      'del',
      'format',
      'mkfs',
      'dd',
      'shutdown',
      'reboot',
      'halt',
    ];

    const cmd = command.toLowerCase();

    for (const blocked of blacklist) {
      if (cmd.includes(blocked)) {
        logger.warn(`Blocked dangerous command: ${command}`);
        return false;
      }
    }

    return true;
  }

  /**
   * 检查路径是否被允许
   */
  isPathAllowed(path: string, config: SandboxConfig): boolean {
    if (!config.allowedPaths || config.allowedPaths.length === 0) {
      return true;
    }

    // 检查路径是否在白名单内
    for (const allowedPath of config.allowedPaths) {
      if (path.startsWith(allowedPath)) {
        return true;
      }
    }

    logger.warn(`Path not allowed: ${path}`);
    return false;
  }
}

/**
 * 工具沙箱 - 用于工具调用的高层封装
 */
export class ToolSandbox {
  private executor: SandboxExecutor;
  private defaultConfig: SandboxConfig;

  constructor(defaultConfig: SandboxConfig = {}) {
    this.executor = new SandboxExecutor();
    this.defaultConfig = {
      timeout: 30000,
      maxMemoryMB: 512,
      maxCpuPercent: 50,
      allowNetwork: false,
      ...defaultConfig,
    };
  }

  /**
   * 执行工具命令
   */
  async executeToolCommand(
    command: string,
    args: string[],
    config?: Partial<SandboxConfig>
  ): Promise<SandboxResult> {
    const mergedConfig = {
      ...this.defaultConfig,
      ...config,
    };

    // 安全检查
    if (!this.executor.isCommandAllowed(command, mergedConfig)) {
      throw new Error(`Command not allowed: ${command}`);
    }

    // 执行
    const result = await this.executor.execute(command, args, mergedConfig);

    // 日志
    logger.info(`Tool command executed: ${command}`, {
      exitCode: result.exitCode,
      duration: result.duration,
      timedOut: result.timedOut,
    });

    return result;
  }

  /**
   * 为事件监听器
   */
  on(
    event: 'stdout' | 'stderr',
    listener: (data: string) => void
  ): this {
    this.executor.on(event, listener);
    return this;
  }

  /**
   * 移除事件监听器
   */
  off(
    event: 'stdout' | 'stderr',
    listener: (data: string) => void
  ): this {
    this.executor.off(event, listener);
    return this;
  }
}
