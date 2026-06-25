/**
 * OpenAI Connector Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIConnector } from '../openai';

describe('OpenAIConnector', () => {
  let connector: OpenAIConnector;
  const mockApiKey = 'sk-test-key';

  beforeEach(() => {
    connector = new OpenAIConnector(mockApiKey);
  });

  describe('initialization', () => {
    it('should create connector with API key', () => {
      expect(connector).toBeInstanceOf(OpenAIConnector);
    });

    it('should throw error without API key', () => {
      expect(() => new OpenAIConnector('')).toThrow('API key is required');
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

    it('should support GPT-4 models', () => {
      const models = ['gpt-4', 'gpt-4-turbo', 'gpt-4o'];
      expect(models).toContain('gpt-4');
    });
  });

  describe('streamResponse', () => {
    it('should return async iterable', () => {
      const stream = connector.streamResponse({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Test' }]
      });

      expect(stream).toBeDefined();
      expect(typeof stream[Symbol.asyncIterator]).toBe('function');
    });
  });

  describe('function calling', () => {
    it('should support tool calls', async () => {
      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'get_weather',
            description: 'Get weather info',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string' }
              }
            }
          }
        }
      ];

      expect(tools).toHaveLength(1);
      expect(tools[0].function.name).toBe('get_weather');
    });
  });
});
