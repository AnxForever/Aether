/**
 * Integration Example: Nexus Agent with File Watcher
 *
 * Demonstrates how to integrate the file watcher system with Nexus Agent
 * for real-time skill and plugin hot reloading.
 *
 * @module watcher/integration-example
 */

import { FileWatcher, HotReloadManager } from './index.js';
import { join } from 'path';
import type { FileChangeEvent } from '../types/watcher.js';

/**
 * Nexus Agent integration example
 */
export class NexusWatcherIntegration {
  private fileWatcher: FileWatcher;
  private skillReloader: HotReloadManager;
  private pluginReloader: HotReloadManager;
  private configReloader: HotReloadManager;

  constructor(
    nexusDataDir: string,
    private onSkillReload?: (changes: FileChangeEvent[]) => Promise<void>,
    private onPluginReload?: (changes: FileChangeEvent[]) => Promise<void>,
    private onConfigReload?: (changes: FileChangeEvent[]) => Promise<void>
  ) {
    // Initialize file watcher for all directories
    this.fileWatcher = new FileWatcher({
      paths: [
        join(nexusDataDir, 'skills'),
        join(nexusDataDir, 'plugins'),
        join(nexusDataDir, 'config'),
      ],
      recursive: true,
      ignore: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/*.log',
        '**/.env*',
        '**/package-lock.json',
        '**/yarn.lock',
      ],
      debounceMs: 50,
      autoRetry: true,
      maxRetries: 5,
    });

    // Setup hot reload for skills
    this.skillReloader = new HotReloadManager(this.fileWatcher, {
      patterns: [
        '**/skills/**/*.ts',
        '**/skills/**/*.js',
        '**/skills/**/skill.json',
      ],
      debounceMs: 200,
      onReload: async (changes) => {
        console.log('\n🔄 [Nexus] Reloading skills...');

        const skillChanges = changes.filter(c =>
          c.relativePath.includes('skills/')
        );

        if (this.onSkillReload) {
          await this.onSkillReload(skillChanges);
        }

        console.log(`✅ [Nexus] Reloaded ${skillChanges.length} skill file(s)\n`);
      },
      onError: (error) => {
        console.error('❌ [Nexus] Skill reload failed:', error);
      },
    });

    // Setup hot reload for plugins
    this.pluginReloader = new HotReloadManager(this.fileWatcher, {
      patterns: [
        '**/plugins/**/*.ts',
        '**/plugins/**/*.js',
        '**/plugins/**/plugin.json',
      ],
      debounceMs: 200,
      onReload: async (changes) => {
        console.log('\n🔄 [Nexus] Reloading plugins...');

        const pluginChanges = changes.filter(c =>
          c.relativePath.includes('plugins/')
        );

        if (this.onPluginReload) {
          await this.onPluginReload(pluginChanges);
        }

        console.log(`✅ [Nexus] Reloaded ${pluginChanges.length} plugin file(s)\n`);
      },
      onError: (error) => {
        console.error('❌ [Nexus] Plugin reload failed:', error);
      },
    });

