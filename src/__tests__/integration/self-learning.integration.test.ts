/**
 * Self-Learning System Integration Tests
 *
 * Tests the integration of self-learning system with main orchestration flow
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createAetherAgent, AetherAgent } from '../../agent';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';

describe('Self-Learning Integration', () => {
  let agent: AetherAgent;
  const testDataDir = join(process.cwd(), 'test-data', randomUUID());

  beforeAll(async () => {
    // Create test data directory
    mkdirSync(testDataDir, { recursive: true });

    // Create agent with learning enabled
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
    // Clean up test data
    rmSync(testDataDir, { recursive: true, force: true });
  });

  describe('Automatic Cycle Recording', () => {
    it('should automatically record cycle metrics after chat', async () => {
      // Skip if no API key
      if (!process.env.ANTHROPIC_API_KEY) {
        console.log('Skipping: No API key provided');
        return;
      }

      // Send a message
      await agent.chat('Hello, this is a test message');

      // Get learning stats
      const stats = await agent.getLearningStats();

      // Verify stats exist
      expect(stats).toBeDefined();
      expect(stats.feedbackLoop).toBeDefined();
      expect(stats.feedbackLoop.totalInteractions).toBeGreaterThanOrEqual(1);
    });

    it('should track response time metrics', async () => {
      if (!process.env.ANTHROPIC_API_KEY) {
        console.log('Skipping: No API key provided');
        return;
      }

      await agent.chat('Quick test');

      const stats = await agent.getLearningStats();
      expect(stats.feedbackLoop.averageResponseTime).toBeGreaterThan(0);
    });
  });

  describe('User Feedback Recording', () => {
    it('should record user feedback', async () => {
      const messageId = randomUUID();

      const feedbackId = await agent.recordFeedback(
        messageId,
        5,
        'Great response!',
        undefined
      );

      expect(feedbackId).toBeDefined();
      expect(typeof feedbackId).toBe('string');
    });

    it('should accept low rating feedback', async () => {
      const messageId = randomUUID();

      const feedbackId = await agent.recordFeedback(
        messageId,
        2,
        'Too slow and unclear',
        undefined
      );

      expect(feedbackId).toBeDefined();
    });

    it('should reject invalid rating', async () => {
      const messageId = randomUUID();

      await expect(
        agent.recordFeedback(messageId, 6, 'Invalid rating')
      ).rejects.toThrow();
    });
  });

  describe('Learning Report Generation', () => {
    it('should generate learning report', async () => {
      const report = await agent.generateLearningReport(7);

      expect(report).toBeDefined();
      expect(typeof report).toBe('string');
      expect(report).toContain('Learning System Report');
    });

    it('should include statistics in report', async () => {
      const report = await agent.generateLearningReport(7);

      expect(report).toContain('Total Interactions');
      expect(report).toContain('Success Rate');
      expect(report).toContain('Average Response Time');
    });
  });

  describe('Learning Stats API', () => {
    it('should return comprehensive stats', async () => {
      const stats = await agent.getLearningStats();

      expect(stats).toBeDefined();
      expect(stats.feedbackLoop).toBeDefined();
      expect(stats.currentCycle).toBeDefined();
      expect(stats).toHaveProperty('averageSatisfaction');
    });

    it('should track success rate', async () => {
      const stats = await agent.getLearningStats();

      expect(stats.feedbackLoop.successRate).toBeGreaterThanOrEqual(0);
      expect(stats.feedbackLoop.successRate).toBeLessThanOrEqual(1);
    });
  });
});
