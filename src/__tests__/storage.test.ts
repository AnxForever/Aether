/**
 * Storage Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChatHistory } from '../storage/chat-history';
import { ConfigManager } from '../storage/config-manager';
import { ModelRegistry } from '../storage/model-registry';
import { unlinkSync } from 'fs';

describe('ChatHistory', () => {
  let chatHistory: ChatHistory;
  const testDbPath = './test-chat.db';

  beforeEach(() => {
    chatHistory = new ChatHistory(testDbPath);
  });

  afterEach(() => {
    try {
      unlinkSync(testDbPath);
      unlinkSync(testDbPath + '-shm');
      unlinkSync(testDbPath + '-wal');
    } catch {}
  });

  it('should create new session', () => {
    const sessionId = chatHistory.createSession('chat', 'Test Session');
    expect(sessionId).toBeTruthy();
  });

  it('should add and retrieve messages', () => {
    const sessionId = chatHistory.createSession('chat', 'Test');

    chatHistory.addMessage(sessionId, {
      role: 'user',
      content: 'Hello',
      timestamp: Date.now()
    });

    const messages = chatHistory.getMessages(sessionId);
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Hello');
  });

  it('should list sessions', () => {
    chatHistory.createSession('chat', 'Session 1');
    chatHistory.createSession('chat', 'Session 2');

    const sessions = chatHistory.listSessions();
    expect(sessions.length).toBeGreaterThanOrEqual(2);
  });
});

describe('ModelRegistry', () => {
  let registry: ModelRegistry;
  const testDbPath = './test-models.db';

  beforeEach(() => {
    registry = new ModelRegistry(testDbPath);
  });

  afterEach(() => {
    try {
      unlinkSync(testDbPath);
    } catch {}
  });

  it('should list available models', () => {
    const models = registry.listModels();
    expect(models.length).toBeGreaterThan(0);
  });

  it('should get model by id', () => {
    const model = registry.getModel('claude-sonnet-4-20250514');
    expect(model).toBeDefined();
    expect(model?.provider).toBe('claude');
  });

  it('should filter models by provider', () => {
    const claudeModels = registry.getModelsByProvider('claude');
    expect(claudeModels.length).toBeGreaterThan(0);
    expect(claudeModels.every(m => m.provider === 'claude')).toBe(true);
  });
});
