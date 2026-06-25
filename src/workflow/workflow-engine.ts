/**
 * Workflow Engine - Execute and manage workflows
 */

import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import {
  WorkflowDefinition,
  WorkflowStep,
  WorkflowContext,
  WorkflowResult,
  WORKFLOW_TEMPLATES
} from './workflow-definition';

const logger = createLogger('WorkflowEngine');

/**
 * Step executor function
 */
type StepExecutor = (step: WorkflowStep, context: WorkflowContext) => Promise<any>;

/**
 * Workflow Engine
 */
export class WorkflowEngine extends EventEmitter {
  private db: Database.Database;
  private workflows = new Map<string, WorkflowDefinition>();
  private executors = new Map<string, StepExecutor>();
  private activeExecutions = new Map<string, WorkflowContext>();
  private executionLocks = new Map<string, Promise<any>>();

  constructor(dbPath: string) {
    super();
    this.db = new Database(dbPath);
    this.initializeTables();
    this.registerDefaultExecutors();
  }

  /**
   * Initialize database tables
   */
  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        definition TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workflow_executions (
        executionId TEXT PRIMARY KEY,
        workflowId TEXT NOT NULL,
        status TEXT NOT NULL,
        inputs TEXT,
        outputs TEXT,
        startTime INTEGER NOT NULL,
        endTime INTEGER,
        error TEXT,
        FOREIGN KEY (workflowId) REFERENCES workflows(id)
      );

