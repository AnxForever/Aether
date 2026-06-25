/**
 * Plugin System Example
 *
 * Demonstrates plugin loading, installation, and usage
 */

import { PluginLoader } from '../src/plugins/plugin-loader';
import { pluginRegistry } from '../src/plugins/plugin-registry';
import { pluginStore } from '../src/plugins/plugin-store';
import { PluginInstaller } from '../src/plugins/plugin-installer';
import { join } from 'path';

async function main() {
  console.log('=== Nexus Plugin System Demo ===\n');

  const pluginsDir = join(__dirname, '../plugins');

  // 1. Plugin Loader
  console.log('1. Loading Plugins');
  console.log('------------------');

  const loader = new PluginLoader({ pluginsDir });
  const plugins = await loader.loadAll();

  console.log(`Loaded ${plugins.length} plugins:`);
  plugins.forEach((plugin) => {
    console.log(`  - ${plugin.name} v${plugin.version}`);
    console.log(`    ${plugin.description}`);
    console.log(`    Tools: ${plugin.manifest.capabilities?.join(', ') || 'none'}`);
  });

  console.log();

  // 2. Plugin Registry
  console.log('2. Plugin Registry');
  console.log('------------------');

  // Register plugins
  plugins.forEach((plugin) => pluginRegistry.register(plugin));

  const stats = pluginRegistry.getStats();
  console.log(`Registry stats:`);
  console.log(`  Total: ${stats.total}`);
  console.log(`  Enabled: ${stats.enabled}`);
  console.log(`  Hooks: ${stats.hooks}`);

  console.log();

  // 3. Plugin Hooks
  console.log('3. Plugin Hook System');
  console.log('---------------------');

  // Register a hook
  pluginRegistry.registerHook('test-plugin', 'before-chat', async (message: string) => {
    console.log(`[Hook] Before chat: ${message}`);
    return message.toUpperCase();
  });

  // Execute hooks
  const results = await pluginRegistry.executeHook('before-chat', 'hello world');
  console.log('Hook results:', results);

  console.log();

  // 4. Plugin Store
  console.log('4. Plugin Store (Marketplace)');
  console.log('-----------------------------');

  // Search plugins
  const searchResults = await pluginStore.search('calendar');
  console.log(`Search results for "calendar": ${searchResults.length} found`);
  searchResults.slice(0, 3).forEach((plugin) => {
    console.log(`  - ${plugin.name} (${plugin.downloads} downloads)`);
    console.log(`    ${plugin.description}`);
  });

  console.log();

  // Get popular plugins
  const popular = await pluginStore.getPopular(5);
  console.log('Popular plugins:');
  popular.forEach((plugin, index) => {
    console.log(`  ${index + 1}. ${plugin.name} - ⭐ ${plugin.rating}/5 (${plugin.downloads} downloads)`);
  });

  console.log();

  // 5. Plugin Installer
  console.log('5. Plugin Installation');
  console.log('----------------------');

  const installer = new PluginInstaller(pluginsDir, loader);

  try {
    // Install a plugin
    console.log('Installing plugin: example-calendar...');
    await installer.install('example-calendar', '1.0.0');
    console.log('✅ Plugin installed successfully!');
  } catch (error: any) {
    console.log('⚠️  Installation failed:', error.message);
    console.log('   (Plugin may not exist in store)');
  }

  console.log();

  // Check for updates
  console.log('Checking for plugin updates...');
  const updates = await installer.checkAllUpdates();
  if (updates.length > 0) {
    console.log(`Found ${updates.length} updates:`);
    updates.forEach((update) => {
      console.log(`  - ${update.pluginId}: ${update.currentVersion} → ${update.latestVersion}`);
    });
  } else {
    console.log('All plugins are up to date!');
  }

  console.log();

  // 6. Plugin Lifecycle
  console.log('6. Plugin Lifecycle');
  console.log('-------------------');

  const enabledPlugins = pluginRegistry.listEnabled();
  console.log(`Currently enabled: ${enabledPlugins.length} plugins`);

  // Disable a plugin
  if (enabledPlugins.length > 0) {
    const plugin = enabledPlugins[0];
    console.log(`Disabling plugin: ${plugin.name}`);
    pluginRegistry.disable(plugin.id);

    console.log(`Enabled plugins now: ${pluginRegistry.listEnabled().length}`);

    // Re-enable
    console.log(`Re-enabling plugin: ${plugin.name}`);
    pluginRegistry.enable(plugin.id);
  }

  console.log('\n=== Plugin system demo completed! ===');
}

main().catch(console.error);
