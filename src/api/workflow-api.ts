/**
 * Workflow API - REST API endpoints for workflow management
 */

import { Router, Request, Response } from 'express';
import { WorkflowIntegration } from '../core/workflow-integration';
import { WorkflowDefinition } from '../workflow/workflow-definition';
import { createLogger } from '../utils/logger';

const logger = createLogger('WorkflowAPI');

export interface WorkflowAPIConfig {
  workflowIntegration: WorkflowIntegration;
}

/**
 * Create workflow API router
 */
export function createWorkflowAPI(config: WorkflowAPIConfig): Router {
  const router = Router();
  const { workflowIntegration } = config;

  // ========================================================================
  // GET /workflows - List all workflows
  // ========================================================================
  router.get('/workflows', async (req: Request, res: Response) => {
    try {
      const { category, tags } = req.query;

      let workflows = workflowIntegration.listWorkflows();

      // Filter by category
      if (category && typeof category === 'string') {
        workflows = workflows.filter(w => w.category === category);
      }

      // Filter by tags
      if (tags) {
        const tagArray = typeof tags === 'string' ? tags.split(',') : Array.isArray(tags) ? tags : [];
        workflows = workflows.filter(w =>
          w.tags?.some(tag => tagArray.includes(tag))
        );
      }

      res.json({
        success: true,
        data: {
          total: workflows.length,
          workflows: workflows.map(w => ({
            id: w.id,
            name: w.name,
            description: w.description,
            category: w.category,
            tags: w.tags,
            version: w.version,
            triggers: w.triggers.map(t => t.type),
            inputCount: w.inputs?.length || 0,
            createdAt: w.createdAt,
            updatedAt: w.updatedAt
          }))
        }
      });
    } catch (error) {
      logger.error('Failed to list workflows:', error as Error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list workflows'
      });
    }
  });

  // ========================================================================
  // POST /workflows - Create new workflow
  // ========================================================================
  router.post('/workflows', async (req: Request, res: Response) => {
    try {
      const workflowDef: WorkflowDefinition = req.body;

      // Validate required fields
      if (!workflowDef.id || !workflowDef.name || !workflowDef.steps) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: id, name, steps'
        });
        return;
      }

      // Set timestamps
      workflowDef.createdAt = Date.now();
      workflowDef.updatedAt = Date.now();

      workflowIntegration.registerWorkflow(workflowDef);

      logger.info(`Workflow created: ${workflowDef.name} (${workflowDef.id})`);

      res.status(201).json({
        success: true,
        data: {
          id: workflowDef.id,
          name: workflowDef.name,
          createdAt: workflowDef.createdAt
        }
      });
    } catch (error) {
      logger.error('Failed to create workflow:', error as Error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create workflow'
      });
    }
  });

  // ========================================================================
  // GET /workflows/:id - Get workflow details
  // ========================================================================
  router.get('/workflows/:id', async (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const workflow = workflowIntegration.getWorkflow(id);

      if (!workflow) {
        res.status(404).json({
          success: false,
          error: `Workflow not found: ${id}`
        });
        return;
      }

      res.json({
        success: true,
        data: workflow
      });
    } catch (error) {
      logger.error('Failed to get workflow:', error as Error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get workflow'
      });
    }
  });

  // ========================================================================
  // POST /workflows/:id/execute - Execute workflow
  // ========================================================================
  router.post('/workflows/:id/execute', async (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const inputs = req.body.inputs || {};

      const workflow = workflowIntegration.getWorkflow(id);

      if (!workflow) {
        res.status(404).json({
          success: false,
          error: `Workflow not found: ${id}`
        });
        return;
      }

      // Validate required inputs
      const requiredInputs = workflow.inputs?.filter(i => i.required) || [];
      const missingInputs = requiredInputs.filter(i => !(i.name in inputs));

      if (missingInputs.length > 0) {
        res.status(400).json({
          success: false,
          error: `Missing required inputs: ${missingInputs.map(i => i.name).join(', ')}`
        });
        return;
      }

      logger.info(`Executing workflow: ${id}`, inputs);

      const result = await workflowIntegration.executeWorkflow(id, inputs);

      res.json({
        success: result.status === 'success',
        data: {
          executionId: result.executionId,
          workflowId: result.workflowId,
          status: result.status,
          outputs: result.outputs,
          duration: result.duration,
          steps: result.steps
        },
        error: result.error
      });
    } catch (error) {
      logger.error('Failed to execute workflow:', error as Error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute workflow'
      });
    }
  });

  // ========================================================================
  // GET /workflows/:id/executions - Get workflow execution history
  // ========================================================================
  router.get('/workflows/:id/executions', async (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const limitStr = req.query.limit as string | undefined;
      const limit = limitStr ? parseInt(limitStr, 10) : 50;

      const workflow = workflowIntegration.getWorkflow(id);

      if (!workflow) {
        res.status(404).json({
          success: false,
          error: `Workflow not found: ${id}`
        });
        return;
      }

      const history = workflowIntegration.getExecutionHistory(id, limit);

      res.json({
        success: true,
        data: {
          workflowId: id,
          workflowName: workflow.name,
          total: history.length,
          executions: history
        }
      });
    } catch (error) {
      logger.error('Failed to get workflow history:', error as Error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get workflow history'
      });
    }
  });

  // ========================================================================
  // GET /executions/:id - Get execution status
  // ========================================================================
  router.get('/executions/:id', async (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const status = workflowIntegration.getExecutionStatus(id);

      if (!status) {
        res.status(404).json({
          success: false,
          error: `Execution not found: ${id}`
        });
        return;
      }

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Failed to get execution status:', error as Error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get execution status'
      });
    }
  });

  // ========================================================================
  // POST /executions/:id/cancel - Cancel execution
  // ========================================================================
  router.post('/executions/:id/cancel', async (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const status = workflowIntegration.getExecutionStatus(id);

      if (!status) {
        res.status(404).json({
          success: false,
          error: `Execution not found: ${id}`
        });
        return;
      }

      await workflowIntegration.cancelExecution(id);

      logger.info(`Execution cancelled: ${id}`);

      res.json({
        success: true,
        data: {
          executionId: id,
          status: 'cancelled'
        }
      });
    } catch (error) {
      logger.error('Failed to cancel execution:', error as Error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel execution'
      });
    }
  });

  // ========================================================================
  // GET /workflows/categories - Get workflow categories
  // ========================================================================
  router.get('/workflows/categories', async (req: Request, res: Response) => {
    try {
      const workflows = workflowIntegration.listWorkflows();
      const categories = Array.from(
        new Set(workflows.map(w => w.category).filter(Boolean))
      );

      res.json({
        success: true,
        data: {
          total: categories.length,
          categories: categories.map(cat => ({
            name: cat,
            count: workflows.filter(w => w.category === cat).length
          }))
        }
      });
    } catch (error) {
      logger.error('Failed to get categories:', error as Error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get categories'
      });
    }
  });

  // ========================================================================
  // GET /workflows/tags - Get all workflow tags
  // ========================================================================
  router.get('/workflows/tags', async (req: Request, res: Response) => {
    try {
      const workflows = workflowIntegration.listWorkflows();
      const allTags = workflows.flatMap(w => w.tags || []);
      const tagCounts = allTags.reduce((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      res.json({
        success: true,
        data: {
          total: Object.keys(tagCounts).length,
          tags: Object.entries(tagCounts).map(([tag, count]) => ({
            name: tag,
            count
          }))
        }
      });
    } catch (error) {
      logger.error('Failed to get tags:', error as Error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get tags'
      });
    }
  });

  logger.info('Workflow API routes registered');

  return router;
}