      CREATE TABLE IF NOT EXISTS execution_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        executionId TEXT NOT NULL,
        stepId TEXT NOT NULL,
        status TEXT NOT NULL,
        startTime INTEGER NOT NULL,
        endTime INTEGER,
        result TEXT,
        error TEXT,
        FOREIGN KEY (executionId) REFERENCES workflow_executions(executionId)
      );

      CREATE INDEX IF NOT EXISTS idx_executions_workflow ON workflow_executions(workflowId);
      CREATE INDEX IF NOT EXISTS idx_executions_status ON workflow_executions(status);
      CREATE INDEX IF NOT EXISTS idx_steps_execution ON execution_steps(executionId);
    `);

    logger.info('Workflow engine initialized');
  }

  /**
   * Register default step executors
   */
  private registerDefaultExecutors(): void {
    // Action executor
    this.registerExecutor('action', async (step, context) => {
      if (!step.action) throw new Error('Action not defined');

      const params = this.evaluateExpressions(step.action.parameters, context);
      logger.debug(`Executing action: ${step.action.type}`, params as Error);

      // Simulate action execution
      return { success: true, params };
    });

    // Condition executor
    this.registerExecutor('condition', async (step, context) => {
      if (!step.condition) throw new Error('Condition not defined');

      const result = this.evaluateExpression(step.condition.expression, context);
      logger.debug(`Condition result: ${result}`);

      if (result) {
        return await this.executeSteps(step.condition.then, context);
      } else if (step.condition.else) {
        return await this.executeSteps(step.condition.else, context);
      }

      return null;
    });

    // Loop executor
    this.registerExecutor('loop', async (step, context) => {
      if (!step.loop) throw new Error('Loop not defined');

      const items = this.evaluateExpression(step.loop.items, context);
      if (!Array.isArray(items)) {
        throw new Error('Loop items must be an array');
      }

      const results = [];

      for (const item of items) {
        context.variables[step.loop.variable] = item;
        const result = await this.executeSteps(step.loop.steps, context);
        results.push(result);
      }

      return results;
    });

    // Parallel executor
    this.registerExecutor('parallel', async (step, context) => {
      if (!step.parallel) throw new Error('Parallel steps not defined');

      const promises = step.parallel.steps.map(s => this.executeStep(s, context));
      return await Promise.all(promises);
    });

    // Delay executor
    this.registerExecutor('delay', async (step) => {
      if (!step.delay) throw new Error('Delay not defined');

      await new Promise(resolve => setTimeout(resolve, step.delay!.duration));
      return { delayed: step.delay.duration };
    });

    // Trigger executor
    this.registerExecutor('trigger', async (step, context) => {
      if (!step.trigger) throw new Error('Trigger not defined');

      const params = step.trigger.parameters
        ? this.evaluateExpressions(step.trigger.parameters, context)
        : {};

      const result = await this.execute(step.trigger.workflowId, params);
      return result;
    });
  }

  /**
   * Register workflow
   */
  registerWorkflow(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.id, workflow);

    this.db
      .prepare(
        `INSERT OR REPLACE INTO workflows (id, name, definition, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        workflow.id,
        workflow.name,
        JSON.stringify(workflow),
        workflow.createdAt || Date.now(),
        Date.now()
      );

    logger.info(`Workflow registered: ${workflow.name} (${workflow.id})`);
    this.emit('workflow-registered', workflow);
  }

  /**
   * Register step executor
   */
  registerExecutor(stepType: string, executor: StepExecutor): void {
    this.executors.set(stepType, executor);
    logger.debug(`Executor registered: ${stepType}`);
  }

  /**
   * Execute workflow
   */
  async execute(workflowId: string, inputs: Record<string, any> = {}): Promise<WorkflowResult> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Use lock to protect concurrent access
    const executionPromise = this.executeInternal(executionId, workflow, inputs);
    this.executionLocks.set(executionId, executionPromise);

    try {
      return await executionPromise;
    } finally {
      this.executionLocks.delete(executionId);
    }
  }

  /**
   * Internal execution logic
   */
  private async executeInternal(
    executionId: string,
    workflow: WorkflowDefinition,
    inputs: Record<string, any>
  ): Promise<WorkflowResult> {
    const context: WorkflowContext = {
      workflowId: workflow.id,
      executionId,
      inputs,
      variables: { ...inputs },
      stepResults: new Map(),
      startTime: Date.now(),
      status: 'running'
    };

    this.activeExecutions.set(executionId, context);

    // Store execution
    this.db
      .prepare(
        `INSERT INTO workflow_executions (executionId, workflowId, status, inputs, startTime)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(executionId, workflow.id, 'running', JSON.stringify(inputs), context.startTime);

    logger.info(`Workflow execution started: ${workflow.name} (${executionId})`);
    this.emit('execution-started', { executionId, workflowId: workflow.id, inputs });

    try {
      // Execute all steps
      await this.executeSteps(workflow.steps, context);

      // Evaluate outputs
      const outputs = workflow.outputs
        ? this.evaluateExpressions(workflow.outputs, context)
        : {};

      context.status = 'completed';
      context.endTime = Date.now();

      // Update execution
      this.db
        .prepare(
          `UPDATE workflow_executions
           SET status = ?, outputs = ?, endTime = ?
           WHERE executionId = ?`
        )
        .run('completed', JSON.stringify(outputs), context.endTime, executionId);

      const result: WorkflowResult = {
        executionId,
        workflowId: workflow.id,
        status: 'success',
        outputs,
        duration: context.endTime - context.startTime,
        steps: this.getExecutionSteps(executionId)
      };

      logger.info(`Workflow execution completed: ${executionId} (${result.duration}ms)`);
      this.emit('execution-completed', result);

      return result;
    } catch (error: any) {
      context.status = 'failed';
      context.error = error;
      context.endTime = Date.now();

      // Update execution
      this.db
        .prepare(
          `UPDATE workflow_executions
           SET status = ?, error = ?, endTime = ?
           WHERE executionId = ?`
        )
        .run('failed', error.message, context.endTime, executionId);

      const result: WorkflowResult = {
        executionId,
        workflowId: workflow.id,
        status: 'failure',
        duration: context.endTime - context.startTime,
        steps: this.getExecutionSteps(executionId),
        error: error.message
      };

      logger.error(`Workflow execution failed: ${executionId}`, error as Error);
      this.emit('execution-failed', result);

      throw error;
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Execute steps
   */
  private async executeSteps(steps: WorkflowStep[], context: WorkflowContext): Promise<any> {
    let lastResult: any = null;

    for (const step of steps) {
      lastResult = await this.executeStep(step, context);
    }

    return lastResult;
  }

  /**
   * Execute single step
   */
  private async executeStep(step: WorkflowStep, context: WorkflowContext): Promise<any> {
    const startTime = Date.now();

    logger.debug(`Executing step: ${step.name} (${step.type})`);

    // Store step start
    const stepRecordId = this.db
      .prepare(
        `INSERT INTO execution_steps (executionId, stepId, status, startTime)
         VALUES (?, ?, ?, ?)`
      )
      .run(context.executionId, step.id, 'running', startTime)
      .lastInsertRowid;

    try {
      const executor = this.executors.get(step.type);
      if (!executor) {
        throw new Error(`No executor found for step type: ${step.type}`);
      }

      // Execute with timeout
      const result = step.timeout
        ? await this.executeWithTimeout(executor, step, context, step.timeout)
        : await executor(step, context);

      // Store result
      context.stepResults.set(step.id, result);
      context.variables[`steps.${step.id}.result`] = result;

      const endTime = Date.now();

      // Update step
      this.db
        .prepare(
          `UPDATE execution_steps
           SET status = ?, endTime = ?, result = ?
           WHERE id = ?`
        )
        .run('success', endTime, JSON.stringify(result), stepRecordId);

      logger.debug(`Step completed: ${step.name} (${endTime - startTime}ms)`);
      this.emit('step-completed', { stepId: step.id, result });

      return result;
    } catch (error: any) {
      const endTime = Date.now();

      // Handle error
      if (step.onError) {
        if (step.onError.retry) {
          return await this.retryStep(step, context, error);
        }

        if (step.onError.fallback) {
          logger.warn(`Step failed, executing fallback: ${step.name}`);
          return await this.executeSteps(step.onError.fallback, context);
        }

        if (step.onError.continueOnError) {
          logger.warn(`Step failed, continuing: ${step.name}`, error);
          return null;
        }
      }

      // Update step
      this.db
        .prepare(
          `UPDATE execution_steps
           SET status = ?, endTime = ?, error = ?
           WHERE id = ?`
        )
        .run('failure', endTime, error.message, stepRecordId);

      logger.error(`Step failed: ${step.name}`, error as Error);
      this.emit('step-failed', { stepId: step.id, error: error.message });

      throw error;
    }
  }

  /**
   * Retry step execution
   */
  private async retryStep(step: WorkflowStep, context: WorkflowContext, initialError: Error): Promise<any> {
    if (!step.onError?.retry) throw initialError;

    const { maxAttempts, backoff, initialDelay } = step.onError.retry;
    const MAX_SAFE_ATTEMPTS = 10;

    if (maxAttempts > MAX_SAFE_ATTEMPTS) {
      logger.warn(`maxAttempts (${maxAttempts}) exceeds safe limit (${MAX_SAFE_ATTEMPTS}), capping`);
    }

    const safeAttempts = Math.min(maxAttempts, MAX_SAFE_ATTEMPTS);

    // Use loop instead of recursion to avoid stack overflow
    for (let attempt = 1; attempt <= safeAttempts; attempt++) {
      const delay = backoff === 'exponential'
        ? Math.min(initialDelay * Math.pow(2, attempt - 1), 60000) // cap at 60s
        : initialDelay * attempt;

      logger.info(`Retrying step: ${step.name} (attempt ${attempt}/${safeAttempts})`);

      await new Promise(resolve => setTimeout(resolve, delay));

      try {
        const executor = this.executors.get(step.type);
        if (!executor) throw new Error(`No executor for type: ${step.type}`);

        return await executor(step, context);
      } catch (error: any) {
        if (attempt === safeAttempts) throw error;
      }
    }

    throw initialError;
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout(
    executor: StepExecutor,
    step: WorkflowStep,
    context: WorkflowContext,
    timeout: number
  ): Promise<any> {
    let timeoutHandle: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error(`Step timeout: ${step.name}`)),
        timeout
      );
    });

    try {
      const result = await Promise.race([
        executor(step, context),
        timeoutPromise
      ]);
      return result;
    } finally {
      // Always clean up timeout
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  /**
   * Evaluate expression (SAFE: no code execution, only variable substitution)
   */
  private evaluateExpression(expression: string, context: WorkflowContext): any {
    // Simple template evaluation using safe variable substitution
    // NOTE: This is a basic implementation. For production, consider using
    // a proper template engine like Handlebars or Mustache for more features
    try {
      const templateRegex = /\{\{\s*(.+?)\s*\}\}/g;
      let result = expression;

      const matches = expression.match(templateRegex);
      if (!matches) return expression;

      for (const match of matches) {
        const path = match.replace(/\{\{\s*|\s*\}\}/g, '').trim();

        // Security: Only allow safe variable paths (alphanumeric, dots, underscores)
        if (!/^[a-zA-Z0-9._]+$/.test(path)) {
          logger.warn(`Invalid expression path: ${path}`);
          continue;
        }

        const value = this.resolveVariable(path, context);

        // Convert value to string safely
        const stringValue = value !== undefined && value !== null
          ? String(value)
          : '';

        result = result.replace(match, stringValue);
      }

      return result;
    } catch (error: any) {
      logger.warn(`Failed to evaluate expression: ${expression}`, error as Error);
      return expression;
    }
  }

  /**
   * Evaluate expressions in object
   */
  private evaluateExpressions(obj: Record<string, any>, context: WorkflowContext): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = this.evaluateExpression(value, context);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = this.evaluateExpressions(value, context);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Resolve variable from context
   */
  private resolveVariable(path: string, context: WorkflowContext): any {
    const parts = path.split('.');
    let current: any = context;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Get execution steps
   */
  private getExecutionSteps(executionId: string): WorkflowResult['steps'] {
    const rows = this.db
      .prepare(
        `SELECT stepId, status, startTime, endTime, result, error
         FROM execution_steps
         WHERE executionId = ?
         ORDER BY startTime`
      )
      .all(executionId) as any[];

    return rows.map(row => ({
      stepId: row.stepId,
      status: row.status,
      startTime: row.startTime,
      endTime: row.endTime,
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error
    }));
  }

  /**
   * Cancel execution
   */
  async cancel(executionId: string): Promise<void> {
    // Wait for any in-progress operations to complete
    const lock = this.executionLocks.get(executionId);
    if (lock) {
      await lock.catch(() => {}); // Ignore errors, just wait
    }

    const context = this.activeExecutions.get(executionId);
    if (!context) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    context.status = 'cancelled';
    context.endTime = Date.now();

    this.db
      .prepare(
        `UPDATE workflow_executions
         SET status = ?, endTime = ?
         WHERE executionId = ?`
      )
      .run('cancelled', context.endTime, executionId);

    this.activeExecutions.delete(executionId);

    logger.info(`Workflow execution cancelled: ${executionId}`);
    this.emit('execution-cancelled', executionId);
  }

  /**
   * Get workflow
   */
  getWorkflow(workflowId: string): WorkflowDefinition | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * List workflows
   */
  listWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Get execution
   */
  getExecution(executionId: string): any {
    return this.db
      .prepare(
        `SELECT * FROM workflow_executions WHERE executionId = ?`
      )
      .get(executionId);
  }

  /**
   * List executions
   */
  listExecutions(workflowId?: string, limit: number = 50): any[] {
    const query = workflowId
      ? `SELECT * FROM workflow_executions WHERE workflowId = ? ORDER BY startTime DESC LIMIT ?`
      : `SELECT * FROM workflow_executions ORDER BY startTime DESC LIMIT ?`;

    return workflowId
      ? this.db.prepare(query).all(workflowId, limit)
      : this.db.prepare(query).all(limit);
  }

  /**
   * Get workflow templates
   */
  getTemplates(): typeof WORKFLOW_TEMPLATES {
    return WORKFLOW_TEMPLATES;
  }

  /**
   * Create workflow from template
   */
  createFromTemplate(templateId: string, workflowId: string, name: string): WorkflowDefinition {
    const template = WORKFLOW_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const workflow: WorkflowDefinition = {
      ...template.definition,
      id: workflowId,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.registerWorkflow(workflow);

    return workflow;
  }

  /**
   * Close database and cleanup resources
   */
  close(): void {
    // Cancel all active executions
    const executionIds = Array.from(this.activeExecutions.keys());
    for (const executionId of executionIds) {
      this.cancel(executionId).catch(err =>
        logger.error(`Failed to cancel execution ${executionId}:`, err as Error)
      );
    }

    // Close database
    if (this.db) {
      this.db.close();
      logger.info('Workflow engine closed');
    }

    // Clear all maps
    this.workflows.clear();
    this.executors.clear();
    this.activeExecutions.clear();
    this.executionLocks.clear();
  }
}
