#!/usr/bin/env node

/**
 * Nexus CLI - Command-line interface
 */

const { createNexusAgent } = require('../dist');
const readline = require('readline');

async function main() {
  console.log('🌟 Nexus Agent CLI\n');

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY not set');
    console.error('Set it with: export ANTHROPIC_API_KEY=your-key');
    process.exit(1);
  }

  // Create agent
  const agent = createNexusAgent({
    apiKeys: {
      claude: process.env.ANTHROPIC_API_KEY,
      openai: process.env.OPENAI_API_KEY,
      gemini: process.env.GOOGLE_API_KEY
    },
    model: process.env.NEXUS_MODEL || 'claude-sonnet-4-20250514'
  });

  console.log('Agent ready! Type your message (Ctrl+C to exit)\n');

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'You: '
  });

  rl.prompt();

  rl.on('line', async (input) => {
    const message = input.trim();

    if (!message) {
      rl.prompt();
      return;
    }

    try {
      console.log('\nAssistant: ');

      // Stream response
      for await (const chunk of agent.streamChat(message)) {
        process.stdout.write(chunk);
      }

      console.log('\n');
    } catch (error) {
      console.error('\nError:', error.message);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\nGoodbye!');
    process.exit(0);
  });
}

main().catch(console.error);
