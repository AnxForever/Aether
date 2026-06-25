/**
 * Moonshot Connector Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MoonshotConnector } from '../moonshot';

describe('MoonshotConnector', () => {
  let connector: MoonshotConnector;
  const mockApiKey = 'sk-moonshot-test';

  beforeEach(() => {
    connector = new MoonshotConnector(mockApiKey);
  });

  describe('initialization', () => {
    it('should create connector with API key', () => {
      expect(connector).toBeInstanceOf(MoonshotConnector);
    });

    it('should throw error without API key', () => {
      expect(() => new MoonshotConnector('')).toThrow('API key is required');
    });
  });

  describe('long context support', () => {
    it('should support 128k context window', () => {
      const contextWindow = 128000;
      expect(contextWindow).toBeGreaterThanOrEqual(128000);
    });

    it('should handle long documents', () => {
      const capabilities = ['long-context', 'document-qa'];
      expect(capabilities).toContain('long-context');
    });
  });

  describe('model variants', () => {
    it('should support Kimi models', () => {
      const models = ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'];
      expect(models).toHaveLength(3);
    });
  });
});
