/**
 * Workflow Demo - Examples of using Workflow Engine
 */

import { NexusAgent } from '../src/agent';
import { createLogger } from '../src/utils/logger';

const logger = createLogger('WorkflowDemo');

async function main() {
  logger.info('=== Workflow Engine Demo ===\n');

  // Initialize agent with workflow integration enabled
  const agent = new NexusAgent({
    model: 'claude-sonnet-4-20250514',
    provider: 'claude',
    dataDir: './data',
    enableLearning: true,
    apiKeys: {
      claude: process.env.ANTHROPIC_API_KEY || ''
    }
  });

  await agent.initialize();

  try {
    // ========================================================================
    // Demo 1: List Available Workflows
    // ========================================================================
    logger.info('--- Demo 1: List Available Workflows ---');
    const workflows = agent.listWorkflows();

    logger.info(`Found ${workflows.length} workflows:\n`);
    workflows.forEach(w => {
      logger.info(`  - ${w.name} (${w.id})`);
      logger.info(`    Category: ${w.category}`);
      logger.info(`    Description: ${w.description}`);
      logger.info(`    Tags: ${w.tags?.join(', ')}`);
      logger.info('');
    });

    // ========================================================================
    // Demo 2: Get Workflow Details
    // ========================================================================
    logger.info('\n--- Demo 2: Get Workflow Details ---');
    const dataProcessingWorkflow = agent.getWorkflow('data-processing');

    if (dataProcessingWorkflow) {
      logger.info(`Workflow: ${dataProcessingWorkflow.name}`);
      logger.info(`Version: ${dataProcessingWorkflow.version}`);
      logger.info(`\nInputs:`);
      dataProcessingWorkflow.inputs?.forEach((input: any) => {
        logger.info(`  - ${input.name} (${input.type})${input.required ? ' *required' : ''}`);
        logger.info(`    ${input.description}`);
      });
      logger.info(`\nSteps: ${dataProcessingWorkflow.steps.length}`);
      dataProcessingWorkflow.steps.forEach((step: any, index: number) => {
        logger.info(`  ${index + 1}. ${step.name} (${step.type})`);
      });
    }

    // ========================================================================
    // Demo 3: Execute Data Processing Workflow
    // ========================================================================
    logger.info('\n--- Demo 3: Execute Data Processing Workflow ---');

    const dataProcessingInputs = {
      dataSource: 'https://jsonplaceholder.typicode.com/users',
      outputPath: './data/processed/users.json',
      validateSchema: true,
      transformRules: {
        uniqueKey: 'id',
        schema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
              email: { type: 'string' }
            }
          }
        }
      }
    };

    logger.info('Executing workflow with inputs:', dataProcessingInputs);

    try {
      const result = await agent.executeWorkflow('data-processing', dataProcessingInputs);

      logger.info('\nExecution Result:');
      logger.info(`  Status: ${result.status}`);
      logger.info(`  Execution ID: ${result.executionId}`);
      logger.info(`  Duration: ${result.duration}ms`);

      if (result.outputs) {
        logger.info(`\nOutputs:`);
        Object.entries(result.outputs).forEach(([key, value]) => {
          logger.info(`  ${key}: ${JSON.stringify(value)}`);
        });
      }

      if (result.steps) {
        logger.info(`\nStep Results:`);
        result.steps.forEach((step: any) => {
          logger.info(`  - ${step.stepId}: ${step.status} (${step.endTime - step.startTime}ms)`);
        });
      }
    } catch (error) {
      logger.error('Workflow execution failed:', error);
    }

    // ========================================================================
    // Demo 4: Execute Batch Operations Workflow
    // ========================================================================
    logger.info('\n--- Demo 4: Execute Batch Operations Workflow ---');

    const batchInputs = {
      items: [
        { id: 1, name: 'Item 1', status: 'pending' },
        { id: 2, name: 'Item 2', status: 'pending' },
        { id: 3, name: 'Item 3', status: 'pending' },
        { id: 4, name: 'Item 4', status: 'pending' },
        { id: 5, name: 'Item 5', status: 'pending' }
      ],
      operationType: 'update',
      batchSize: 2,
      parallel: true,
      continueOnError: true
    };

    logger.info('Executing batch workflow with inputs:', {
      itemCount: batchInputs.items.length,
      operationType: batchInputs.operationType,
      batchSize: batchInputs.batchSize,
      parallel: batchInputs.parallel
    });

    try {
      const result = await agent.executeWorkflow('batch-operations', batchInputs);

      logger.info('\nBatch Execution Result:');
      logger.info(`  Status: ${result.status}`);
      logger.info(`  Duration: ${result.duration}ms`);

      if (result.outputs) {
        logger.info(`\nOutputs:`);
        logger.info(`  Total Items: ${result.outputs.totalItems}`);
        logger.info(`  Success Count: ${result.outputs.successCount}`);
        logger.info(`  Failure Count: ${result.outputs.failureCount}`);
      }
    } catch (error) {
      logger.error('Batch workflow execution failed:', error);
    }

    // ========================================================================
    // Demo 5: Get Workflow Execution History
    // ========================================================================
    logger.info('\n--- Demo 5: Get Workflow Execution History ---');

    const history = agent.getWorkflowHistory('data-processing', 10);

    if (history.length > 0) {
      logger.info(`Found ${history.length} executions:\n`);
      history.forEach((exec: any) => {
        logger.info(`  - Execution ${exec.executionId}`);
        logger.info(`    Status: ${exec.status}`);
        logger.info(`    Started: ${new Date(exec.startTime).toISOString()}`);
        if (exec.endTime) {
          logger.info(`    Duration: ${exec.endTime - exec.startTime}ms`);
        }
        logger.info('');
      });
    } else {
      logger.info('No execution history found');
    }

    // ========================================================================
    // Demo 6: Code Deployment Workflow (Dry Run)
    // ========================================================================
    logger.info('\n--- Demo 6: Code Deployment Workflow (Info Only) ---');

    const deploymentWorkflow = agent.getWorkflow('code-deployment');

    if (deploymentWorkflow) {
      logger.info(`Workflow: ${deploymentWorkflow.name}`);
      logger.info(`\nThis workflow automates:`);
      logger.info('  1. Git pull latest code');
      logger.info('  2. Install dependencies');
      logger.info('  3. Run tests (optional)');
      logger.info('  4. Build application');
      logger.info('  5. Deploy to target environment');
      logger.info('  6. Send notifications');

      logger.info(`\nRequired Inputs:`);
      deploymentWorkflow.inputs?.forEach((input: any) => {
        if (input.required) {
          logger.info(`  - ${input.name}: ${input.description}`);
        }
      });

      logger.info('\nExample usage:');
      logger.info(`  await agent.executeWorkflow('code-deployment', {`);
      logger.info(`    branch: 'main',`);
      logger.info(`    environment: 'staging',`);
      logger.info(`    skipTests: false`);
      logger.info(`  });`);
    }

    // ========================================================================
    // Demo 7: Notification Workflow
    // ========================================================================
    logger.info('\n--- Demo 7: Multi-Channel Notification Workflow ---');

    const notificationInputs = {
      message: 'Hello from Nexus Agent Workflow Engine!',
      channels: ['email', 'slack'],
      priority: 'normal'
    };

    logger.info('Sending multi-channel notification:', notificationInputs);

    try {
      const result = await agent.executeWorkflow('notification-workflow', notificationInputs);

      logger.info('\nNotification Result:');
      logger.info(`  Status: ${result.status}`);
      logger.info(`  Channels sent: ${result.outputs?.sent || 0}`);
    } catch (error) {
      logger.error('Notification workflow failed:', error);
    }

  } catch (error) {
    logger.error('Demo failed:', error);
  } finally {
    await agent.cleanup();
    logger.info('\n=== Demo Complete ===');
  }
}

// Run demo
main().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
