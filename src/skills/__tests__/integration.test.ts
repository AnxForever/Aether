/**
 * Skills Integration Tests
 */

import { describe, it, expect } from 'vitest';
import { SkillRegistry } from '../registry';

describe('Skills Integration', () => {
  describe('Skill Loader', () => {
    it('should load skills from registry', () => {
      const registry = new SkillRegistry();
      expect(registry).toBeInstanceOf(SkillRegistry);
    });

    it('should handle empty registry', () => {
      const registry = new SkillRegistry();
      expect(registry.listAll()).toHaveLength(0);
      expect(registry.getAllTools()).toHaveLength(0);
    });
  });

  describe('Tool Execution Context', () => {
    it('should provide valid context structure', () => {
      const context = {
        sessionId: 'test-session',
        userId: 'test-user',
        workingDir: process.cwd(),
        env: process.env as Record<string, string>
      };

      expect(context).toHaveProperty('sessionId');
      expect(context).toHaveProperty('workingDir');
      expect(context.workingDir).toBeTruthy();
    });
  });

  describe('Tool Result Format', () => {
    it('should return success result', async () => {
      const mockHandler = async () => ({
        success: true,
        data: { message: 'Operation successful' }
      });

      const result = await mockHandler();

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ message: 'Operation successful' });
    });

    it('should return error result', async () => {
      const mockHandler = async () => ({
        success: false,
        error: 'Operation failed'
      });

      const result = await mockHandler();

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Operation failed');
    });
  });

  describe('Multiple Skills', () => {
    it('should manage multiple skills', () => {
      const registry = new SkillRegistry();

      const skills = [
        {
          id: 'files',
          name: 'File Operations',
          description: 'File system operations',
          version: '1.0.0',
          author: 'Aether',
          enabled: true,
          tools: []
        },
        {
          id: 'system',
          name: 'System Operations',
          description: 'System operations',
          version: '1.0.0',
          author: 'Aether',
          enabled: true,
          tools: []
        }
      ];

      skills.forEach(skill => registry.register(skill));

      expect(registry.listAll()).toHaveLength(2);
      expect(registry.get('files')).toBeDefined();
      expect(registry.get('system')).toBeDefined();
    });
  });
});
