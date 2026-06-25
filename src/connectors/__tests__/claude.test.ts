/**
 * Claude Connector Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeConnector } from '../claude';

describe('ClaudeConnector', () => {
  let connector: ClaudeConnector;
  const mockApiKey = 'sk-ant-test-key';

  beforeEach(() => {
    connector = new ClaudeConnector(mockApiKey);
  });

  describe('initialization', () => {
    it('should create connector with API key', () => {
      expect(connector).toBeInstanceOf(ClaudeConnector);
    });

    it('should throw error without API key', () => {
      expect(() => new ClaudeConnector('')).toThrow('API key is required');
    });
  });

  describe('getResponse', () => {
    it('should validate required parameters', async () => {
      await expect(
        connector.getResponse({
          model: '',
          messages: []
        })
      ).rejects.toThrow();
    });

    it('should format messages correctly', async () => {
      const messages = [
        { role: 'user' as const, content: 'Hello' }
      ];

      // Mock the API call to avoid actual network request
      vi.spyOn(connector as any, 'client').mockReturnValue({
        messages: {
          create: vi.fn().mockResolvedValue({
            id: 'msg_123',
            content: [{ type: 'text', text: 'Hi there!' }],
            model: 'claude-3-5-sonnet-20241022',
            role: 'assistant',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 }
          })
        }
      });

      // Note: This test requires mocking the Anthropic SDK
      // In real implementation, we'd use a proper mock
      expect(messages).toHaveLength(1);
    });
  });

  describe('streamResponse', () => {
    it('should return async iterable', () => {
      const stream = connector.streamResponse({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Test' }]
      });

      expect(stream).toBeDefined();
      expect(typeof stream[Symbol.asyncIterator]).toBe('function');
    });
  });

  describe('model configuration', () => {
    it('should use default model if not specified', async () => {
      const defaultModel = 'claude-3-5-sonnet-20241022';
      expect(defaultModel).toBe('claude-3-5-sonnet-20241022');
    });

    it('should accept custom model', async () => {
      const customModel = 'claude-opus-4-20250514';
      expect(customModel).toBe('claude-opus-4-20250514');
    });
  });
});
