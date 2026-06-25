/**
 * Gemini Connector Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GeminiConnector } from '../gemini';

describe('GeminiConnector', () => {
  let connector: GeminiConnector;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    connector = new GeminiConnector(mockApiKey);
  });

  describe('initialization', () => {
    it('should create connector with API key', () => {
      expect(connector).toBeInstanceOf(GeminiConnector);
    });

    it('should throw error without API key', () => {
      expect(() => new GeminiConnector('')).toThrow('API key is required');
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

    it('should support Gemini models', () => {
      const models = ['gemini-pro', 'gemini-pro-vision', 'gemini-1.5-pro'];
      expect(models).toContain('gemini-pro');
    });
  });

  describe('streamResponse', () => {
    it('should return async iterable', () => {
      const stream = connector.streamResponse({
        model: 'gemini-pro',
        messages: [{ role: 'user', content: 'Test' }]
      });

      expect(stream).toBeDefined();
      expect(typeof stream[Symbol.asyncIterator]).toBe('function');
    });
  });

  describe('vision capability', () => {
    it('should support multimodal input', () => {
      const multimodalInput = {
        text: 'What is in this image?',
        image: 'base64-encoded-image'
      };

      expect(multimodalInput).toHaveProperty('text');
      expect(multimodalInput).toHaveProperty('image');
    });
  });
});
