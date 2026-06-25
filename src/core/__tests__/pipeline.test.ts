/**
 * Pipeline Unit Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { Pipeline } from '../pipeline';

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('Pipeline', () => {
  it('should initialize with 5 default stages', () => {
    const pipeline = new Pipeline();
    const stages = pipeline.getStages();
    expect(stages).toHaveLength(5);
  });

  it('should have stages in correct order', () => {
    const pipeline = new Pipeline();
    const stages = pipeline.getStages();
    expect(stages.map(s => s.name)).toEqual([
      'context',
      'inference',
      'skill-creation-detection',
      'tool-execution',
      'response',
    ]);
  });

  it('should add custom stages', () => {
    const pipeline = new Pipeline();
    const customStage = {
      name: 'custom-stage',
      execute: async (data: any) => data,
    };
    pipeline.addStage(customStage);
    const stages = pipeline.getStages();
    expect(stages).toHaveLength(6);
    expect(stages[5].name).toBe('custom-stage');
  });

  it('should getStages return a copy (not reference)', () => {
    const pipeline = new Pipeline();
    const stages = pipeline.getStages();
    stages.push({ name: 'injected', execute: async (d: any) => d });

    // Original should still have 5 stages
    expect(pipeline.getStages()).toHaveLength(5);
  });

  it('should execute context stage and add messages', async () => {
    const pipeline = new Pipeline();
    const context = {
      cycle: {
        id: 'test-cycle',
        sessionId: 'test-session',
        input: { transcript: 'Hello world' },
        context: {
          sessionId: 'test-session',
          settings: { model: 'test', language: 'en', theme: 'auto' },
        },
        startTime: Date.now(),
        status: 'pending' as const,
      },
      config: { defaultProvider: 'claude', defaultModel: 'claude-3' },
      connectorRegistry: {
        get: vi.fn().mockReturnValue({
          getResponse: vi.fn().mockResolvedValue({
            content: 'Hello back',
            finishReason: 'end_turn',
            usage: { input: 10, output: 20 },
          }),
        }),
      },
    };

    const result = await pipeline.execute(context);
    expect(result).toBeDefined();
    expect(result.role).toBe('assistant');
    expect(result.content).toBe('Hello back');
  });

  it('should throw error when connector not found', async () => {
    const pipeline = new Pipeline();
    const context = {
      cycle: {
        id: 'test-cycle',
        sessionId: 'test-session',
        input: { transcript: 'test' },
        context: {
          sessionId: 'test-session',
          settings: { model: 'test', language: 'en', theme: 'auto' },
        },
        startTime: Date.now(),
        status: 'pending' as const,
      },
      config: { defaultProvider: 'nonexistent', defaultModel: 'test' },
      connectorRegistry: { get: vi.fn().mockReturnValue(null) },
    };

    await expect(pipeline.execute(context)).rejects.toThrow('Connector not found: nonexistent');
  });

  it('should skip skill creation detection when no integration', async () => {
    const pipeline = new Pipeline();
    const context = {
      cycle: {
        id: 'test-cycle',
        sessionId: 'test-session',
        input: { transcript: 'create a skill' },
        context: {
          sessionId: 'test-session',
          settings: { model: 'test', language: 'en', theme: 'auto' },
        },
        startTime: Date.now(),
        status: 'pending' as const,
      },
      config: { defaultProvider: 'claude', defaultModel: 'claude-3' },
      connectorRegistry: {
        get: vi.fn().mockReturnValue({
          getResponse: vi.fn().mockResolvedValue({
            content: 'response',
            finishReason: 'end_turn',
            usage: { input: 5, output: 10 },
          }),
        }),
      },
    };

    const result = await pipeline.execute(context);
    expect(result).toBeDefined();
    expect(result.content).toBe('response');
  });

  it('should append skill creation result to response when successful', async () => {
    const pipeline = new Pipeline();
    const skillCreatorIntegration = {
      detectSkillCreationIntent: vi.fn().mockReturnValue(true),
      extractSkillDescription: vi.fn().mockReturnValue('test skill'),
      createSkillFromRequest: vi.fn().mockResolvedValue({
        success: true,
        skillId: 'skill-123',
      }),
    };

    const context = {
      cycle: {
        id: 'test-cycle',
        sessionId: 'test-session',
        input: { transcript: 'create skill test' },
        context: {
          sessionId: 'test-session',
          settings: { model: 'test', language: 'en', theme: 'auto' },
        },
        startTime: Date.now(),
        status: 'pending' as const,
      },
      config: { defaultProvider: 'claude', defaultModel: 'claude-3' },
      connectorRegistry: {
        get: vi.fn().mockReturnValue({
          getResponse: vi.fn().mockResolvedValue({
            content: 'Created',
            finishReason: 'end_turn',
            usage: { input: 5, output: 10 },
          }),
        }),
      },
      skillCreatorIntegration,
    };

    const result = await pipeline.execute(context);
    expect(result.content).toContain('已成功创建新技能');
    expect(result.metadata?.skillCreated).toBe(true);
  });

  it('should return data unchanged when no toolCalls in aiResponse', async () => {
    const pipeline = new Pipeline();
    const context = {
      cycle: {
        id: 'test-cycle',
        sessionId: 'test-session',
        input: { transcript: 'hello' },
        context: {
          sessionId: 'test-session',
          settings: { model: 'test', language: 'en', theme: 'auto' },
        },
        startTime: Date.now(),
        status: 'pending' as const,
      },
      config: { defaultProvider: 'claude', defaultModel: 'claude-3' },
      connectorRegistry: {
        get: vi.fn().mockReturnValue({
          getResponse: vi.fn().mockResolvedValue({
            content: 'Hi',
            finishReason: 'end_turn',
            usage: { input: 3, output: 3 },
          }),
        }),
      },
    };

    const result = await pipeline.execute(context);
    expect(result.content).toBe('Hi');
  });
});
