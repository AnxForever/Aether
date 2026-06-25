#!/usr/bin/env node

/**
 * Nexus Agent CLI Example
 *
 * Usage examples:
 *   node cli-example.js help
 *   node cli-example.js execute "Analyze the codebase"
 *   node cli-example.js skill:list
 *   node cli-example.js skill:invoke code-review --verbose
 *   node cli-example.js server:start --port=3000 --host=127.0.0.1
 *   node cli-example.js server:stop
 */

import { PiAgentAdapter } from '../agent/pi-adapter';
import { SkillRegistry } from '../skills/skill-loader';
import { CliManager } from './cli-manager';
import { CliTool } from './cli-tool';

async function main() {
  try {
    // Initialize PiAgentAdapter
    CliTool.info('Initializing Nexus Agent...');

    const agent = new PiAgentAdapter({
      name: 'nexus-cli-agent',
      description: 'Nexus Agent CLI',
      version: '1.0.0',
    });

    // Initialize SkillRegistry
    const skillRegistry = new SkillRegistry();

    // Load skills from default directory (optional)
    // await skillRegistry.loadFromDirectory('./skills');

    // Create CLI Manager
    const cliManager = new CliManager(agent, skillRegistry, {
      httpServer: {
        port: 3000,
        host: '127.0.0.1',
      },
    });

    // Handle cleanup on exit
    const cleanup = async () => {
      console.log();
      CliTool.info('Cleaning up...');
      await cliManager.cleanup();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Run CLI
    await cliManager.run(process.argv);

  } catch (error) {
    console.error();
    CliTool.error('Fatal error:');
    console.error(error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { main };
