/**
 * Workflow Engine Integration Tests
 *
 * Tests the workflow automation system integration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createAetherAgent, AetherAgent } from '../../agent';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';

describe('Workflow Engine Integration', () => {
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

  describe('Workflow Registration', () => {
    it('should list built-in workflows', () => {
      const workflows = agent.listWorkflows();

      expect(Array.isArray(workflows)).toBe(true);
      expect(workflows.length).toBeGreaterThan(0);
    });

    it('should include expected templates', () => {
      const workflows = agent.listWorkflows();
      const ids = workflows.map(w => w.id);

      expect(ids).toContain('code-deployment');
      expect(ids).toContain('data-processing');
      expect(ids).toContain('batch-operations');
    });
  });

  describe('Workflow Execution', () => {
    it('should execute simple workflow', async () => {
      const result = await agent.executeWorkflow('data-processing', {
        dataSource: 'test-data',
        outputPath: join(testDataDir, 'output.json')
      });

      expect(result).toBeDefined();
      expect(result.executionId).toBeDefined();
      expect(result.workflowId).toBe('data-processing');
    });

    it('should track execution status', async () => {
      const result = await agent.executeWorkflow('batch-operations', {
        items: ['item1', 'item2', 'item3']
      });

      const status = agent.getWorkflowStatus(result.executionId);

      expect(status).toBeDefined();
      expect(status.executionId).toBe(result.executionId);
      expect(['running', 'completed', 'failed']).toContain(status.status);
    });

    it('should record execution history', async () => {
      await agent.executeWorkflow('data-processing', {
        dataSource: 'test'
      });

      const history = agent.getWorkflowHistory('data-processing', 10);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('Workflow Details', () => {
    it('should get workflow details', () => {
      const workflow = agent.getWorkflow('code-deployment');

      expect(workflow).toBeDefined();
      expect(workflow?.id).toBe('code-deployment');
      expect(workflow?.name).toBeDefined();
      expect(workflow?.steps).toBeDefined();
      expect(Array.isArray(workflow?.steps)).toBe(true);
    });

    it('should return null for non-existent workflow', () => {
      const workflow = agent.getWorkflow('non-existent-workflow');

      expect(workflow).toBeNull();
    });
  });

  describe('Workflow Cancellation', () => {
    it('should cancel running workflow', async () => {
      const result = await agent.executeWorkflow('batch-operations', {
        items: new Array(100).fill('item')
      });

      await agent.cancelWorkflow(result.executionId);

      const status = agent.getWorkflowStatus(result.executionId);
      expect(status.status).toBe('cancelled');
    });
  });
});
