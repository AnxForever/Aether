/**
 * E2E Test: Chat with Learning
 *
 * Tests the complete flow of chat with automatic learning system recording
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createAetherAgent, AetherAgent } from '../../agent';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';

describe('E2E: Chat with Learning', () => {
  let agent: AetherAgent;
  const testDataDir = join(process.cwd(), 'test-data', randomUUID());

  beforeAll(async () => {
    mkdirSync(testDataDir, { recursive: true });

    agent = createAetherAgent({
      model: 'claude-sonnet-4-20250514',
      provider: 'claude',
      apiKeys: {
        claude: process.env.ANTHROPIC_API_KEY || 'test-key'
      },
      dataDir: testDataDir,
      enableLearning: true
    });

    await agent.initialize();
  });

  afterAll(async () => {
    await agent.cleanup();
    rmSync(testDataDir, { recursive: true, force: true });
  });

  it('should complete full chat cycle with learning', async () => {
    // Skip if no API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('Skipping E2E test: No API key provided');
      return;
    }

    // Step 1: User sends message
    const userMessage = 'What is TypeScript?';
    const response = await agent.chat(userMessage);

    // Step 2: AI responds
    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);

    // Step 3: Learning system auto-records
    const statsAfterChat = await agent.getLearningStats();
    expect(statsAfterChat.feedbackLoop.totalInteractions).toBeGreaterThanOrEqual(1);

    // Step 4: User provides feedback
    const messageId = randomUUID();
    const feedbackId = await agent.recordFeedback(messageId, 5, 'Great explanation!');
    expect(feedbackId).toBeDefined();

    // Step 5: Verify feedback recorded
    const statsAfterFeedback = await agent.getLearningStats();
    expect(statsAfterFeedback.averageSatisfaction).toBeGreaterThan(0);
  });
});
