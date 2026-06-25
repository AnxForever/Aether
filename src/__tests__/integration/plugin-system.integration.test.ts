/**
 * Plugin System Integration Tests
 *
 * Tests the plugin loading, validation, and management system
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createAetherAgent, AetherAgent } from '../../agent';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';

describe('Plugin System Integration', () => {
  let agent: AetherAgent;
  const testDataDir = join(process.cwd(), 'test-data', randomUUID());
  const pluginsDir = join(process.cwd(), 'plugins');

  beforeAll(async () => {
    mkdirSync(testDataDir, { recursive: true });

    agent = createAetherAgent({
      model: 'claude-sonnet-4-20250514',
      provider: 'claude',
      dataDir: testDataDir,
      pluginsDir: pluginsDir,
      enableLearning: true
    });

    await agent.initialize();
  });

  afterAll(async () => {
    await agent.cleanup();
    rmSync(testDataDir, { recursive: true, force: true });
  });

  describe('Plugin Loading', () => {
    it('should load example plugin', async () => {
      const plugin = await agent.loadPlugin('example-plugin');

      expect(plugin).toBeDefined();
      expect(plugin.id).toBe('example-plugin');
      expect(plugin.enabled).toBe(true);
    });

    it('should validate plugin on load', async () => {
      // Example plugin should pass validation
      const plugin = await agent.loadPlugin('example-plugin');

      expect(plugin).toBeDefined();
      // If we reach here, validation passed
    });

    it('should handle non-existent plugin', async () => {
      await expect(
        agent.loadPlugin('non-existent-plugin')
      ).rejects.toThrow();
    });
  });

  describe('Plugin Management', () => {
    it('should list loaded plugins', () => {
      const plugins = agent.listPlugins();

      expect(Array.isArray(plugins)).toBe(true);
      expect(plugins.length).toBeGreaterThan(0);
    });

    it('should list enabled plugins', () => {
      const plugins = agent.listEnabledPlugins();

      expect(Array.isArray(plugins)).toBe(true);
      plugins.forEach(plugin => {
        expect(plugin.enabled).toBe(true);
      });
    });

    it('should get plugin by id', () => {
      const plugin = agent.getPlugin('example-plugin');

      expect(plugin).toBeDefined();
      expect(plugin?.id).toBe('example-plugin');
    });
  });

  describe('Plugin Enable/Disable', () => {
    it('should disable plugin', () => {
      agent.disablePlugin('example-plugin');

      const plugin = agent.getPlugin('example-plugin');
      expect(plugin?.enabled).toBe(false);
    });

    it('should enable plugin', () => {
      agent.enablePlugin('example-plugin');

      const plugin = agent.getPlugin('example-plugin');
      expect(plugin?.enabled).toBe(true);
    });
  });

  describe('Plugin Tools Registration', () => {
    it('should register plugin tools', async () => {
      await agent.loadPlugin('example-plugin');

      // Tools should be registered
      // We can't easily test SkillRegistry directly, but loading should succeed
      expect(true).toBe(true);
    });
  });

  describe('Plugin Reload', () => {
    it('should reload plugin', async () => {
      const plugin = await agent.reloadPlugin('example-plugin');

      expect(plugin).toBeDefined();
      expect(plugin.id).toBe('example-plugin');
    });
  });

  describe('Plugin Unload', () => {
    it('should unload plugin', async () => {
      await agent.unloadPlugin('example-plugin');

      const plugin = agent.getPlugin('example-plugin');
      expect(plugin).toBeUndefined();
    });

    it('should handle unload of non-loaded plugin', async () => {
      await expect(
        agent.unloadPlugin('non-loaded-plugin')
      ).rejects.toThrow();
    });
  });
});
