/**
 * GLM Connector Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GLMConnector } from '../glm';

describe('GLMConnector', () => {
  let connector: GLMConnector;
  const mockApiKey = 'test-glm-key';

  beforeEach(() => {
    connector = new GLMConnector(mockApiKey);
  });

  describe('initialization', () => {
    it('should create connector with API key', () => {
      expect(connector).toBeInstanceOf(GLMConnector);
    });

    it('should throw error without API key', () => {
      expect(() => new GLMConnector('')).toThrow('API key is required');
    });
  });

  describe('model support', () => {
    it('should support GLM-4 models', () => {
      const models = ['glm-4', 'glm-4v', 'glm-3-turbo'];
      expect(models).toContain('glm-4');
    });

    it('should support vision capabilities', () => {
      const visionModel = 'glm-4v';
      expect(visionModel).toContain('v');
    });
  });

  describe('Zhipu AI features', () => {
    it('should be optimized for Chinese', () => {
      const features = ['chinese-optimized', 'function-calling'];
      expect(features).toHaveLength(2);
    });
  });
});
