/**
 * Workflow Definition - Schema and types for workflows
 */

/**
 * Workflow step types
 */
export type StepType =
  | 'action'      // Execute an action
  | 'condition'   // Conditional branch
  | 'loop'        // Loop over items
  | 'parallel'    // Execute steps in parallel
  | 'delay'       // Wait for duration
  | 'trigger';    // Trigger another workflow

/**
 * Workflow step
 */
export interface WorkflowStep {
  id: string;
  type: StepType;
  name: string;
  description?: string;

  // Action step
  action?: {
    type: string;
    parameters: Record<string, any>;
  };

  // Condition step
  condition?: {
    expression: string;
    then: WorkflowStep[];
    else?: WorkflowStep[];
  };

  // Loop step
  loop?: {
    items: string; // Expression that evaluates to array
    variable: string;
    steps: WorkflowStep[];
  };

  // Parallel step
  parallel?: {
    steps: WorkflowStep[];
  };

  // Delay step
  delay?: {
    duration: number; // milliseconds
  };

  // Trigger step
  trigger?: {
    workflowId: string;
    parameters?: Record<string, any>;
  };

  // Error handling
  onError?: {
    retry?: {
      maxAttempts: number;
      backoff: 'linear' | 'exponential';
      initialDelay: number;
    };
    fallback?: WorkflowStep[];
    continueOnError?: boolean;
  };

  // Timeout
  timeout?: number;
}

/**
 * Workflow trigger
 */
export interface WorkflowTrigger {
  type: 'manual' | 'schedule' | 'event' | 'webhook';

  // Schedule trigger
  schedule?: {
    cron: string;
    timezone?: string;
  };

  // Event trigger
  event?: {
    name: string;
    filters?: Record<string, any>;
  };

  // Webhook trigger
  webhook?: {
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    authentication?: {
      type: 'bearer' | 'basic' | 'apikey';
      credentials: Record<string, string>;
    };
  };
}

/**
 * Workflow definition
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;

  // Triggers
  triggers: WorkflowTrigger[];

  // Input parameters
  inputs?: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required?: boolean;
    default?: any;
    description?: string;
  }>;

  // Workflow steps
  steps: WorkflowStep[];

  // Output
  outputs?: Record<string, string>; // Variable name -> expression

  // Metadata
  tags?: string[];
  category?: string;
  author?: string;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Workflow execution context
 */
export interface WorkflowContext {
  workflowId: string;
  executionId: string;
  inputs: Record<string, any>;
  variables: Record<string, any>;
  stepResults: Map<string, any>;
  startTime: number;
  endTime?: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  error?: Error;
}

/**
 * Workflow execution result
 */
export interface WorkflowResult {
  executionId: string;
  workflowId: string;
  status: 'success' | 'failure';
  outputs?: Record<string, any>;
  duration: number;
  steps: Array<{
    stepId: string;
    status: 'success' | 'failure' | 'skipped';
    startTime: number;
    endTime: number;
    result?: any;
    error?: string;
  }>;
  error?: string;
}

/**
 * Workflow template
 */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  definition: Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt'>;
  examples?: Array<{
    name: string;
    inputs: Record<string, any>;
    expectedOutputs: Record<string, any>;
  }>;
}

/**
 * Built-in workflow templates
 */
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'data-processing',
    name: 'Data Processing Pipeline',
    description: 'Process data with transformation, validation, and storage',
    category: 'Data',
    tags: ['data', 'etl', 'pipeline'],
    definition: {
      name: 'Data Processing',
      version: '1.0.0',
      triggers: [{ type: 'manual' }],
      inputs: [
        { name: 'dataSource', type: 'string', required: true },
        { name: 'transformRules', type: 'object', required: true }
      ],
      steps: [
        {
          id: 'fetch',
          type: 'action',
          name: 'Fetch Data',
          action: {
            type: 'http.get',
            parameters: { url: '{{ inputs.dataSource }}' }
          }
        },
        {
          id: 'transform',
          type: 'action',
          name: 'Transform Data',
          action: {
            type: 'data.transform',
            parameters: {
              data: '{{ steps.fetch.result }}',
              rules: '{{ inputs.transformRules }}'
            }
          }
        },
        {
          id: 'save',
          type: 'action',
          name: 'Save Results',
          action: {
            type: 'storage.save',
            parameters: { data: '{{ steps.transform.result }}' }
          }
        }
      ],
      outputs: {
        recordCount: '{{ steps.save.result.count }}',
        location: '{{ steps.save.result.path }}'
      }
    }
  },
  {
    id: 'notification-workflow',
    name: 'Multi-Channel Notification',
    description: 'Send notifications via email, Slack, and SMS',
    category: 'Communication',
    tags: ['notification', 'alert', 'communication'],
    definition: {
      name: 'Send Notifications',
      version: '1.0.0',
      triggers: [{ type: 'manual' }],
      inputs: [
        { name: 'message', type: 'string', required: true },
        { name: 'channels', type: 'array', required: true },
        { name: 'priority', type: 'string', default: 'normal' }
      ],
      steps: [
        {
          id: 'send-parallel',
          type: 'parallel',
          name: 'Send to All Channels',
          parallel: {
            steps: [
              {
                id: 'email',
                type: 'condition',
                name: 'Send Email',
                condition: {
                  expression: '{{ "email" in inputs.channels }}',
                  then: [
                    {
                      id: 'send-email',
                      type: 'action',
                      name: 'Send Email',
                      action: {
                        type: 'email.send',
                        parameters: { message: '{{ inputs.message }}' }
                      }
                    }
                  ]
                }
              },
              {
                id: 'slack',
                type: 'condition',
                name: 'Send Slack',
                condition: {
                  expression: '{{ "slack" in inputs.channels }}',
                  then: [
                    {
                      id: 'send-slack',
                      type: 'action',
                      name: 'Send Slack Message',
                      action: {
                        type: 'slack.send',
                        parameters: { message: '{{ inputs.message }}' }
                      }
                    }
                  ]
                }
              }
            ]
          }
        }
      ],
      outputs: {
        sent: '{{ steps.send-parallel.result.length }}'
      }
    }
  }
];
