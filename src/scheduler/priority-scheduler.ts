/**
 * Priority Scheduler - Advanced priority-based scheduling with resource limits
 */

import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';
import { TaskQueue, TaskPriority } from './task-queue';

const logger = createLogger('PriorityScheduler');

/**
 * Resource limits
 */
export interface ResourceLimits {
  maxMemoryMB?: number;
  maxCpuPercent?: number;
  maxConcurrentTasks?: number;
}

/**
 * Scheduled job
 */
export interface ScheduledJob<T = any> {
  id: string;
  name: string;
  priority: TaskPriority;
  handler: () => Promise<T>;
  estimatedMemoryMB?: number;
  estimatedDurationMs?: number;
  retryOnFailure?: boolean;
  maxRetries?: number;
  retryCount?: number;
  metadata?: Record<string, any>;
}

/**
 * Priority Scheduler
 */
export class PriorityScheduler extends EventEmitter {
  private queue: TaskQueue;
  private jobs: Map<string, ScheduledJob> = new Map();
  private resourceLimits: ResourceLimits;
  private currentMemoryUsageMB = 0;

  constructor(resourceLimits: ResourceLimits = {}) {
    super();
    this.resourceLimits = {
      maxMemoryMB: resourceLimits.maxMemoryMB || 1024,
      maxCpuPercent: resourceLimits.maxCpuPercent || 80,
      maxConcurrentTasks: resourceLimits.maxConcurrentTasks || 5
    };

    this.queue = new TaskQueue(this.resourceLimits.maxConcurrentTasks!);
    this.setupQueueListeners();
  }

  /**
   * Setup queue event listeners
   */
  private setupQueueListeners(): void {
    this.queue.on('task-started', ({ taskId }) => {
      const job = this.jobs.get(taskId);
      if (job?.estimatedMemoryMB) {
        this.currentMemoryUsageMB += job.estimatedMemoryMB;
      }
      this.emit('job-started', { jobId: taskId, job });
    });

    this.queue.on('task-completed', ({ taskId, result, duration }) => {
      const job = this.jobs.get(taskId);
      if (job?.estimatedMemoryMB) {
        this.currentMemoryUsageMB -= job.estimatedMemoryMB;
      }
      this.jobs.delete(taskId);
      this.emit('job-completed', { jobId: taskId, job, result, duration });
    });

    this.queue.on('task-failed', ({ taskId, error, duration }) => {
      const job = this.jobs.get(taskId);
      if (job?.estimatedMemoryMB) {
        this.currentMemoryUsageMB -= job.estimatedMemoryMB;
      }

      // Retry if configured
      if (job?.retryOnFailure && (job.retryCount || 0) < (job.maxRetries || 3)) {
        logger.info(`Retrying job: ${taskId} (attempt ${(job.retryCount || 0) + 1})`);
        job.retryCount = (job.retryCount || 0) + 1;
        this.scheduleJob(job);
        return;
      }

      this.jobs.delete(taskId);
      this.emit('job-failed', { jobId: taskId, job, error, duration });
    });
  }

  /**
   * Schedule a job
   */
  scheduleJob<T>(job: Omit<ScheduledJob<T>, 'id' | 'retryCount'> & { id?: string }): string {
    const jobId = job.id || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check resource limits
    if (job.estimatedMemoryMB) {
      const projectedMemory = this.currentMemoryUsageMB + job.estimatedMemoryMB;
      if (projectedMemory > this.resourceLimits.maxMemoryMB!) {
        throw new Error(
          `Memory limit exceeded: ${projectedMemory}MB > ${this.resourceLimits.maxMemoryMB}MB`
        );
      }
    }

    const scheduledJob: ScheduledJob<T> = {
      id: jobId,
      name: job.name,
      priority: job.priority,
      handler: job.handler,
      estimatedMemoryMB: job.estimatedMemoryMB,
      estimatedDurationMs: job.estimatedDurationMs,
      retryOnFailure: job.retryOnFailure,
      maxRetries: job.maxRetries,
      retryCount: 0,
      metadata: job.metadata
    };

    this.jobs.set(jobId, scheduledJob);

    // Enqueue to task queue
    this.queue.enqueue(scheduledJob.handler, scheduledJob.priority, {
      jobId,
      name: scheduledJob.name
    });

    logger.info(`Job scheduled: ${jobId} (${job.name}) - Priority: ${job.priority}`);

    return jobId;
  }

  /**
   * Schedule multiple jobs
   */
  scheduleBatch<T>(jobs: Array<Omit<ScheduledJob<T>, 'id' | 'retryCount'>>): string[] {
    return jobs.map(job => this.scheduleJob(job));
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): 'queued' | 'running' | 'completed' | 'not_found' {
    if (!this.jobs.has(jobId)) {
      return 'not_found';
    }

    const queueStats = this.queue.getStatistics();
    if (queueStats.running > 0) {
      // Check if this job is running
      // Since we don't have direct access to running tasks, we assume it's queued
      return 'queued';
    }

    return 'queued';
  }

  /**
   * Get scheduler statistics
   */
  getStatistics(): {
    totalJobs: number;
    queueStatistics: ReturnType<TaskQueue['getStatistics']>;
    resourceUsage: {
      memoryMB: number;
      memoryLimit: number;
      memoryPercent: number;
    };
  } {
    return {
      totalJobs: this.jobs.size,
      queueStatistics: this.queue.getStatistics(),
      resourceUsage: {
        memoryMB: this.currentMemoryUsageMB,
        memoryLimit: this.resourceLimits.maxMemoryMB!,
        memoryPercent: (this.currentMemoryUsageMB / this.resourceLimits.maxMemoryMB!) * 100
      }
    };
  }

  /**
   * Wait for all jobs to complete
   */
  async drain(): Promise<void> {
    await this.queue.drain();
  }

  /**
   * Clear all jobs
   */
  clear(): void {
    this.queue.clear();
    this.jobs.clear();
    this.currentMemoryUsageMB = 0;
    logger.info('Scheduler cleared');
  }
}
