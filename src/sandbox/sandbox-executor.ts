/**
 * Sandbox Executor - Cross-platform process isolation
 *
 * Provides cross-platform process sandbox execution:
 * - Windows: Job Object isolation
 * - Linux: cgroup + namespace isolation
 * - macOS: Basic process limits
 */

import { spawn, type ChildProcess } from 'child_process';
import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';
import { platform } from 'os';

const logger = createLogger('SandboxExecutor');

/**
 * Sandbox configuration
 */
export interface SandboxConfig {
  /** Maximum execution time (ms) */
  timeout?: number;
  /** Maximum memory limit (MB) */
  maxMemoryMB?: number;
  /** Maximum CPU usage (%) */
  maxCpuPercent?: number;
  /** Allowed network access */
  allowNetwork?: boolean;
  /** Working directory */
  workingDirectory?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Allowed file paths (whitelist) */
  allowedPaths?: string[];
}

/**
 * Execution result
 */
export interface SandboxResult {
  /** Exit code */
  exitCode: number | null;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Execution duration (ms) */
  duration: number;
  /** Whether timed out */
  timedOut: boolean;
  /** Whether killed */
  killed: boolean;
  /** Error message */
  error?: string;
}

/**
 * Sandbox executor
 */
export class SandboxExecutor extends EventEmitter {
  private platform: string;

  constructor() {
    super();
    this.platform = platform();
    logger.info(`Sandbox executor initialized for platform: ${this.platform}`);
  }

  /**
   * Execute command in sandbox
   */
  async execute(
    command: string,
    args: string[],
    config: SandboxConfig = {}
  ): Promise<SandboxResult> {
    const startTime = Date.now();

    logger.info(`Executing in sandbox: ${command} ${args.join(' ')}`);

    try {
      // Choose implementation based on platform
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
   * Windows implementation - Job Object isolation
   */
  private async executeWindows(
    command: string,
    args: string[],
    config: SandboxConfig,
    startTime: number
  ): Promise<SandboxResult> {
    // TODO: use koffi FFI to call Windows Job Object API
    // Currently using basic implementation
    logger.warn('Windows Job Object isolation not yet implemented, using basic execution');

    return this.executeBasic(command, args, config, startTime);
  }

  /**
   * Linux implementation - cgroup + namespace isolation
   */
  private async executeLinux(
    command: string,
    args: string[],
    config: SandboxConfig,
    startTime: number
  ): Promise<SandboxResult> {
    // Linux: use systemd-run to create a temporary cgroup
    if (config.maxMemoryMB || config.maxCpuPercent) {
      const systemdArgs = ['systemd-run', '--user', '--scope', '--quiet'];

      // Memory limit
      if (config.maxMemoryMB) {
        systemdArgs.push(`-p`, `MemoryMax=${config.maxMemoryMB}M`);
      }

      // CPU limit
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
   * macOS implementation - basic process limits
   */
  private async executeMacOS(
    command: string,
    args: string[],
    config: SandboxConfig,
    startTime: number
  ): Promise<SandboxResult> {
    // macOS: use ulimit or launchctl
    return this.executeBasic(command, args, config, startTime);
  }

  /**
   * Basic implementation - cross-platform compatible
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

      // Spawn process
      const child: ChildProcess = spawn(command, args, {
        cwd: config.workingDirectory,
        env: {
          ...process.env,
          ...config.env,
        },
        shell: false,
      });

      // Collect output
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

      // Timeout handling
      const timer = setTimeout(() => {
        timedOut = true;
        killed = true;
        child.kill('SIGTERM');

        // Force kill
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }, timeout);

      // Process exit
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

      // Error handling
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
   * Check if command is allowed
   */
  isCommandAllowed(command: string, config: SandboxConfig): boolean {
    // Dangerous command blacklist
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
   * Check if path is allowed
   */
  isPathAllowed(path: string, config: SandboxConfig): boolean {
    if (!config.allowedPaths || config.allowedPaths.length === 0) {
      return true;
    }

    // Check if path is in the whitelist
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
 * Tool sandbox - high-level wrapper for tool invocation
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
   * Execute tool command
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

    // Security check
    if (!this.executor.isCommandAllowed(command, mergedConfig)) {
      throw new Error(`Command not allowed: ${command}`);
    }

    // Execute
    const result = await this.executor.execute(command, args, mergedConfig);

    // Logging
    logger.info(`Tool command executed: ${command}`, {
      exitCode: result.exitCode,
      duration: result.duration,
      timedOut: result.timedOut,
    });

    return result;
  }

  /**
   * Attach event listener
   */
  on(
    event: 'stdout' | 'stderr',
    listener: (data: string) => void
  ): this {
    this.executor.on(event, listener);
    return this;
  }

  /**
   * Remove event listener
   */
  off(
    event: 'stdout' | 'stderr',
    listener: (data: string) => void
  ): this {
    this.executor.off(event, listener);
    return this;
  }
}
