import { createLogger } from '../utils/logger';
/**
 * Cron Manager
 *
 * Advanced task scheduler using croner with timezone support,
 * error recovery, and persistent state management.
 *
 * Features:
 * - Cron expression parsing and validation
 * - Timezone-aware scheduling
 * - Automatic error recovery
 * - Task history tracking
 * - Overlap prevention
 * - Graceful shutdown
 *
 * @module scheduler/cron-manager
 */

import { EventEmitter } from 'events';
import { Cron } from 'croner';
import * as fs from 'fs';
import * as path from 'path';

const logger = createLogger('CronManager');

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Task execution status
 */
export type TaskStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Task execution result
 */
export interface TaskResult {
  taskId: string;
  status: TaskStatus;
  startTime: number;
  endTime: number;
  duration: number;
  error?: string;
  output?: any;
}

/**
 * Task execution history entry
 */
export interface TaskHistoryEntry {
  executionId: string;
  taskId: string;
  scheduledTime: number;
  actualStartTime: number;
  endTime: number;
  status: TaskStatus;
  error?: string;
  output?: any;
}

/**
 * Scheduled task configuration
 */
export interface ScheduledTask {
  id: string;
  name: string;
  description?: string;
  cronExpression: string;
  timezone?: string;
  enabled: boolean;
  handler: TaskHandler;
  preventOverlap?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
  timeout?: number;
  metadata?: Record<string, any>;
}

/**
 * Task handler function
 */
export type TaskHandler = () => Promise<any> | any;

/**
 * Cron manager configuration
 */
export interface CronManagerConfig {
  timezone?: string;
  persistState?: boolean;
  stateFilePath?: string;
  maxHistoryEntries?: number;
  defaultTimeout?: number;
}

/**
 * Task state for persistence
 */
interface TaskState {
  id: string;
  enabled: boolean;
  lastExecution?: TaskHistoryEntry;
  nextScheduledTime?: number;
}

/**
 * Persisted state structure
 */
interface PersistedState {
  version: number;
  tasks: TaskState[];
  lastSaved: number;
}

// ============================================================================
// CronManager Class
// ============================================================================

/**
 * CronManager - Advanced task scheduler
 *
 * @example
 * ```typescript
 * const manager = new CronManager({
 *   timezone: 'America/New_York',
 *   persistState: true,
 *   stateFilePath: './cron-state.json'
 * });
 *
 * manager.addTask({
 *   id: 'daily-backup',
 *   name: 'Daily Backup',
 *   cronExpression: '0 2 * * *', // 2 AM daily
 *   handler: async () => {
 *     await performBackup();
 *   },
 *   preventOverlap: true
 * });
 *
 * await manager.start();
 * ```
 */
export class CronManager extends EventEmitter {
  private tasks = new Map<string, ScheduledTask>();
  private cronJobs = new Map<string, Cron>();
  private runningTasks = new Map<string, Promise<any>>();
  private taskHistory = new Map<string, TaskHistoryEntry[]>();
  private retryCounters = new Map<string, number>();
  private isStarted = false;
  private shutdownInProgress = false;

  constructor(private config: CronManagerConfig = {}) {
    super();

    // Set defaults
    this.config.timezone = config.timezone || 'UTC';
    this.config.persistState = config.persistState !== false;
    this.config.maxHistoryEntries = config.maxHistoryEntries || 100;
    this.config.defaultTimeout = config.defaultTimeout || 300000; // 5 minutes

    // Load persisted state if enabled
    if (this.config.persistState && this.config.stateFilePath) {
      this.loadState();
    }
  }

  // ==========================================================================
  // Task Management
  // ==========================================================================

  /**
   * Add a new scheduled task
   */
  addTask(task: ScheduledTask): void {
    if (this.tasks.has(task.id)) {
      throw new Error(`Task with id '${task.id}' already exists`);
    }

    // Validate cron expression
    try {
      new Cron(task.cronExpression, { timezone: task.timezone || this.config.timezone });
    } catch (error) {
      throw new Error(`Invalid cron expression '${task.cronExpression}': ${error}`);
    }

    // Set defaults
    task.enabled = task.enabled !== false;
    task.preventOverlap = task.preventOverlap !== false;
    task.maxRetries = task.maxRetries ?? 3;
    task.retryDelayMs = task.retryDelayMs ?? 5000;
    task.timeout = task.timeout ?? this.config.defaultTimeout;

    this.tasks.set(task.id, task);
    this.taskHistory.set(task.id, []);

    // Start the cron job if manager is already started
    if (this.isStarted && task.enabled) {
      this.scheduleTask(task);
    }

    this.emit('task:added', task);
  }

