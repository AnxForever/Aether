/**
 * Process Manager
 *
 * Manages child processes and background tasks with
 * lifecycle management, resource monitoring, and crash recovery.
 *
 * @module system/process-manager
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';

// ============================================================================
// Type Definitions
// ============================================================================

export type ProcessState = 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed';

export interface ProcessConfig {
  id: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  autoRestart?: boolean;
  maxRestarts?: number;
  restartDelay?: number;
  timeout?: number;
}

export interface ManagedProcessInfo {
  id: string;
  state: ProcessState;
  pid?: number;
  startTime?: number;
  uptime?: number;
  restartCount: number;
  exitCode?: number;
}

// ============================================================================
// ProcessManager Class
// ============================================================================

export class ProcessManager extends EventEmitter {
  private processes = new Map<string, ManagedProcess>();

  /**
   * Start a managed process
   */
  async start(config: ProcessConfig): Promise<void> {
    if (this.processes.has(config.id)) {
      throw new Error(`Process '${config.id}' already exists`);
    }

    const process = new ManagedProcess(config);
    this.processes.set(config.id, process);

    process.on('state', (state) => {
      this.emit('process:state', { id: config.id, state });
    });

    process.on('exit', (code) => {
      this.emit('process:exit', { id: config.id, code });
    });

    await process.start();
  }

  /**
   * Stop a managed process
   */
  async stop(id: string): Promise<void> {
    const process = this.processes.get(id);
    if (!process) {
      throw new Error(`Process '${id}' not found`);
    }

    await process.stop();
    this.processes.delete(id);
  }

  /**
   * Restart a managed process
   */
  async restart(id: string): Promise<void> {
    const process = this.processes.get(id);
    if (!process) {
      throw new Error(`Process '${id}' not found`);
    }

    await process.restart();
  }

  /**
   * Get process info
   */
  getProcessInfo(id: string): ManagedProcessInfo | null {
    const process = this.processes.get(id);
    return process ? process.getInfo() : null;
  }

  /**
   * Get all processes
   */
  getAllProcesses(): ManagedProcessInfo[] {
    return Array.from(this.processes.values()).map((p) => p.getInfo());
  }

  /**
   * Stop all processes
   */
  async stopAll(): Promise<void> {
    const promises = Array.from(this.processes.values()).map((p) => p.stop());
    await Promise.all(promises);
    this.processes.clear();
  }
}

// ============================================================================
// ManagedProcess Class
// ============================================================================

class ManagedProcess extends EventEmitter {
  private state: ProcessState = 'idle';
  private childProcess: ChildProcess | null = null;
  private restartCount = 0;
  private startTime: number | null = null;
  private exitCode: number | null = null;

  constructor(private config: ProcessConfig) {
    super();

    // Set defaults
    this.config.autoRestart = config.autoRestart !== false;
    this.config.maxRestarts = config.maxRestarts ?? 3;
    this.config.restartDelay = config.restartDelay ?? 5000;
  }

  /**
   * Start the process
   */
  async start(): Promise<void> {
    if (this.state === 'running') {
      return;
    }

    this.setState('starting');

    try {
      this.childProcess = spawn(this.config.command, this.config.args || [], {
        cwd: this.config.cwd,
        env: { ...process.env, ...this.config.env },
        stdio: 'pipe',
      });

      this.startTime = Date.now();

      this.childProcess.on('exit', (code) => {
        this.handleExit(code || 0);
      });

      this.childProcess.on('error', (error) => {
        this.emit('error', error);
      });

      this.setState('running');
    } catch (error) {
      this.setState('crashed');
      throw error;
    }
  }

  /**
   * Stop the process
   */
  async stop(): Promise<void> {
    if (this.state !== 'running') {
      return;
    }

    this.setState('stopping');

    if (this.childProcess) {
      this.childProcess.kill('SIGTERM');

      // Force kill after timeout
      if (this.config.timeout) {
        setTimeout(() => {
          if (this.childProcess) {
            this.childProcess.kill('SIGKILL');
          }
        }, this.config.timeout);
      }
    }

    this.setState('stopped');
  }

  /**
   * Restart the process
   */
  async restart(): Promise<void> {
    await this.stop();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await this.start();
  }

  /**
   * Handle process exit
   */
  private async handleExit(code: number): Promise<void> {
    this.exitCode = code;
    this.emit('exit', code);

    if (code !== 0) {
      this.setState('crashed');

      // Auto-restart if enabled
      if (this.config.autoRestart && this.restartCount < this.config.maxRestarts!) {
        this.restartCount++;
        await new Promise((resolve) => setTimeout(resolve, this.config.restartDelay));
        await this.start();
      }
    } else {
      this.setState('stopped');
    }
  }

  /**
   * Set state and emit event
   */
  private setState(state: ProcessState): void {
    this.state = state;
    this.emit('state', state);
  }

  /**
   * Get process info
   */
  getInfo(): ManagedProcessInfo {
    return {
      id: this.config.id,
      state: this.state,
      pid: this.childProcess?.pid,
      startTime: this.startTime || undefined,
      uptime: this.startTime ? Date.now() - this.startTime : undefined,
      restartCount: this.restartCount,
      exitCode: this.exitCode || undefined,
    };
  }
}

export function createProcessManager(): ProcessManager {
  return new ProcessManager();
}

export default ProcessManager;
