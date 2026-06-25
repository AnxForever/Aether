/**
 * Plugin System Demo
 *
 * Demonstrates how to use the Nexus plugin system:
 * - Loading plugins
 * - Using plugin tools
 * - Managing plugins (enable/disable)
 * - Installing from marketplace
 * - Plugin lifecycle
 */

import { NexusAgent } from '../src/agent';
import { join } from 'path';

/**
 * Demo 1: Basic Plugin Loading
 */
async function demo1_basicLoading() {
  console.log('\n=== Demo 1: Basic Plugin Loading ===\n');

  const agent = new NexusAgent({
    dataDir: './demo-data',
    pluginsDir: './plugins',
    apiKeys: {
      claude: process.env.ANTHROPIC_API_KEY || 'demo-key'
    }
  });

  await agent.initialize();

  // List all loaded plugins
  const plugins = agent.listPlugins();
  console.log(`Loaded ${plugins.length} plugins:`);
  plugins.forEach(plugin => {
    console.log(`  - ${plugin.name} v${plugin.version} (${plugin.id})`);
  });

  await agent.cleanup();
}

/**
 * Demo 2: Loading Specific Plugin
 */
async function demo2_loadSpecificPlugin() {
  console.log('\n=== Demo 2: Loading Specific Plugin ===\n');

  const agent = new NexusAgent({
    dataDir: './demo-data',
    pluginsDir: './plugins'
  });

  await agent.initialize();

  try {
    // Load example plugin
    console.log('Loading example-plugin...');
    const plugin = await agent.loadPlugin('example-plugin');

    console.log('✓ Plugin loaded successfully:');
    console.log(`  Name: ${plugin.name}`);
    console.log(`  Version: ${plugin.version}`);
    console.log(`  Tools: ${plugin.manifest.capabilities?.join(', ') || 'none'}`);

  } catch (error) {
    console.error('✗ Failed to load plugin:', error);
  }

  await agent.cleanup();
}

/**
 * Demo 3: Using Plugin Tools
 */
async function demo3_usingPluginTools() {
  console.log('\n=== Demo 3: Using Plugin Tools ===\n');

  const agent = new NexusAgent({
    dataDir: './demo-data',
    pluginsDir: './plugins',
    apiKeys: {
      claude: process.env.ANTHROPIC_API_KEY || ''
    }
  });

  await agent.initialize();

  try {
    // Load plugin
    await agent.loadPlugin('example-plugin');

    // Get plugin to access tools
    const plugin = agent.getPlugin('example-plugin');

    if (plugin && plugin.module.tools) {
      console.log(`Found ${plugin.module.tools.length} tools:\n`);

      // Test reverse_text tool
      const reverseTool = plugin.module.tools.find((t: any) => t.name === 'reverse_text');
      if (reverseTool) {
        console.log('Testing reverse_text tool:');
        const result = await reverseTool.handler({ text: 'Hello, Nexus!' });
        console.log(`  Input: "Hello, Nexus!"`);
        console.log(`  Output: "${result.data}"`);
        console.log('');
      }

      // Test count_words tool
      const countTool = plugin.module.tools.find((t: any) => t.name === 'count_words');
      if (countTool) {
        console.log('Testing count_words tool:');
        const text = 'The quick brown fox jumps over the lazy dog.';
        const result = await countTool.handler({ text });
        console.log(`  Input: "${text}"`);
        console.log(`  Words: ${result.data.words}`);
        console.log(`  Characters: ${result.data.characters}`);
        console.log(`  Sentences: ${result.data.sentences}`);
        console.log('');
      }

      // Test generate_uuid tool
      const uuidTool = plugin.module.tools.find((t: any) => t.name === 'generate_uuid');
      if (uuidTool) {
        console.log('Testing generate_uuid tool:');
        const result = await uuidTool.handler({ count: 3 });
        console.log(`  Generated UUIDs:`);
        result.data.forEach((uuid: string, i: number) => {
          console.log(`    ${i + 1}. ${uuid}`);
        });
        console.log('');
      }

      // Test format_json tool
      const formatTool = plugin.module.tools.find((t: any) => t.name === 'format_json');
      if (formatTool) {
        console.log('Testing format_json tool:');
        const json = '{"name":"Nexus","version":"1.0.0","active":true}';
        const result = await formatTool.handler({ json, indent: 2 });
        console.log(`  Input: ${json}`);
        console.log(`  Output:\n${result.data}`);
      }
    }
  } catch (error) {
    console.error('✗ Error:', error);
  }

  await agent.cleanup();
}

/**
 * Demo 4: Plugin Management
 */
