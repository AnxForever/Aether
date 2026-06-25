/**
 * Workflow Templates - Pre-built workflow definitions
 */

import { WorkflowTemplate } from './workflow-definition';

/**
 * Built-in workflow templates
 */
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  // ========================================================================
  // Code Deployment Workflow
  // ========================================================================
  {
    id: 'code-deployment',
    name: 'Code Deployment Pipeline',
    description: 'Automated code deployment with testing and conditional deployment',
    category: 'DevOps',
    tags: ['git', 'deployment', 'ci-cd', 'testing'],
    definition: {
      name: 'Code Deployment',
      version: '1.0.0',
      triggers: [
        { type: 'manual' },
        {
          type: 'webhook',
          webhook: {
            path: '/webhooks/deploy',
            method: 'POST',
            authentication: {
              type: 'bearer',
              credentials: { token: '{{ env.DEPLOY_WEBHOOK_TOKEN }}' }
            }
          }
        }
      ],
      inputs: [
        {
          name: 'branch',
          type: 'string',
          required: true,
          default: 'main',
          description: 'Git branch to deploy'
        },
        {
          name: 'environment',
          type: 'string',
          required: true,
          default: 'staging',
          description: 'Target environment (staging/production)'
        },
        {
          name: 'skipTests',
          type: 'boolean',
          required: false,
          default: false,
          description: 'Skip test execution'
        }
      ],
      steps: [
        {
          id: 'git-pull',
          type: 'action',
          name: 'Pull Latest Code',
          action: {
            type: 'git.pull',
            parameters: {
              branch: '{{ inputs.branch }}',
              remote: 'origin'
            }
          },
          timeout: 60000,
          onError: {
            retry: {
              maxAttempts: 3,
              backoff: 'exponential',
              initialDelay: 1000
            }
          }
        },
        {
          id: 'install-deps',
          type: 'action',
          name: 'Install Dependencies',
          action: {
            type: 'npm.install',
            parameters: {
              ci: true
            }
          },
          timeout: 300000
        },
        {
          id: 'run-tests',
          type: 'condition',
          name: 'Run Tests (Conditional)',
          condition: {
            expression: '{{ !inputs.skipTests }}',
            then: [
              {
                id: 'test-unit',
                type: 'action',
                name: 'Run Unit Tests',
                action: {
                  type: 'npm.test',
                  parameters: {
                    scope: 'unit'
                  }
                },
                timeout: 120000
              },
              {
                id: 'test-integration',
                type: 'action',
                name: 'Run Integration Tests',
                action: {
                  type: 'npm.test',
                  parameters: {
                    scope: 'integration'
                  }
                },
                timeout: 180000
              }
            ]
          }
        },
        {
          id: 'build',
          type: 'action',
          name: 'Build Application',
          action: {
            type: 'npm.build',
            parameters: {
              mode: 'production'
            }
          },
          timeout: 300000
        },
        {
          id: 'deploy',
          type: 'condition',
          name: 'Deploy to Environment',
          condition: {
            expression: '{{ steps.build.result.success }}',
            then: [
              {
                id: 'deploy-staging',
                type: 'condition',
                name: 'Deploy to Staging',
                condition: {
                  expression: '{{ inputs.environment == "staging" }}',
                  then: [
                    {
                      id: 'deploy-staging-action',
                      type: 'action',
                      name: 'Deploy to Staging Server',
                      action: {
                        type: 'deploy.staging',
                        parameters: {
                          buildPath: '{{ steps.build.result.outputPath }}',
                          branch: '{{ inputs.branch }}'
                        }
                      }
                    }
                  ]
                }
              },
              {
                id: 'deploy-production',
                type: 'condition',
                name: 'Deploy to Production',
                condition: {
                  expression: '{{ inputs.environment == "production" }}',
                  then: [
                    {
                      id: 'deploy-production-action',
                      type: 'action',
                      name: 'Deploy to Production Server',
                      action: {
                        type: 'deploy.production',
                        parameters: {
                          buildPath: '{{ steps.build.result.outputPath }}',
                          branch: '{{ inputs.branch }}'
                        }
                      }
                    }
                  ]
                }
              }
            ],
            else: [
              {
                id: 'notify-failure',
                type: 'action',
                name: 'Notify Build Failure',
                action: {
                  type: 'notification.send',
                  parameters: {
                    message: 'Build failed for branch {{ inputs.branch }}',
                    channels: ['slack', 'email']
                  }
                }
              }
            ]
          }
        },
        {
          id: 'notify-success',
          type: 'action',
          name: 'Notify Deployment Success',
          action: {
            type: 'notification.send',
            parameters: {
              message: 'Deployed {{ inputs.branch }} to {{ inputs.environment }}',
              channels: ['slack']
            }
          }
        }
      ],
      outputs: {
        deploymentId: '{{ steps.deploy.result.deploymentId }}',
        environment: '{{ inputs.environment }}',
        branch: '{{ inputs.branch }}',
        timestamp: '{{ context.startTime }}'
      }
    },
    examples: [
      {
        name: 'Deploy main to staging',
        inputs: {
          branch: 'main',
          environment: 'staging',
          skipTests: false
        },
        expectedOutputs: {
          environment: 'staging',
          branch: 'main'
        }
      }
    ]
  },

  // ========================================================================
  // Data Processing Workflow
  // ========================================================================
  {
    id: 'data-processing',
    name: 'Data Processing Pipeline',
    description: 'Extract, transform, and load data with validation',
    category: 'Data',
    tags: ['etl', 'data', 'transformation', 'pipeline'],
    definition: {
      name: 'Data Processing',
      version: '1.0.0',
      triggers: [
        { type: 'manual' },
        {
          type: 'schedule',
          schedule: {
            cron: '0 2 * * *', // Daily at 2 AM
            timezone: 'UTC'
          }
        }
      ],
      inputs: [
        {
          name: 'dataSource',
          type: 'string',
          required: true,
          description: 'Data source URL or file path'
        },
        {
          name: 'outputPath',
          type: 'string',
          required: true,
          description: 'Output destination path'
        },
        {
          name: 'transformRules',
          type: 'object',
          required: false,
          default: {},
          description: 'Data transformation rules'
        },
        {
          name: 'validateSchema',
          type: 'boolean',
          required: false,
          default: true,
          description: 'Enable schema validation'
        }
      ],
      steps: [
        {
          id: 'extract',
          type: 'action',
          name: 'Extract Data',
          action: {
            type: 'data.extract',
            parameters: {
              source: '{{ inputs.dataSource }}',
              format: 'auto'
            }
          },
          timeout: 120000,
          onError: {
            retry: {
              maxAttempts: 3,
              backoff: 'exponential',
              initialDelay: 2000
            }
          }
        },
        {
          id: 'validate-input',
          type: 'condition',
          name: 'Validate Input Data',
          condition: {
            expression: '{{ inputs.validateSchema }}',
            then: [
              {
                id: 'validate-schema',
                type: 'action',
                name: 'Validate Data Schema',
                action: {
                  type: 'data.validate',
                  parameters: {
                    data: '{{ steps.extract.result.data }}',
                    schema: '{{ inputs.transformRules.schema }}'
                  }
                }
              }
            ]
          }
        },
        {
          id: 'transform',
          type: 'action',
          name: 'Transform Data',
          action: {
            type: 'data.transform',
            parameters: {
              data: '{{ steps.extract.result.data }}',
              rules: '{{ inputs.transformRules }}'
            }
          },
          timeout: 180000
        },
        {
          id: 'deduplicate',
          type: 'action',
          name: 'Remove Duplicates',
          action: {
            type: 'data.deduplicate',
            parameters: {
              data: '{{ steps.transform.result.data }}',
              key: '{{ inputs.transformRules.uniqueKey }}'
            }
          }
        },
        {
          id: 'load',
          type: 'action',
          name: 'Load Data',
          action: {
            type: 'data.load',
            parameters: {
              data: '{{ steps.deduplicate.result.data }}',
              destination: '{{ inputs.outputPath }}',
              format: 'json'
            }
          },
          timeout: 120000
        },
        {
          id: 'generate-report',
          type: 'action',
          name: 'Generate Processing Report',
          action: {
            type: 'report.generate',
            parameters: {
              stats: {
                extracted: '{{ steps.extract.result.count }}',
                transformed: '{{ steps.transform.result.count }}',
                deduplicated: '{{ steps.deduplicate.result.count }}',
                loaded: '{{ steps.load.result.count }}'
              }
            }
          }
        }
      ],
      outputs: {
        recordsProcessed: '{{ steps.load.result.count }}',
        outputLocation: '{{ inputs.outputPath }}',
        duration: '{{ context.endTime - context.startTime }}',
        report: '{{ steps.generate-report.result }}'
      }
    },
    examples: [
      {
        name: 'Process CSV data',
        inputs: {
          dataSource: 'https://example.com/data.csv',
          outputPath: '/data/processed/output.json',
          validateSchema: true
        },
        expectedOutputs: {
          outputLocation: '/data/processed/output.json'
        }
      }
    ]
  },

  // ========================================================================
  // Batch Operations Workflow
  // ========================================================================
  {
    id: 'batch-operations',
    name: 'Batch Operations Pipeline',
    description: 'Execute operations on multiple items with parallel processing',
    category: 'Automation',
    tags: ['batch', 'loop', 'parallel', 'bulk'],
    definition: {
      name: 'Batch Operations',
      version: '1.0.0',
      triggers: [{ type: 'manual' }],
      inputs: [
        {
          name: 'items',
          type: 'array',
          required: true,
          description: 'Array of items to process'
        },
        {
          name: 'operationType',
          type: 'string',
          required: true,
          description: 'Operation to perform (update/delete/process)'
        },
        {
          name: 'batchSize',
          type: 'number',
          required: false,
          default: 10,
          description: 'Number of items per batch'
        },
        {
          name: 'parallel',
          type: 'boolean',
          required: false,
          default: true,
          description: 'Enable parallel processing'
        },
        {
          name: 'continueOnError',
          type: 'boolean',
          required: false,
          default: true,
          description: 'Continue processing if individual item fails'
        }
      ],
      steps: [
        {
          id: 'validate-items',
          type: 'action',
          name: 'Validate Items',
          action: {
            type: 'batch.validate',
            parameters: {
              items: '{{ inputs.items }}',
              operationType: '{{ inputs.operationType }}'
            }
          }
        },
        {
          id: 'create-batches',
          type: 'action',
          name: 'Create Batches',
          action: {
            type: 'batch.split',
            parameters: {
              items: '{{ inputs.items }}',
              batchSize: '{{ inputs.batchSize }}'
            }
          }
        },
        {
          id: 'process-batches',
          type: 'loop',
          name: 'Process Each Batch',
          loop: {
            items: '{{ steps.create-batches.result.batches }}',
            variable: 'batch',
            steps: [
              {
                id: 'process-batch-items',
                type: 'condition',
                name: 'Process Batch',
                condition: {
                  expression: '{{ inputs.parallel }}',
                  then: [
                    {
                      id: 'parallel-process',
                      type: 'parallel',
                      name: 'Parallel Processing',
                      parallel: {
                        steps: [
                          {
                            id: 'process-item',
                            type: 'loop',
                            name: 'Process Items',
                            loop: {
                              items: '{{ variables.batch }}',
                              variable: 'item',
                              steps: [
                                {
                                  id: 'execute-operation',
                                  type: 'action',
                                  name: 'Execute Operation',
                                  action: {
                                    type: 'batch.execute',
                                    parameters: {
                                      item: '{{ variables.item }}',
                                      operation: '{{ inputs.operationType }}'
                                    }
                                  },
                                  onError: {
                                    continueOnError: true
                                  }
                                }
                              ]
                            }
                          }
                        ]
                      }
                    }
                  ],
                  else: [
                    {
                      id: 'sequential-process',
                      type: 'loop',
                      name: 'Sequential Processing',
                      loop: {
                        items: '{{ variables.batch }}',
                        variable: 'item',
                        steps: [
                          {
                            id: 'execute-operation-seq',
                            type: 'action',
                            name: 'Execute Operation',
                            action: {
                              type: 'batch.execute',
                              parameters: {
                                item: '{{ variables.item }}',
                                operation: '{{ inputs.operationType }}'
                              }
                            },
                            onError: {
                              continueOnError: true
                            }
                          }
                        ]
                      }
                    }
                  ]
                }
              },
              {
                id: 'delay-between-batches',
                type: 'delay',
                name: 'Wait Between Batches',
                delay: {
                  duration: 1000
                }
              }
            ]
          }
        },
        {
          id: 'aggregate-results',
          type: 'action',
          name: 'Aggregate Results',
          action: {
            type: 'batch.aggregate',
            parameters: {
              results: '{{ steps.process-batches.result }}'
            }
          }
        },
        {
          id: 'notify-completion',
          type: 'action',
          name: 'Send Completion Notification',
          action: {
            type: 'notification.send',
            parameters: {
              message: 'Batch operation completed: {{ steps.aggregate-results.result.successCount }}/{{ inputs.items.length }} items processed',
              channels: ['email']
            }
          }
        }
      ],
      outputs: {
        totalItems: '{{ inputs.items.length }}',
        successCount: '{{ steps.aggregate-results.result.successCount }}',
        failureCount: '{{ steps.aggregate-results.result.failureCount }}',
        results: '{{ steps.aggregate-results.result.details }}'
      }
    },
    examples: [
      {
        name: 'Batch update users',
        inputs: {
          items: [
            { id: 1, name: 'User 1' },
            { id: 2, name: 'User 2' },
            { id: 3, name: 'User 3' }
          ],
          operationType: 'update',
          batchSize: 2,
          parallel: true,
          continueOnError: true
        },
        expectedOutputs: {
          totalItems: 3
        }
      }
    ]
  },

  // ========================================================================
  // Notification Workflow (from original templates)
  // ========================================================================
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