  /**
   * Remove a scheduled task
   */
  removeTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task '${taskId}' not found`);
    }

    // Stop the cron job
    const cronJob = this.cronJobs.get(taskId);
    if (cronJob) {
      cronJob.stop();
      this.cronJobs.delete(taskId);
    }

    this.tasks.delete(taskId);
    this.taskHistory.delete(taskId);
    this.retryCounters.delete(taskId);

    this.emit('task:removed', taskId);
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Enable a task
   */
  enableTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task '${taskId}' not found`);
    }

    if (task.enabled) {
      return;
    }

    task.enabled = true;

    if (this.isStarted) {
      this.scheduleTask(task);
    }

    this.emit('task:enabled', taskId);
    this.saveState();
  }

  /**
   * Disable a task
   */
  disableTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task '${taskId}' not found`);
    }

    if (!task.enabled) {
      return;
    }

    task.enabled = false;

    const cronJob = this.cronJobs.get(taskId);
    if (cronJob) {
      cronJob.stop();
      this.cronJobs.delete(taskId);
    }

    this.emit('task:disabled', taskId);
    this.saveState();
  }

  // ==========================================================================
  // Scheduling
  // ==========================================================================

  /**
   * Schedule a task using croner
   */
  private scheduleTask(task: ScheduledTask): void {
    const cronJob = new Cron(
      task.cronExpression,
      {
        timezone: task.timezone || this.config.timezone,
        protect: task.preventOverlap,
      },
      () => {
        this.executeTask(task);
      }
    );

    this.cronJobs.set(task.id, cronJob);
  }

  /**
   * Execute a task
   */
  private async executeTask(task: ScheduledTask): Promise<void> {
    const executionId = `${task.id}-${Date.now()}`;
    const scheduledTime = Date.now();

    // Check for overlap
    if (task.preventOverlap && this.runningTasks.has(task.id)) {
      logger.warn(`Task '${task.id}' is already running, skipping`);
      this.emit('task:skipped', { taskId: task.id, reason: 'overlap' });
      return;
    }

    this.emit('task:start', { taskId: task.id, executionId });

    const startTime = Date.now();
    let status: TaskStatus = 'running';
    let error: string | undefined;
    let output: any;

    try {
      // Create execution promise with timeout
      const executionPromise = Promise.resolve(task.handler());
      this.runningTasks.set(task.id, executionPromise);

      // Add timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Task execution timeout')), task.timeout);
      });

      output = await Promise.race([executionPromise, timeoutPromise]);
      status = 'completed';
      this.retryCounters.delete(task.id);
    } catch (err) {
      status = 'failed';
      error = err instanceof Error ? err.message : String(err);

      logger.error(`Task '${task.id}' failed: ${error}`);
      this.emit('task:error', { taskId: task.id, error });

      // Handle retries
      if (task.maxRetries && task.maxRetries > 0) {
        await this.handleRetry(task, err as Error);
      }
    } finally {
      this.runningTasks.delete(task.id);
    }

    const endTime = Date.now();

    // Record history
    const historyEntry: TaskHistoryEntry = {
      executionId,
      taskId: task.id,
      scheduledTime,
      actualStartTime: startTime,
      endTime,
      status,
      error,
      output,
    };

    this.addToHistory(task.id, historyEntry);

    this.emit('task:end', {
      taskId: task.id,
      executionId,
      status,
      duration: endTime - startTime,
    });

    this.saveState();
  }

  /**
   * Handle task retry
   */
  private async handleRetry(task: ScheduledTask, error: Error): Promise<void> {
    const retryCount = this.retryCounters.get(task.id) || 0;

    if (retryCount >= task.maxRetries!) {
      logger.error(`Task '${task.id}' exceeded max retries (${task.maxRetries})`);
      this.retryCounters.delete(task.id);
      return;
    }

    this.retryCounters.set(task.id, retryCount + 1);

    logger.info(
      `Retrying task '${task.id}' (attempt ${retryCount + 1}/${task.maxRetries})`
    );

    this.emit('task:retry', {
      taskId: task.id,
      attempt: retryCount + 1,
      maxRetries: task.maxRetries,
    });

    // Wait before retry
    await new Promise((resolve) => setTimeout(resolve, task.retryDelayMs));

    // Execute again
    await this.executeTask(task);
  }

  /**
   * Manually trigger a task execution
   */
  async triggerTask(taskId: string): Promise<TaskResult> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task '${taskId}' not found`);
    }

    const startTime = Date.now();

    try {
      await this.executeTask(task);
      const endTime = Date.now();

      return {
        taskId,
        status: 'completed',
        startTime,
        endTime,
        duration: endTime - startTime,
      };
    } catch (error) {
      const endTime = Date.now();

      return {
        taskId,
        status: 'failed',
        startTime,
        endTime,
        duration: endTime - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ==========================================================================
  // History Management
  // ==========================================================================

  /**
   * Add entry to task history
   */
  private addToHistory(taskId: string, entry: TaskHistoryEntry): void {
    const history = this.taskHistory.get(taskId) || [];
    history.push(entry);

    // Trim history if needed
    if (history.length > this.config.maxHistoryEntries!) {
      history.shift();
    }

    this.taskHistory.set(taskId, history);
  }

  /**
   * Get task execution history
   */
  getTaskHistory(taskId: string, limit?: number): TaskHistoryEntry[] {
    const history = this.taskHistory.get(taskId) || [];

    if (limit && limit > 0) {
      return history.slice(-limit);
    }

    return [...history];
  }

  /**
   * Clear task history
   */
  clearTaskHistory(taskId: string): void {
    this.taskHistory.set(taskId, []);
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Start the cron manager
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn('Already started');
      return;
    }

    this.isStarted = true;

    // Schedule all enabled tasks
    for (const task of this.tasks.values()) {
      if (task.enabled) {
        this.scheduleTask(task);
      }
    }

    this.emit('start');
    logger.info(`Started with ${this.tasks.size} task(s)`);
  }

  /**
   * Stop the cron manager
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    this.shutdownInProgress = true;
    this.isStarted = false;

    // Stop all cron jobs
    for (const [taskId, cronJob] of this.cronJobs.entries()) {
      cronJob.stop();
      logger.info(`Stopped task: ${taskId}`);
    }

    this.cronJobs.clear();

    // Wait for running tasks to complete
    if (this.runningTasks.size > 0) {
      logger.info(`Waiting for ${this.runningTasks.size} running task(s) to complete...`);
      await Promise.allSettled(Array.from(this.runningTasks.values()));
    }

    this.saveState();
    this.emit('stop');
    logger.info('Stopped');
  }

  /**
   * Get manager status
   */
  getStatus(): {
    isStarted: boolean;
    taskCount: number;
    enabledTaskCount: number;
    runningTaskCount: number;
  } {
    const enabledTaskCount = Array.from(this.tasks.values()).filter((t) => t.enabled).length;

    return {
      isStarted: this.isStarted,
      taskCount: this.tasks.size,
      enabledTaskCount,
      runningTaskCount: this.runningTasks.size,
    };
  }

  // ==========================================================================
  // State Persistence
  // ==========================================================================

  /**
   * Load persisted state from disk
   */
  private loadState(): void {
    if (!this.config.stateFilePath) {
      return;
    }

    try {
      const content = fs.readFileSync(this.config.stateFilePath, 'utf-8');
      const state: PersistedState = JSON.parse(content);

      // Restore task states
      for (const taskState of state.tasks) {
        const task = this.tasks.get(taskState.id);
        if (task) {
          task.enabled = taskState.enabled;

          if (taskState.lastExecution) {
            const history = this.taskHistory.get(taskState.id) || [];
            history.push(taskState.lastExecution);
            this.taskHistory.set(taskState.id, history);
          }
        }
      }

      logger.info('State loaded from disk');
    } catch (error) {
      logger.warn(`Failed to load state: ${error}`);
    }
  }

  /**
   * Save current state to disk
   */
  private saveState(): void {
    if (!this.config.persistState || !this.config.stateFilePath) {
      return;
    }

    try {
      const taskStates: TaskState[] = Array.from(this.tasks.values()).map((task) => {
        const history = this.taskHistory.get(task.id) || [];
        const lastExecution = history[history.length - 1];

        return {
          id: task.id,
          enabled: task.enabled,
          lastExecution,
        };
      });

      const state: PersistedState = {
        version: 1,
        tasks: taskStates,
        lastSaved: Date.now(),
      };

      const dir = path.dirname(this.config.stateFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.config.stateFilePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) {
      logger.error(`Failed to save state: ${error}`);
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a CronManager instance
 */
export function createCronManager(config?: CronManagerConfig): CronManager {
  return new CronManager(config);
}

// ============================================================================
// Export
// ============================================================================

export default CronManager;
