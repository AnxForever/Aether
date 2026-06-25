/**
 * Workflow Skill - Expose workflows as AI-callable skills
 */

import { Skill, Tool, ToolResult } from '../types';
import { WorkflowIntegration } from '../core/workflow-integration';
import { createLogger } from '../utils/logger';

const logger = createLogger('WorkflowSkill');

/**
 * Create workflow skill from WorkflowIntegration
 */
export function createWorkflowSkill(workflowIntegration: WorkflowIntegration): Skill {
  const tools: Tool[] = [
    // List workflows
    {
      name: 'list_workflows',
      description: 'List all available workflows with their details',
      parameters: [
        {
          name: 'category',
          type: 'string',
          description: 'Filter by category (optional)',
          required: false
        },
        {
          name: 'tags',
          type: 'array',
          description: 'Filter by tags (optional)',
          required: false
        }
      ],
      handler: async (params): Promise<ToolResult> => {
        try {
          let workflows = workflowIntegration.listWorkflows();

          // Filter by category if provided
          if (params.category) {
            workflows = workflows.filter(w => w.category === params.category);
          }

          // Filter by tags if provided
          if (params.tags && Array.isArray(params.tags)) {
            workflows = workflows.filter(w =>
              w.tags?.some(tag => params.tags.includes(tag))
            );
          }

          const summary = workflows.map(w => ({
            id: w.id,
            name: w.name,
            description: w.description,
            category: w.category,
            tags: w.tags,
            inputs: w.inputs?.map(i => ({
              name: i.name,
              type: i.type,
              required: i.required,
              description: i.description
            }))
          }));

          return {
            success: true,
            data: {
              total: workflows.length,
              workflows: summary
            }
          };
        } catch (error) {
          logger.error('Failed to list workflows:', error as Error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list workflows'
          };
        }
      }
    },

    // Get workflow details
    {
      name: 'get_workflow',
      description: 'Get detailed information about a specific workflow',
      parameters: [
        {
          name: 'workflowId',
          type: 'string',
          description: 'Workflow ID',
          required: true
        }
      ],
      handler: async (params): Promise<ToolResult> => {
        try {
          const workflow = workflowIntegration.getWorkflow(params.workflowId);

          if (!workflow) {
            return {
              success: false,
              error: `Workflow not found: ${params.workflowId}`
            };
          }

          return {
            success: true,
            data: workflow
          };
        } catch (error) {
          logger.error('Failed to get workflow:', error as Error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get workflow'
          };
        }
      }
    },

    // Execute workflow
    {
      name: 'execute_workflow',
      description: 'Execute a workflow with given inputs',
      parameters: [
        {
          name: 'workflowId',
          type: 'string',
          description: 'Workflow ID to execute',
          required: true
        },
        {
          name: 'inputs',
          type: 'object',
          description: 'Input parameters for the workflow',
          required: false,
          schema: {
            type: 'object',
            additionalProperties: true
          }
        }
      ],
      handler: async (params): Promise<ToolResult> => {
        try {
          const workflow = workflowIntegration.getWorkflow(params.workflowId);

          if (!workflow) {
            return {
              success: false,
              error: `Workflow not found: ${params.workflowId}`
            };
          }

          // Validate required inputs
          const requiredInputs = workflow.inputs?.filter(i => i.required) || [];
          const providedInputs = params.inputs || {};
          const missingInputs = requiredInputs.filter(
            i => !(i.name in providedInputs)
          );

          if (missingInputs.length > 0) {
            return {
              success: false,
              error: `Missing required inputs: ${missingInputs.map(i => i.name).join(', ')}`
            };
          }

          logger.info(`Executing workflow: ${params.workflowId}`, providedInputs);

          const result = await workflowIntegration.executeWorkflow(
            params.workflowId,
            providedInputs
          );

          return {
            success: result.status === 'success',
            data: {
              executionId: result.executionId,
              status: result.status,
              outputs: result.outputs,
              duration: result.duration,
              steps: result.steps.map(s => ({
                stepId: s.stepId,
                status: s.status,
                duration: s.endTime - s.startTime
              }))
            },
            error: result.error
          };
        } catch (error) {
          logger.error('Failed to execute workflow:', error as Error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to execute workflow'
          };
        }
      }
    },

    // Get execution status
    {
      name: 'get_execution_status',
      description: 'Get the status of a workflow execution',
      parameters: [
        {
          name: 'executionId',
          type: 'string',
          description: 'Execution ID',
          required: true
        }
      ],
      handler: async (params): Promise<ToolResult> => {
        try {
          const status = workflowIntegration.getExecutionStatus(params.executionId);

          if (!status) {
            return {
              success: false,
              error: `Execution not found: ${params.executionId}`
            };
          }

          return {
            success: true,
            data: status
          };
        } catch (error) {
          logger.error('Failed to get execution status:', error as Error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get execution status'
          };
        }
      }
    },

    // Get workflow execution history
    {
      name: 'get_workflow_history',
      description: 'Get execution history for a workflow',
      parameters: [
        {
          name: 'workflowId',
          type: 'string',
          description: 'Workflow ID',
          required: true
        },
        {
          name: 'limit',
          type: 'number',
          description: 'Maximum number of executions to return',
          required: false,
          schema: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            default: 50
          }
        }
      ],
      handler: async (params): Promise<ToolResult> => {
        try {
          const limit = params.limit || 50;
          const history = workflowIntegration.getExecutionHistory(params.workflowId, limit);

          return {
            success: true,
            data: {
              workflowId: params.workflowId,
              executions: history
            }
          };
        } catch (error) {
          logger.error('Failed to get workflow history:', error as Error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get workflow history'
          };
        }
      }
    },

    // Cancel execution
    {
      name: 'cancel_execution',
      description: 'Cancel a running workflow execution',
      parameters: [
        {
          name: 'executionId',
          type: 'string',
          description: 'Execution ID to cancel',
          required: true
        }
      ],
      handler: async (params): Promise<ToolResult> => {
        try {
          await workflowIntegration.cancelExecution(params.executionId);

          return {
            success: true,
            data: {
              executionId: params.executionId,
              status: 'cancelled'
            }
          };
        } catch (error) {
          logger.error('Failed to cancel execution:', error as Error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to cancel execution'
          };
        }
      }
    }
  ];

  const skill: Skill = {
    id: 'workflow-automation',
    name: 'Workflow Automation',
    description: 'Execute automated workflows including code deployment, data processing, and batch operations',
    version: '1.0.0',
    author: 'Nexus Agent',
    enabled: true,
    tools
  };

  return skill;
}
