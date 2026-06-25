/**
 * Task Scheduler - Cron-based task scheduling system
 */

import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { CronJob } from 'cron';

const logger = createLogger('TaskScheduler');

/**
 * Scheduled task
 */
export interface ScheduledTask {
  id: string;
  name: string;
  description?: string;
  cronExpression: string;
  handler: string;
  parameters?: Record<string, any>;
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
  runCount: number;
  errorCount: number;
  metadata?: Record<string, any>;
}

/**
 * Task execution result
 */
export interface TaskExecutionResult {
  taskId: string;
  executionId: string;
  startTime: number;
  endTime: number;
  status: 'success' | 'failure';
  result?: any;
  error?: string;
}

/**
 * Task handler function
 */
export type TaskHandler = (
  task: ScheduledTask,
  executionId: string
) => Promise<any>;

/**
 * Task Scheduler
 */
export class TaskScheduler extends EventEmitter {
  private db: Database.Database;
  private handlers: Map<string, TaskHandler> = new Map();
  private jobs: Map<string, CronJob> = new Map();
  private runningTasks: Map<string, Promise<any>> = new Map();

  constructor(dbPath: string) {
    super();
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  /**
   * Initialize database tables
   */
  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        cronExpression TEXT NOT NULL,
        handler TEXT NOT NULL,
        parameters TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        lastRun INTEGER,
        nextRun INTEGER,
        runCount INTEGER DEFAULT 0,
        errorCount INTEGER DEFAULT 0,
        metadata TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS task_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        taskId TEXT NOT NULL,
        executionId TEXT NOT NULL UNIQUE,
        startTime INTEGER NOT NULL,
        endTime INTEGER,
        status TEXT NOT NULL,
        result TEXT,
        error TEXT,
        FOREIGN KEY (taskId) REFERENCES scheduled_tasks(id)
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_enabled ON scheduled_tasks(enabled);
      CREATE INDEX IF NOT EXISTS idx_tasks_next_run ON scheduled_tasks(nextRun);
      CREATE INDEX IF NOT EXISTS idx_executions_task ON task_executions(taskId);
      CREATE INDEX IF NOT EXISTS idx_executions_status ON task_executions(status);
    `);

    logger.info('Task scheduler initialized');
  }

  /**
   * Register task handler
   */
  registerHandler(name: string, handler: TaskHandler): void {
    this.handlers.set(name, handler);
    logger.debug(`Handler registered: ${name}`);
  }

  /**
   * Schedule a task
   */
  scheduleTask(task: Omit<ScheduledTask, 'id' | 'runCount' | 'errorCount'>): string {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const now = Date.now();

    this.db
      .prepare(
        `INSERT INTO scheduled_tasks
         (id, name, description, cronExpression, handler, parameters, enabled, metadata, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        taskId,
        task.name,
        task.description || null,
        task.cronExpression,
        task.handler,
        JSON.stringify(task.parameters || {}),
        task.enabled ? 1 : 0,
        JSON.stringify(task.metadata || {}),
        now,
        now
      );

    logger.info(`Task scheduled: ${taskId} (${task.name}) - ${task.cronExpression}`);

    // Start the job if enabled
    if (task.enabled) {
      this.startJob(taskId);
    }

    return taskId;
  }

  /**
   * Update task
   */
  updateTask(taskId: string, updates: Partial<ScheduledTask>): void {
    const task = this.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Stop existing job
    this.stopJob(taskId);

    const now = Date.now();

    const setters: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      setters.push('name = ?');
      values.push(updates.name);
    }

    if (updates.description !== undefined) {
      setters.push('description = ?');
      values.push(updates.description);
    }

    if (updates.cronExpression !== undefined) {
      setters.push('cronExpression = ?');
      values.push(updates.cronExpression);
    }

    if (updates.handler !== undefined) {
      setters.push('handler = ?');
      values.push(updates.handler);
    }

    if (updates.parameters !== undefined) {
      setters.push('parameters = ?');
      values.push(JSON.stringify(updates.parameters));
    }

    if (updates.enabled !== undefined) {
      setters.push('enabled = ?');
      values.push(updates.enabled ? 1 : 0);
    }

    if (updates.metadata !== undefined) {
      setters.push('metadata = ?');
      values.push(JSON.stringify(updates.metadata));
    }

    setters.push('updatedAt = ?');
    values.push(now);

    values.push(taskId);

    this.db.prepare(`UPDATE scheduled_tasks SET ${setters.join(', ')} WHERE id = ?`).run(...values);

    logger.info(`Task updated: ${taskId}`);