    // Setup hot reload for config
    this.configReloader = new HotReloadManager(this.fileWatcher, {
      patterns: [
        '**/config/**/*.json',
        '**/config/**/*.yaml',
        '**/config/**/*.yml',
      ],
      debounceMs: 500, // Longer debounce for config
      onReload: async (changes) => {
        console.log('\n🔧 [Nexus] Reloading configuration...');

        const configChanges = changes.filter(c =>
          c.relativePath.includes('config/')
        );

        if (this.onConfigReload) {
          await this.onConfigReload(configChanges);
        }

        console.log(`✅ [Nexus] Reloaded ${configChanges.length} config file(s)\n`);
      },
      onError: (error) => {
        console.error('❌ [Nexus] Config reload failed:', error);
      },
    });
  }

  /**
   * Start watching all directories
   */
  async start(): Promise<void> {
    console.log('🚀 [Nexus] Starting file watcher...');

    // Start file watcher
    await this.fileWatcher.start();

    // Start hot reloaders
    this.skillReloader.start();
    this.pluginReloader.start();
    this.configReloader.start();

    console.log('👀 [Nexus] Watching for changes...\n');
  }

  /**
   * Stop watching
   */
  async stop(): Promise<void> {
    console.log('\n🛑 [Nexus] Stopping file watcher...');

    // Stop hot reloaders
    this.configReloader.stop();
    this.pluginReloader.stop();
    this.skillReloader.stop();

    // Stop file watcher
    await this.fileWatcher.stop();

    console.log('✅ [Nexus] File watcher stopped');
  }

  /**
   * Add additional path to watch
   */
  async addWatchPath(path: string): Promise<void> {
    await this.fileWatcher.addPath(path);
    console.log(`✅ [Nexus] Added watch path: ${path}`);
  }

  /**
   * Remove path from watching
   */
  async removeWatchPath(path: string): Promise<void> {
    await this.fileWatcher.removePath(path);
    console.log(`✅ [Nexus] Removed watch path: ${path}`);
  }

  /**
   * Get watcher state
   */
  getState() {
    return {
      watcherState: this.fileWatcher.state,
      watchedPaths: this.fileWatcher.getWatchedPaths(),
      skillReloaderActive: this.skillReloader.active,
      pluginReloaderActive: this.pluginReloader.active,
      configReloaderActive: this.configReloader.active,
      pendingSkillChanges: this.skillReloader.getPendingCount(),
      pendingPluginChanges: this.pluginReloader.getPendingCount(),
      pendingConfigChanges: this.configReloader.getPendingCount(),
    };
  }
}

/**
 * Usage example
 */
export async function exampleUsage() {
  const nexusDataDir = '/path/to/nexus/data';

  const integration = new NexusWatcherIntegration(
    nexusDataDir,
    // Skill reload handler
    async (changes) => {
      for (const change of changes) {
        console.log(`  🔧 Processing skill: ${change.relativePath}`);

        // Your skill reload logic here
        // Example: Clear cache and re-import
        const skillPath = change.path;

        if (change.type === 'delete') {
          // Unregister skill
          console.log(`    🗑️  Unregistering skill`);
        } else {
          // Reload skill
          try {
            // In ESM, you might need to use dynamic import with timestamp
            await import(`${skillPath}?t=${Date.now()}`);
            console.log(`    ✅ Skill reloaded`);
          } catch (error) {
            console.error(`    ❌ Failed to reload skill:`, error);
          }
        }
      }
    },
    // Plugin reload handler
    async (changes) => {
      for (const change of changes) {
        console.log(`  🔌 Processing plugin: ${change.relativePath}`);

        // Your plugin reload logic here
        if (change.type === 'delete') {
          console.log(`    🗑️  Unregistering plugin`);
        } else {
          try {
            await import(`${change.path}?t=${Date.now()}`);
            console.log(`    ✅ Plugin reloaded`);
          } catch (error) {
            console.error(`    ❌ Failed to reload plugin:`, error);
          }
        }
      }
    },
    // Config reload handler
    async (changes) => {
      for (const change of changes) {
        console.log(`  ⚙️  Processing config: ${change.relativePath}`);

        // Your config reload logic here
        try {
          // Read and parse config file
          const fs = await import('fs/promises');
          const content = await fs.readFile(change.path, 'utf-8');

          if (change.relativePath.endsWith('.json')) {
            JSON.parse(content);
            console.log(`    ✅ Config reloaded`);
          } else if (change.relativePath.match(/\.ya?ml$/)) {
            // Parse YAML
            console.log(`    ✅ Config reloaded`);
          }
        } catch (error) {
          console.error(`    ❌ Failed to reload config:`, error);
        }
      }
    }
  );

  // Start watching
  await integration.start();

  // Get current state
  console.log('Current state:', integration.getState());

  // Add additional watch path
  // await integration.addWatchPath('/path/to/additional');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await integration.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await integration.stop();
    process.exit(0);
  });
}

// Run example if this file is executed directly
// Note: import.meta is only available in ES modules
// This check is disabled for CommonJS build
// if (import.meta.url === `file://${process.argv[1]}`) {
//   exampleUsage().catch(console.error);
// }
