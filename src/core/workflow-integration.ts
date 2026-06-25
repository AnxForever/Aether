/**
 * Workflow Integration - Connect WorkflowEngine to Nexus Agent
 */

import { EventEmitter } from 'events';
import { WorkflowEngine } from '../workflow/workflow-engine';
import { WorkflowDefinition, WorkflowResult } from '../workflow/workflow-definition';
import { createLogger } from '../utils/logger';
import { Cron } from 'croner';
import path from 'path';

const logger = createLogger('WorkflowIntegration');

export interface WorkflowIntegrationConfig {
  dataDir: string;
  enableScheduler?: boolean;
  autoRegisterTemplates?: boolean;
}

export class WorkflowIntegration extends EventEmitter {
  private engine: WorkflowEngine;
  private config: WorkflowIntegrationConfig;
  private schedulers = new Map<string, Cron>();
  private initialized = false;

  constructor(config: WorkflowIntegrationConfig) {
    super();
    this.config = config;

    const dbPath = path.join(config.dataDir, 'workflows.db');
    this.engine = new WorkflowEngine(dbPath);

    this.setupEventForwarding();
  }

  /**
   * Setup event forwarding from WorkflowEngine
   */
  private setupEventForwarding(): void {
    this.engine.on('workflow-registered', (workflow) => {
      logger.info(`Workflow registered: ${workflow.name}`);
      this.emit('workflow:registered', workflow);
    });

    this.engine.on('execution-started', (data) => {
      logger.info(`Execution started: ${data.executionId}`);
      this.emit('workflow:execution:started', data);
    });

    this.engine.on('execution-completed', (data) => {
      logger.info(`Execution completed: ${data.executionId}`);
      this.emit('workflow:execution:completed', data);
    });

    this.engine.on('execution-failed', (data) => {
      logger.error(`Execution failed: ${data.executionId}`, data.error);
      this.emit('workflow:execution:failed', data);
    });

    this.engine.on('step-started', (data) => {
      this.emit('workflow:step:started', data);
    });

    this.engine.on('step-completed', (data) => {
      this.emit('workflow:step:completed', data);
    });
  }

  /**
   * Initialize workflow integration
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('WorkflowIntegration already initialized');
      return;
    }

    logger.info('Initializing WorkflowIntegration...');

    // Auto-register templates if enabled
    if (this.config.autoRegisterTemplates !== false) {
      await this.registerBuiltInTemplates();
    }

    // Setup scheduler if enabled
    if (this.config.enableScheduler !== false) {
      await this.setupSchedulers();
    }

    this.initialized = true;
    logger.info('WorkflowIntegration initialized');
  }

  /**
   * Register built-in workflow templates
   */
  private async registerBuiltInTemplates(): Promise<void> {
    const { WORKFLOW_TEMPLATES } = await import('../workflow/templates');

    for (const template of WORKFLOW_TEMPLATES) {
      const workflow: WorkflowDefinition = {
        id: template.id,
        name: template.name,
        description: template.description,
        version: template.definition.version,
        triggers: template.definition.triggers,
        inputs: template.definition.inputs,
        steps: template.definition.steps,
        outputs: template.definition.outputs,
        tags: template.tags,
        category: template.category,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      this.engine.registerWorkflow(workflow);
      logger.info(`Registered template: ${template.name}`);
    }
  }

  /**
   * Setup schedulers for scheduled workflows
   */
  private async setupSchedulers(): Promise<void> {
    const workflows = this.engine.listWorkflows();

    for (const workflow of workflows) {
      for (const trigger of workflow.triggers) {
        if (trigger.type === 'schedule' && trigger.schedule) {
          this.scheduleWorkflow(workflow.id, trigger.schedule.cron, trigger.schedule.timezone);
        }
      }
    }

    logger.info(`Setup ${this.schedulers.size} schedulers`);
  }

  /**
   * Schedule a workflow with cron expression
   */
  scheduleWorkflow(workflowId: string, cronExpression: string, timezone?: string): void {
    // Remove existing scheduler if any
    this.unscheduleWorkflow(workflowId);

    const job = new Cron(
      cronExpression,
      {
        timezone: timezone || 'UTC'
      },
      async () => {
        try {
          logger.info(`Executing scheduled workflow: ${workflowId}`);
          await this.engine.execute(workflowId, {});
        } catch (error) {
          logger.error(`Failed to execute scheduled workflow ${workflowId}:`, error as Error);
        }
      }
    );

    this.schedulers.set(workflowId, job);
    logger.info(`Scheduled workflow ${workflowId} with cron: ${cronExpression}`);
  }

  /**
   * Unschedule a workflow
   */
  unscheduleWorkflow(workflowId: string): void {
    const job = this.schedulers.get(workflowId);
    if (job) {
      job.stop();
      this.schedulers.delete(workflowId);
      logger.info(`Unscheduled workflow: ${workflowId}`);
    }
  }

  /**
   * Register a new workflow
   */
  registerWorkflow(workflow: WorkflowDefinition): void {
    this.engine.registerWorkflow(workflow);

    // Setup scheduler if workflow has schedule trigger
    if (this.config.enableScheduler !== false) {
      for (const trigger of workflow.triggers) {
        if (trigger.type === 'schedule' && trigger.schedule) {
          this.scheduleWorkflow(workflow.id, trigger.schedule.cron, trigger.schedule.timezone);
        }
      }
    }
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflowId: string, inputs: Record<string, any> = {}): Promise<WorkflowResult> {
    return await this.engine.execute(workflowId, inputs);
  }

  /**
   * List all workflows
   */
  listWorkflows(): WorkflowDefinition[] {
    return this.engine.listWorkflows();
  }

  /**
   * Get workflow by ID
   */
  getWorkflow(workflowId: string): WorkflowDefinition | undefined {
    return this.engine.getWorkflow(workflowId);
  }

  /**
   * Get execution status
   */
  getExecutionStatus(executionId: string): any {
    return this.engine.getExecution(executionId);
  }

  /**
   * Get workflow execution history
   */
  getExecutionHistory(workflowId: string, limit: number = 50): any[] {
    return this.engine.listExecutions(workflowId, limit);
  }

  /**
   * Cancel a running execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    await this.engine.cancel(executionId);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up WorkflowIntegration...');

    // Stop all schedulers
    for (const [workflowId, job] of this.schedulers.entries()) {
      job.stop();
      logger.debug(`Stopped scheduler for workflow: ${workflowId}`);
    }
    this.schedulers.clear();

    // Close database
    this.engine.close();

    this.initialized = false;
    logger.info('WorkflowIntegration cleanup complete');
  }
}
