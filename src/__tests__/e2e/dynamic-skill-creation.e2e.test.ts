/**
 * E2E Test: Dynamic Skill Creation
 *
 * Tests the complete flow of dynamic skill creation from user intent
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createNexusAgent, NexusAgent } from '../../agent';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';

describe('E2E: Dynamic Skill Creation', () => {
  let agent: NexusAgent;
  const testDataDir = join(process.cwd(), 'test-data', randomUUID());

  beforeAll(async () => {
    mkdirSync(testDataDir, { recursive: true });

    agent = createNexusAgent({
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

  it('should create skill from natural language request', async () => {
    // Step 1: User expresses need
    const description = 'A tool to batch rename files with a pattern';

    // Step 2: System detects intent (tested internally)
    // Step 3: Generate skill
    const result = await agent.createSkill(description);

    // Step 4: Verify skill created
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.skillId).toBeDefined();

    // Step 5: Verify skill registered
    const skills = agent.listDynamicSkills();
    const found = skills.find(s => s.id === result.skillId);
    expect(found).toBeDefined();

    // Step 6: Verify can query skill
    const stats = agent.getSkillCreatorStats();
    expect(stats.totalCreated).toBeGreaterThanOrEqual(1);
  });
});