async function demo4_pluginManagement() {
  console.log('\n=== Demo 4: Plugin Management ===\n');

  const agent = new NexusAgent({
    dataDir: './demo-data',
    pluginsDir: './plugins'
  });

  await agent.initialize();

  try {
    // Load plugin
    await agent.loadPlugin('example-plugin');
    console.log('✓ Plugin loaded');

    // Get plugin stats
    const stats = agent.getPluginStats();
    console.log(`\nPlugin Statistics:`);
    console.log(`  Total: ${stats.total}`);
    console.log(`  Enabled: ${stats.enabled}`);
    console.log(`  Disabled: ${stats.disabled}`);

    // Disable plugin
    console.log('\nDisabling plugin...');
    agent.disablePlugin('example-plugin');

    const disabledPlugins = agent.listPlugins().filter(p => !p.enabled);
    console.log(`✓ Disabled plugins: ${disabledPlugins.length}`);

    // Enable plugin
    console.log('\nRe-enabling plugin...');
    agent.enablePlugin('example-plugin');

    const enabledPlugins = agent.listEnabledPlugins();
    console.log(`✓ Enabled plugins: ${enabledPlugins.length}`);

    // Unload plugin
    console.log('\nUnloading plugin...');
    await agent.unloadPlugin('example-plugin');
    console.log('✓ Plugin unloaded');

    // Reload plugin
    console.log('\nReloading plugin...');
    await agent.loadPlugin('example-plugin');
    console.log('✓ Plugin reloaded');

  } catch (error) {
    console.error('✗ Error:', error);
  }

  await agent.cleanup();
}

/**
 * Demo 5: Marketplace Operations (simulated)
 */
async function demo5_marketplaceOperations() {
  console.log('\n=== Demo 5: Marketplace Operations ===\n');

  const agent = new NexusAgent({
    dataDir: './demo-data',
    pluginsDir: './plugins',
    marketplaceUrl: 'https://api.nexus-plugins.dev'
  });

  await agent.initialize();

  try {
    // Search plugins
    console.log('Searching for plugins...');
    // Note: This will fail without a real marketplace, but demonstrates the API
    try {
      const results = await agent.searchPlugins('github');
      console.log(`Found ${results.length} plugins`);
      results.forEach(plugin => {
        console.log(`  - ${plugin.name}: ${plugin.description}`);
      });
    } catch (error) {
      console.log('(Marketplace unavailable - this is expected in demo)');
    }

    // Get featured plugins
    console.log('\nFetching featured plugins...');
    try {
      const featured = await agent.getFeaturedPlugins();
      console.log(`Featured plugins: ${featured.length}`);
    } catch (error) {
      console.log('(Marketplace unavailable - this is expected in demo)');
    }

    // Check for updates
    console.log('\nChecking for plugin updates...');
    try {
      const updates = await agent.checkPluginUpdates();
      if (updates.length > 0) {
        console.log(`Updates available:`);
        updates.forEach(update => {
          console.log(`  - ${update.pluginId}: ${update.currentVersion} → ${update.latestVersion}`);
        });
      } else {
        console.log('All plugins are up to date');
      }
    } catch (error) {
      console.log('(Marketplace unavailable - this is expected in demo)');
    }

  } catch (error) {
    console.error('✗ Error:', error);
  }

  await agent.cleanup();
}

/**
 * Demo 6: Plugin Validation
 */
async function demo6_pluginValidation() {
  console.log('\n=== Demo 6: Plugin Validation ===\n');

  const agent = new NexusAgent({
    dataDir: './demo-data',
    pluginsDir: './plugins'
  });

  await agent.initialize();

  try {
    // This will validate the plugin during load
    console.log('Loading and validating example-plugin...');
    const plugin = await agent.loadPlugin('example-plugin');

    console.log('✓ Plugin passed validation');
    console.log(`  Manifest validation: PASSED`);
    console.log(`  Security check: PASSED`);
    console.log(`  Permissions: ${plugin.manifest.permissions?.join(', ') || 'none'}`);

  } catch (error: any) {
    console.error('✗ Validation failed:', error.message);
  }

  await agent.cleanup();
}

/**
 * Run all demos
 */
async function runAllDemos() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Nexus Plugin System Demo Suite      ║');
  console.log('╚════════════════════════════════════════╝');

  try {
    await demo1_basicLoading();
    await demo2_loadSpecificPlugin();
    await demo3_usingPluginTools();
    await demo4_pluginManagement();
    await demo5_marketplaceOperations();
    await demo6_pluginValidation();

    console.log('\n✓ All demos completed successfully!\n');
  } catch (error) {
    console.error('\n✗ Demo failed:', error);
    process.exit(1);
  }
}

/**
 * Main entry point
 */
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const demoNumber = args[0];

  if (demoNumber) {
    // Run specific demo
    switch (demoNumber) {
      case '1':
        demo1_basicLoading().catch(console.error);
        break;
      case '2':
        demo2_loadSpecificPlugin().catch(console.error);
        break;
      case '3':
        demo3_usingPluginTools().catch(console.error);
        break;
      case '4':
        demo4_pluginManagement().catch(console.error);
        break;
      case '5':
        demo5_marketplaceOperations().catch(console.error);
        break;
      case '6':
        demo6_pluginValidation().catch(console.error);
        break;
      default:
        console.error('Invalid demo number. Use 1-6 or no argument to run all.');
        process.exit(1);
    }
  } else {
    // Run all demos
    runAllDemos().catch(console.error);
  }
}

export {
  demo1_basicLoading,
  demo2_loadSpecificPlugin,
  demo3_usingPluginTools,
  demo4_pluginManagement,
  demo5_marketplaceOperations,
  demo6_pluginValidation,
  runAllDemos
};
