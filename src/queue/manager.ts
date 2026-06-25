/**
 * Work Queue Manager - Asynchronous task queue system
 */

import Database from 'better-sqlite3';
import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';

const logger = createLogger('WorkQueue');

/**
 * Work priority
 */
export type WorkPriority = 'high' | 'medium' | 'low';

/**
 * Work status
 */
export type WorkStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Work item
 */
export interface WorkItem {
  id: string;
  type: string;
  priority: WorkPriority;
  status: WorkStatus;
  data: any;
  result?: any;
  error?: string;
  retries: number;
  maxRetries: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

/**
 * Work handler function
 */
export type WorkHandler = (data: any) => Promise<any>;

/**
 * Work Queue Manager
 */
export class WorkQueueManager extends EventEmitter {
  private db: Database.Database;
  private handlers = new Map<string, WorkHandler>();
  private runningWorkers = new Map<string, Promise<void>>();
  private maxConcurrent = 3;
  private isProcessing = false;

  constructor(dbPath: string, maxConcurrent: number = 3) {
    super();
    this.db = new Database(dbPath);
    this.maxConcurrent = maxConcurrent;
    this.initializeTables();
  }

  /**
   * Initialize database tables
   */
  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS work_queue (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        data TEXT NOT NULL,
        result TEXT,
        error TEXT,
        retries INTEGER NOT NULL DEFAULT 0,
        maxRetries INTEGER NOT NULL DEFAULT 3,
        createdAt INTEGER NOT NULL,
        startedAt INTEGER,
        completedAt INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_queue_status ON work_queue(status);
      CREATE INDEX IF NOT EXISTS idx_queue_priority ON work_queue(priority);
      CREATE INDEX IF NOT EXISTS idx_queue_type ON work_queue(type);
    `);
  }

  /**
   * Register work handler
   */
  registerHandler(type: string, handler: WorkHandler): void {
    this.handlers.set(type, handler);
    logger.info(`Handler registered for type: ${type}`);
  }

  /**
   * Add work item to queue
   */
  async addWork(
    type: string,
    data: any,
    priority: WorkPriority = 'medium',
    maxRetries: number = 3
  ): Promise<string> {
    const workId = `work_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const work: WorkItem = {
      id: workId,
      type,
      priority,
      status: 'pending',
      data,
      retries: 0,
      maxRetries,
      createdAt: Date.now()
    };

    this.db
      .prepare(
        `INSERT INTO work_queue (id, type, priority, status, data, retries, maxRetries, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(work.id, work.type, work.priority, work.status, JSON.stringify(work.data), work.retries, work.maxRetries, work.createdAt);

    logger.info(`Work added: ${workId} (${type}, priority: ${priority})`);
    this.emit('queue-updated', await this.listWork());

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return workId;
  }

  /**
   * Process queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;

    while (true) {
      // Check if we can start more workers
      if (this.runningWorkers.size >= this.maxConcurrent) {
        // Wait for at least one worker to complete, with a microtask defer
        // to prevent starvation when all promises have already settled
        await Promise.race(Array.from(this.runningWorkers.values()));
        await new Promise(resolve => setTimeout(resolve, 0));
        continue;
      }

      // Get next work item
      const work = this.getNextWork();
      if (!work) break;

      // Start worker
      const workerPromise = this.processWork(work);
      this.runningWorkers.set(work.id, workerPromise);

      workerPromise.finally(() => {
        this.runningWorkers.delete(work.id);
      });
    }

    // Wait for all workers to finish
    await Promise.all(Array.from(this.runningWorkers.values()));

    this.isProcessing = false;
    logger.info('Queue processing completed');
  }

  /**
   * Get next work item
   */
  private getNextWork(): WorkItem | null {
    const priorityOrder = ['high', 'medium', 'low'];

    for (const priority of priorityOrder) {
      const work = this.db
        .prepare(
          `SELECT * FROM work_queue
           WHERE status = 'pending' AND priority = ?
           ORDER BY createdAt ASC LIMIT 1`
        )
        .get(priority) as any;

      if (work) {
        return {
          ...work,
          data: JSON.parse(work.data),
          result: work.result ? JSON.parse(work.result) : undefined
        };
      }
    }

    return null;
  }

  /**
   * Process single work item
   */
  private async processWork(work: WorkItem): Promise<void> {
    const handler = this.handlers.get(work.type);
    if (!handler) {
      logger.error(`No handler registered for type: ${work.type}`);
      await this.markFailed(work.id, 'No handler registered');
      return;
    }

    try {
      // Mark as running
      this.db
        .prepare('UPDATE work_queue SET status = ?, startedAt = ? WHERE id = ?')
        .run('running', Date.now(), work.id);

      logger.info(`Processing work: ${work.id} (${work.type})`);
      this.emit('work-started', work);

      // Execute handler
      const result = await handler(work.data);

      // Mark as completed
      this.db
        .prepare('UPDATE work_queue SET status = ?, result = ?, completedAt = ? WHERE id = ?')
        .run('completed', JSON.stringify(result), Date.now(), work.id);

      logger.info(`Work completed: ${work.id}`);
      this.emit('work-completed', { ...work, result });
      this.emit('queue-updated', await this.listWork());
    } catch (error: any) {
      logger.error(`Work failed: ${work.id}`, error as Error);

      // Check if should retry
      if (work.retries < work.maxRetries) {
        const newRetries = work.retries + 1;
        const backoffDelay = Math.pow(2, newRetries) * 1000; // Exponential backoff

        this.db
          .prepare('UPDATE work_queue SET status = ?, retries = ?, error = ? WHERE id = ?')
          .run('pending', newRetries, error.message, work.id);

        logger.info(`Work will retry: ${work.id} (attempt ${newRetries}/${work.maxRetries}) after ${backoffDelay}ms`);

        setTimeout(() => {
          if (!this.isProcessing) {
            this.processQueue();
          }
        }, backoffDelay);
      } else {
        await this.markFailed(work.id, error.message);
      }

      this.emit('queue-updated', await this.listWork());
    }
  }

  /**
   * Mark work as failed
   */
  private async markFailed(workId: string, error: string): Promise<void> {
    this.db
      .prepare('UPDATE work_queue SET status = ?, error = ?, completedAt = ? WHERE id = ?')
      .run('failed', error, Date.now(), workId);

    logger.error(`Work failed permanently: ${workId}`);
    this.emit('work-failed', { id: workId, error });
  }

  /**
   * Complete work manually
   */
  async completeWork(workId: string, result?: any): Promise<void> {
    this.db
      .prepare('UPDATE work_queue SET status = ?, result = ?, completedAt = ? WHERE id = ?')
      .run('completed', result ? JSON.stringify(result) : null, Date.now(), workId);

    logger.info(`Work manually completed: ${workId}`);
    this.emit('queue-updated', await this.listWork());
  }

  /**
   * Delete work
   */
  async deleteWork(workId: string): Promise<void> {
    this.db.prepare('DELETE FROM work_queue WHERE id = ?').run(workId);
    logger.info(`Work deleted: ${workId}`);
    this.emit('queue-updated', await this.listWork());
  }

  /**
   * Get work by ID
   */
  getWork(workId: string): WorkItem | null {
    const work = this.db.prepare('SELECT * FROM work_queue WHERE id = ?').get(workId) as any;

    if (!work) return null;

    return {
      ...work,
      data: JSON.parse(work.data),
      result: work.result ? JSON.parse(work.result) : undefined
    };
  }

  /**
   * List all work items
   */
  async listWork(status?: WorkStatus, limit: number = 100): Promise<WorkItem[]> {
    const query = status
      ? 'SELECT * FROM work_queue WHERE status = ? ORDER BY priority DESC, createdAt ASC LIMIT ?'
      : 'SELECT * FROM work_queue ORDER BY priority DESC, createdAt ASC LIMIT ?';

    const params = status ? [status, limit] : [limit];
    const works = this.db.prepare(query).all(...params) as any[];

    return works.map(work => ({
      ...work,
      data: JSON.parse(work.data),
      result: work.result ? JSON.parse(work.result) : undefined
    }));
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  }> {
    const total = (this.db.prepare('SELECT COUNT(*) as count FROM work_queue').get() as any).count;
    const pending = (this.db.prepare('SELECT COUNT(*) as count FROM work_queue WHERE status = ?').get('pending') as any).count;
    const running = (this.db.prepare('SELECT COUNT(*) as count FROM work_queue WHERE status = ?').get('running') as any).count;
    const completed = (this.db.prepare('SELECT COUNT(*) as count FROM work_queue WHERE status = ?').get('completed') as any).count;
    const failed = (this.db.prepare('SELECT COUNT(*) as count FROM work_queue WHERE status = ?').get('failed') as any).count;

    return { total, pending, running, completed, failed };
  }

  /**
   * Clear completed/failed work
   */
  async clearCompleted(): Promise<void> {
    this.db.prepare('DELETE FROM work_queue WHERE status IN (?, ?)').run('completed', 'failed');
    logger.info('Cleared completed and failed work items');
    this.emit('queue-updated', await this.listWork());
  }

  /**
   * Retry failed work
   */
  async retryFailed(): Promise<void> {
    this.db.prepare('UPDATE work_queue SET status = ?, retries = 0 WHERE status = ?').run('pending', 'failed');
    logger.info('Retrying failed work items');
    this.emit('queue-updated', await this.listWork());

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Stop processing
   */
  async stop(): Promise<void> {
    this.isProcessing = false;
    await Promise.all(Array.from(this.runningWorkers.values()));
    logger.info('Work queue stopped');
  }
}