    // Restart job if enabled
    const updatedTask = this.getTask(taskId);
    if (updatedTask?.enabled) {
      this.startJob(taskId);
    }
  }

  /**
   * Delete task
   */
  deleteTask(taskId: string): void {
    this.stopJob(taskId);

    this.db.prepare('DELETE FROM task_executions WHERE taskId = ?').run(taskId);
    this.db.prepare('DELETE FROM scheduled_tasks WHERE id = ?').run(taskId);

    logger.info(`Task deleted: ${taskId}`);
  }

  /**
   * Enable task
   */
  enableTask(taskId: string): void {
    this.db.prepare('UPDATE scheduled_tasks SET enabled = 1, updatedAt = ? WHERE id = ?').run(Date.now(), taskId);
    this.startJob(taskId);
    logger.info(`Task enabled: ${taskId}`);
  }

  /**
   * Disable task
   */
  disableTask(taskId: string): void {
    this.db.prepare('UPDATE scheduled_tasks SET enabled = 0, updatedAt = ? WHERE id = ?').run(Date.now(), taskId);
    this.stopJob(taskId);
    logger.info(`Task disabled: ${taskId}`);
  }

  /**
   * Start job
   */
  private startJob(taskId: string): void {
    const task = this.getTask(taskId);
    if (!task || !task.enabled) return;

    if (this.jobs.has(taskId)) {
      logger.warn(`Job already running: ${taskId}`);
      return;
    }

    try {
      const job = new CronJob(
        task.cronExpression,
        () => {
          this.executeTask(taskId).catch(err => {
            logger.error(`Task execution error: ${taskId}`, err as Error);
          });
        },
        null,
        true
      );

      this.jobs.set(taskId, job);

      // Update next run time
      const nextRun = job.nextDate().toMillis();
      this.db.prepare('UPDATE scheduled_tasks SET nextRun = ? WHERE id = ?').run(nextRun, taskId);

      logger.info(`Job started: ${taskId} - Next run: ${new Date(nextRun).toISOString()}`);
    } catch (error: any) {
      logger.error(`Failed to start job: ${taskId}`, error as Error);
      throw error;
    }
  }

  /**
   * Stop job
   */
  private stopJob(taskId: string): void {
    const job = this.jobs.get(taskId);
    if (job) {
      job.stop();
      this.jobs.delete(taskId);
      logger.info(`Job stopped: ${taskId}`);
    }
  }

  /**
   * Execute task
   */
  private async executeTask(taskId: string): Promise<void> {
    const task = this.getTask(taskId);
    if (!task) {
      logger.warn(`Task not found during execution: ${taskId}`);
      return;
    }

    // Check if already running
    if (this.runningTasks.has(taskId)) {
      logger.warn(`Task already running, skipping: ${taskId}`);
      return;
    }

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    logger.info(`Executing task: ${taskId} (${task.name}) - Execution: ${executionId}`);

    // Record execution start
    this.db
      .prepare(
        `INSERT INTO task_executions (taskId, executionId, startTime, status)
         VALUES (?, ?, ?, 'running')`
      )
      .run(taskId, executionId, startTime);

    this.emit('task-started', { taskId, executionId, task });

    const executionPromise = (async () => {
      try {
        const handler = this.handlers.get(task.handler);
        if (!handler) {
          throw new Error(`Handler not found: ${task.handler}`);
        }

        const result = await handler(task, executionId);
        const endTime = Date.now();

        // Update execution record
        this.db
          .prepare(
            `UPDATE task_executions
             SET endTime = ?, status = 'success', result = ?
             WHERE executionId = ?`
          )
          .run(endTime, JSON.stringify(result), executionId);

        // Update task stats
        this.db
          .prepare(
            `UPDATE scheduled_tasks
             SET lastRun = ?, runCount = runCount + 1, updatedAt = ?
             WHERE id = ?`
          )
          .run(endTime, Date.now(), taskId);

        // Update next run time
        const job = this.jobs.get(taskId);
        if (job) {
          const nextRun = job.nextDate().toMillis();
          this.db.prepare('UPDATE scheduled_tasks SET nextRun = ? WHERE id = ?').run(nextRun, taskId);
        }

        logger.info(`Task completed: ${taskId} - Duration: ${endTime - startTime}ms`);

        const executionResult: TaskExecutionResult = {
          taskId,
          executionId,
          startTime,
          endTime,
          status: 'success',
          result
        };

        this.emit('task-completed', executionResult);

        return result;
      } catch (error: any) {
        const endTime = Date.now();

        logger.error(`Task failed: ${taskId}`, error as Error);

        // Update execution record
        this.db
          .prepare(
            `UPDATE task_executions
             SET endTime = ?, status = 'failure', error = ?
             WHERE executionId = ?`
          )
          .run(endTime, error.message, executionId);

        // Update task stats
        this.db
          .prepare(
            `UPDATE scheduled_tasks
             SET lastRun = ?, errorCount = errorCount + 1, updatedAt = ?
             WHERE id = ?`
          )
          .run(endTime, Date.now(), taskId);

        const executionResult: TaskExecutionResult = {
          taskId,
          executionId,
          startTime,
          endTime,
          status: 'failure',
          error: error.message
        };

        this.emit('task-failed', executionResult);

        throw error;
      }
    })();

    this.runningTasks.set(taskId, executionPromise);

    try {
      await executionPromise;
    } finally {
      this.runningTasks.delete(taskId);
    }
  }

  /**
   * Run task immediately
   */
  async runTask(taskId: string): Promise<any> {
    const task = this.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    logger.info(`Running task immediately: ${taskId}`);
    return this.executeTask(taskId);
  }

  /**
   * Get task
   */
  getTask(taskId: string): ScheduledTask | null {
    const row = this.db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(taskId) as any;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      cronExpression: row.cronExpression,
      handler: row.handler,
      parameters: row.parameters ? JSON.parse(row.parameters) : undefined,
      enabled: row.enabled === 1,
      lastRun: row.lastRun,
      nextRun: row.nextRun,
      runCount: row.runCount,
      errorCount: row.errorCount,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  /**
   * List all tasks
   */
  listTasks(filter?: { enabled?: boolean }): ScheduledTask[] {
    let query = 'SELECT * FROM scheduled_tasks';
    const params: any[] = [];

    if (filter?.enabled !== undefined) {
      query += ' WHERE enabled = ?';
      params.push(filter.enabled ? 1 : 0);
    }

    query += ' ORDER BY name';

    const rows = this.db.prepare(query).all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      cronExpression: row.cronExpression,
      handler: row.handler,
      parameters: row.parameters ? JSON.parse(row.parameters) : undefined,
      enabled: row.enabled === 1,
      lastRun: row.lastRun,
      nextRun: row.nextRun,
      runCount: row.runCount,
      errorCount: row.errorCount,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  /**
   * Get task execution history
   */
  getTaskHistory(taskId: string, limit: number = 50): TaskExecutionResult[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM task_executions
         WHERE taskId = ?
         ORDER BY startTime DESC
         LIMIT ?`
      )
      .all(taskId, limit) as any[];

    return rows.map(row => ({
      taskId: row.taskId,
      executionId: row.executionId,
      startTime: row.startTime,
      endTime: row.endTime,
      status: row.status,
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error
    }));
  }

  /**
   * Get task statistics
   */
  getTaskStatistics(taskId: string): {
    totalRuns: number;
    successCount: number;
    failureCount: number;
    averageDuration: number;
    lastSuccess?: number;
    lastFailure?: number;
  } {
    const stats = this.db
      .prepare(
        `SELECT
           COUNT(*) as totalRuns,
           SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successCount,
           SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failureCount,
           AVG(endTime - startTime) as averageDuration
         FROM task_executions
         WHERE taskId = ?`
      )
      .get(taskId) as any;

    const lastSuccess = this.db
      .prepare(
        `SELECT endTime FROM task_executions
         WHERE taskId = ? AND status = 'success'
         ORDER BY endTime DESC LIMIT 1`
      )
      .get(taskId) as any;

    const lastFailure = this.db
      .prepare(
        `SELECT endTime FROM task_executions
         WHERE taskId = ? AND status = 'failure'
         ORDER BY endTime DESC LIMIT 1`
      )
      .get(taskId) as any;

    return {
      totalRuns: stats.totalRuns || 0,
      successCount: stats.successCount || 0,
      failureCount: stats.failureCount || 0,
      averageDuration: stats.averageDuration || 0,
      lastSuccess: lastSuccess?.endTime,
      lastFailure: lastFailure?.endTime
    };
  }

  /**
   * Start all enabled tasks
   */
  start(): void {
    const tasks = this.listTasks({ enabled: true });

    for (const task of tasks) {
      this.startJob(task.id);
    }

    logger.info(`Task scheduler started with ${tasks.length} tasks`);
  }

  /**
   * Stop all tasks
   */
  stop(): void {
    for (const [taskId] of this.jobs) {
      this.stopJob(taskId);
    }

    logger.info('Task scheduler stopped');
  }

  /**
   * Close and cleanup
   */
  close(): void {
    this.stop();

    if (this.db) {
      this.db.close();
      logger.info('Task scheduler closed');
    }
  }
}
