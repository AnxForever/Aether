/**
 * Task Queue - Priority-based task queue system
 */

import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';

const logger = createLogger('TaskQueue');

/**
 * Task priority
 */
export enum TaskPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

/**
 * Queued task
 */
export interface QueuedTask<T = any> {
  id: string;
  priority: TaskPriority;
  handler: () => Promise<T>;
  metadata?: Record<string, any>;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

/**
 * Task Queue
 */
export class TaskQueue extends EventEmitter {
  private queue: QueuedTask[] = [];
  private running: Map<string, QueuedTask> = new Map();
  private maxConcurrent: number;
  private isProcessing = false;

  constructor(maxConcurrent: number = 5) {
    super();
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Add task to queue
   */
  enqueue<T>(
    handler: () => Promise<T>,
    priority: TaskPriority = TaskPriority.NORMAL,
    metadata?: Record<string, any>
  ): string {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const task: QueuedTask<T> = {
      id: taskId,
      priority,
      handler,
      metadata,
      createdAt: Date.now()
    };

    this.queue.push(task);
    this.sortQueue();

    logger.debug(`Task enqueued: ${taskId} (priority: ${priority})`);

    this.emit('task-enqueued', { taskId, priority });

    // Start processing if not already
    if (!this.isProcessing) {
      this.processQueue().catch(err => {
        logger.error('Queue processing error:', err as Error);
      });
    }

    return taskId;
  }

  /**
   * Sort queue by priority
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // Higher priority first
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // Earlier creation time first
      return a.createdAt - b.createdAt;
    });
  }

  /**
   * Process queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;

    try {
      while (this.queue.length > 0 || this.running.size > 0) {
        // Start tasks up to max concurrent
        while (this.queue.length > 0 && this.running.size < this.maxConcurrent) {
          const task = this.queue.shift()!;
          this.executeTask(task).catch(err => {
            logger.error(`Task execution error: ${task.id}`, err as Error);
          });
        }

        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute task
   */
  private async executeTask(task: QueuedTask): Promise<void> {
    task.startedAt = Date.now();
    this.running.set(task.id, task);

    logger.info(`Task started: ${task.id} (priority: ${task.priority})`);
    this.emit('task-started', { taskId: task.id, task });

    try {
      const result = await task.handler();

      task.completedAt = Date.now();
      const duration = task.completedAt - task.startedAt;

      logger.info(`Task completed: ${task.id} - Duration: ${duration}ms`);

      this.emit('task-completed', {
        taskId: task.id,
        task,
        result,
        duration
      });
    } catch (error: any) {
      task.completedAt = Date.now();
      const duration = task.completedAt - task.startedAt!;

      logger.error(`Task failed: ${task.id}`, error as Error);

      this.emit('task-failed', {
        taskId: task.id,
        task,
        error: error.message,
        duration
      });
    } finally {
      this.running.delete(task.id);
    }
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Get running tasks count
   */
  runningCount(): number {
    return this.running.size;
  }

  /**
   * Get queue statistics
   */
  getStatistics(): {
    queued: number;
    running: number;
    maxConcurrent: number;
    queuedByPriority: Record<TaskPriority, number>;
  } {
    const queuedByPriority = this.queue.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1;
      return acc;
    }, {} as Record<TaskPriority, number>);

    return {
      queued: this.queue.length,
      running: this.running.size,
      maxConcurrent: this.maxConcurrent,
      queuedByPriority
    };
  }

  /**
   * Clear queue
   */
  clear(): void {
    const cleared = this.queue.length;
    this.queue = [];
    logger.info(`Queue cleared: ${cleared} tasks removed`);
    this.emit('queue-cleared', { count: cleared });
  }

  /**
   * Wait for all tasks to complete
   */
  async drain(): Promise<void> {
    logger.info('Draining queue...');

    while (this.queue.length > 0 || this.running.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info('Queue drained');
  }
}
