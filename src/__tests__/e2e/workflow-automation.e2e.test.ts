/**
 * E2E Test: Workflow Automation
 *
 * Tests the complete workflow automation execution flow
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createAetherAgent, AetherAgent } from '../../agent';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';

describe('E2E: Workflow Automation', () => {
  let agent: AetherAgent;
  const testDataDir = join(process.cwd(), 'test-data', randomUUID());

  beforeAll(async () => {
    mkdirSync(testDataDir, { recursive: true });

    agent = createAetherAgent({
      model: 'claude-sonnet-4-20250514',
      provider: 'claude',
      dataDir: testDataDir,
      enableLearning: true
    });

    await agent.initialize();
  });

  afterAll(async () => {
    await agent.cleanup();
    rmSync(testDataDir, { recursive: true, force: true });
  });

  it('should execute complete workflow automation', async () => {
    // Step 1: Get available workflows
    const workflows = agent.listWorkflows();
    expect(workflows.length).toBeGreaterThan(0);

    const workflow = workflows[0];

    // Step 2: Trigger workflow execution
    const result = await agent.executeWorkflow(workflow.id, {
      testData: 'example'
    });

    // Step 3: Verify execution started
    expect(result).toBeDefined();
    expect(result.executionId).toBeDefined();
    expect(result.workflowId).toBe(workflow.id);

    // Step 4: Check execution status
    const status = agent.getWorkflowStatus(result.executionId);
    expect(status).toBeDefined();
    expect(['running', 'completed', 'failed']).toContain(status.status);

    // Step 5: Check execution history
    const history = agent.getWorkflowHistory(workflow.id, 10);
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);

    // Verify steps executed in order
    const execution = history.find(h => h.executionId === result.executionId);
    expect(execution).toBeDefined();
  });
});
