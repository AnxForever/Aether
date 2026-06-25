import { createLogger } from '../utils/logger';

const logger = createLogger('TaskQueue');

/**
 * Queue System - Dual queue for primary and background tasks
 *
 * Based on original steeringQueue and followUpQueue
 */

import { Task, Queue } from '../types';

export class TaskQueue implements Queue {
  private tasks: Task[] = [];
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  enqueue(task: Task): void {
    if (this.tasks.length >= this.maxSize) {
      throw new Error('Queue is full');
    }

    // Insert based on priority
    if (task.priority === 'primary') {
      this.tasks.unshift(task);
    } else {
      this.tasks.push(task);
    }
  }

  dequeue(): Task | undefined {
    return this.tasks.shift();
  }

  size(): number {
    return this.tasks.length;
  }

  clear(): void {
    this.tasks = [];
  }

  peek(): Task | undefined {
    return this.tasks[0];
  }

  isEmpty(): boolean {
    return this.tasks.length === 0;
  }
}

/**
 * Dual Queue System
 */
export class DualQueueSystem {
  private primaryQueue: TaskQueue;
  private backgroundQueue: TaskQueue;
  private isProcessing = false;

  constructor() {
    this.primaryQueue = new TaskQueue();
    this.backgroundQueue = new TaskQueue();
  }

  /**
   * Add task to appropriate queue
   */
  enqueue(task: Task): void {
    if (task.priority === 'primary') {
      this.primaryQueue.enqueue(task);
    } else {
      this.backgroundQueue.enqueue(task);
    }

    // Auto-process if not already processing
    if (!this.isProcessing) {
      this.processNext();
    }
  }

  /**
   * Process next task
   */
  private async processNext(): Promise<void> {
    if (this.isProcessing) return;

    // Check primary queue first
    let task = this.primaryQueue.dequeue();

    // If no primary tasks, check background
    if (!task) {
      task = this.backgroundQueue.dequeue();
    }

    if (!task) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;

    try {
      await task.handler();
    } catch (error) {
      logger.error('Task execution failed:', error as Error);
    }

    this.isProcessing = false;

    // Process next task
    if (!this.primaryQueue.isEmpty() || !this.backgroundQueue.isEmpty()) {
      setImmediate(() => this.processNext());
    }
  }

  /**
   * Get queue sizes
   */
  getSizes() {
    return {
      primary: this.primaryQueue.size(),
      background: this.backgroundQueue.size(),
      total: this.primaryQueue.size() + this.backgroundQueue.size()
    };
  }

  /**
   * Clear all queues
   */
  clearAll(): void {
    this.primaryQueue.clear();
    this.backgroundQueue.clear();
  }
}
