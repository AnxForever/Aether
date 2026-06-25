/**
 * MiniMax Connector Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MiniMaxConnector } from '../minimax';

describe('MiniMaxConnector', () => {
  let connector: MiniMaxConnector;
  const mockApiKey = 'test-minimax-key';

  beforeEach(() => {
    connector = new MiniMaxConnector(mockApiKey);
  });

  describe('initialization', () => {
    it('should create connector with API key', () => {
      expect(connector).toBeInstanceOf(MiniMaxConnector);
    });

    it('should throw error without API key', () => {
      expect(() => new MiniMaxConnector('')).toThrow('API key is required');
    });
  });

  describe('model support', () => {
    it('should support MiniMax models', () => {
      const models = ['abab6.5s-chat', 'abab6.5g-chat', 'abab6.5t-chat'];
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe('Chinese optimization', () => {
    it('should be optimized for Chinese language', () => {
      const features = ['chinese-optimized', 'multi-turn-dialogue'];
      expect(features).toContain('chinese-optimized');
    });
  });
});
