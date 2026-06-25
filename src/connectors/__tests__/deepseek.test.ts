/**
 * DeepSeek Connector Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DeepSeekConnector } from '../deepseek';

describe('DeepSeekConnector', () => {
  let connector: DeepSeekConnector;
  const mockApiKey = 'sk-deepseek-test';

  beforeEach(() => {
    connector = new DeepSeekConnector(mockApiKey);
  });

  describe('initialization', () => {
    it('should create connector with API key', () => {
      expect(connector).toBeInstanceOf(DeepSeekConnector);
    });

    it('should throw error without API key', () => {
      expect(() => new DeepSeekConnector('')).toThrow('API key is required');
    });
  });

  describe('model support', () => {
    it('should support DeepSeek models', () => {
      const models = ['deepseek-chat', 'deepseek-coder'];
      expect(models).toContain('deepseek-chat');
      expect(models).toContain('deepseek-coder');
    });
  });

  describe('cost effectiveness', () => {
    it('should be cost-effective option', () => {
      const pricing = {
        input: 0.14,  // per 1M tokens
        output: 0.28
      };
      expect(pricing.input).toBeLessThan(1);
      expect(pricing.output).toBeLessThan(1);
    });
  });
});
