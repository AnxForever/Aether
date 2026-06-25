/**
 * System Skills Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry } from '../registry';
import { readFileSync, existsSync } from 'fs';

describe('System Skills', () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    registry = new SkillRegistry();
  });

  describe('Skill Registry', () => {
    it('should register skills', () => {
      const mockSkill = {
        id: 'test-skill',
        name: 'Test Skill',
        description: 'A test skill',
        version: '1.0.0',
        author: 'Test',
        enabled: true,
        tools: []
      };

      registry.register(mockSkill);
      expect(registry.get('test-skill')).toEqual(mockSkill);
    });

    it('should list all skills', () => {
      const skill1 = {
        id: 'skill-1',
        name: 'Skill 1',
        description: 'First skill',
        version: '1.0.0',
        author: 'Test',
        enabled: true,
        tools: []
      };

      const skill2 = {
        id: 'skill-2',
        name: 'Skill 2',
        description: 'Second skill',
        version: '1.0.0',
        author: 'Test',
        enabled: false,
        tools: []
      };

      registry.register(skill1);
      registry.register(skill2);

      expect(registry.listAll()).toHaveLength(2);
      expect(registry.listEnabled()).toHaveLength(1);
    });

    it('should find tools by name', () => {
      const mockTool = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: {},
        handler: async () => ({ success: true, data: 'test' })
      };

      const mockSkill = {
        id: 'test-skill',
        name: 'Test Skill',
        description: 'A test skill',
        version: '1.0.0',
        author: 'Test',
        enabled: true,
        tools: [mockTool]
      };

      registry.register(mockSkill);

      const foundTool = registry.findTool('test_tool');
      expect(foundTool).toBeDefined();
      expect(foundTool?.name).toBe('test_tool');
    });

    it('should enable and disable skills', () => {
      const mockSkill = {
        id: 'toggle-skill',
        name: 'Toggle Skill',
        description: 'A toggleable skill',
        version: '1.0.0',
        author: 'Test',
        enabled: true,
        tools: []
      };

      registry.register(mockSkill);

      registry.disable('toggle-skill');
      const disabled = registry.get('toggle-skill');
      expect(disabled?.enabled).toBe(false);

      registry.enable('toggle-skill');
      const enabled = registry.get('toggle-skill');
      expect(enabled?.enabled).toBe(true);
    });

    it('should get statistics', () => {
      const skill1 = {
        id: 'skill-1',
        name: 'Skill 1',
        description: 'First skill',
        version: '1.0.0',
        author: 'Test',
        enabled: true,
        tools: [
          {
            name: 'tool1',
            description: 'Tool 1',
            parameters: {},
            handler: async () => ({ success: true, data: '' })
          }
        ]
      };

      registry.register(skill1);

      const stats = registry.getStats();
      expect(stats.total).toBe(1);
      expect(stats.enabled).toBe(1);
      expect(stats.totalTools).toBe(1);
    });
  });

  describe('File System Operations', () => {
    it('should validate file existence check', () => {
      const packageJsonExists = existsSync('./package.json');
      expect(packageJsonExists).toBe(true);
    });

    it('should read files safely', () => {
      const content = readFileSync('./package.json', 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed).toHaveProperty('name');
      expect(parsed.name).toBe('aether');
    });
  });

  describe('Tool Parameter Validation', () => {
    it('should validate tool parameters structure', () => {
      const validParameters = {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path'
          }
        },
        required: ['path']
      };

      expect(validParameters).toHaveProperty('type');
      expect(validParameters.type).toBe('object');
      expect(validParameters.required).toContain('path');
    });
  });
});
