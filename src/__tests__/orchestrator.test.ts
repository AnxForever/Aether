/**
 * Core Orchestrator Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Orchestrator } from '../core/orchestrator';
import { AgentContext, UserInput } from '../types';

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;
  let context: AgentContext;

  beforeEach(() => {
    orchestrator = new Orchestrator({
      provider: 'claude',
      model: 'claude-sonnet-4-20250514'
    });

    context = {
      sessionId: 'test-session',
      deviceId: 'test-device',
      settings: {
        model: 'claude-sonnet-4-20250514',
        language: 'en',
        theme: 'light'
      },
      capabilities: []
    };
  });

  it('should create orchestrator instance', () => {
    expect(orchestrator).toBeDefined();
  });

  it('should process simple input', async () => {
    const input: UserInput = {
      transcript: 'Hello, how are you?'
    };

    const response = await orchestrator.processInput(input, context);
    expect(response).toBeDefined();
    expect(response.content).toBeTruthy();
  });

  it('should handle empty input gracefully', async () => {
    const input: UserInput = {
      transcript: ''
    };

    await expect(orchestrator.processInput(input, context)).rejects.toThrow();
  });

  it('should stream response', async () => {
    const input: UserInput = {
      transcript: 'Tell me a short story'
    };

    const chunks: string[] = [];
    for await (const chunk of orchestrator.streamResponse(input, context)) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
  });
});
