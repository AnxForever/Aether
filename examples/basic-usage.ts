/**
 * Nexus Agent - Usage Examples
 */

import { createNexusAgent } from '../src';

// ============================================================================
// Example 1: Basic Chat
// ============================================================================

async function basicChatExample() {
  const agent = createNexusAgent({
    apiKeys: {
      claude: process.env.ANTHROPIC_API_KEY!,
      openai: process.env.OPENAI_API_KEY!
    },
    model: 'claude-sonnet-4-20250514',
    provider: 'claude'
  });

  // Simple chat
  const response = await agent.chat('Hello, what can you help me with?');
  console.log(response);
}

// ============================================================================
// Example 2: Streaming Response
// ============================================================================

async function streamingExample() {
  const agent = createNexusAgent({
    apiKeys: {
      claude: process.env.ANTHROPIC_API_KEY!
    }
  });

  console.log('Assistant: ');

  for await (const chunk of agent.streamChat('Tell me a short story')) {
    process.stdout.write(chunk);
  }

  console.log('\n');
}

// ============================================================================
// Example 3: Multi-Provider Usage
// ============================================================================

async function multiProviderExample() {
  const agent = createNexusAgent({
    apiKeys: {
      claude: process.env.ANTHROPIC_API_KEY!,
      openai: process.env.OPENAI_API_KEY!,
      gemini: process.env.GEMINI_API_KEY!
    }
  });

  // Use Claude
  agent.updateSettings({ model: 'claude-sonnet-4-20250514' });
  const claudeResponse = await agent.chat('Hi from Claude!');

  // Switch to OpenAI
  agent.updateSettings({ model: 'gpt-4o' });
  const gptResponse = await agent.chat('Hi from GPT!');

  // Switch to Gemini
  agent.updateSettings({ model: 'gemini-2.0-flash-exp' });
  const geminiResponse = await agent.chat('Hi from Gemini!');

  console.log({ claudeResponse, gptResponse, geminiResponse });
}

// ============================================================================
// Example 4: Session Management
// ============================================================================

async function sessionExample() {
  const agent = createNexusAgent({
    apiKeys: {
      claude: process.env.ANTHROPIC_API_KEY!
    }
  });

  // Session 1
  await agent.chat('My name is Alice');
  await agent.chat('What is my name?'); // Should remember: Alice

  // Start new session
  agent.newSession();
  await agent.chat('What is my name?'); // Should not remember

  console.log('Current session:', agent.getSessionId());
}

// ============================================================================
// Example 5: Available Models
// ============================================================================

async function listModelsExample() {
  const agent = createNexusAgent({
    apiKeys: {
      claude: process.env.ANTHROPIC_API_KEY!,
      openai: process.env.OPENAI_API_KEY!,
      gemini: process.env.GEMINI_API_KEY!
    }
  });

  const models = await agent.getAvailableModels();

  console.log('Available models:');
  for (const model of models) {
    console.log(`- ${model.name} (${model.provider})`);
    console.log(`  Context: ${model.contextWindow.toLocaleString()} tokens`);
    console.log(`  Pricing: $${model.inputPrice}/M input, $${model.outputPrice}/M output`);
  }
}

// ============================================================================
// Example 6: Error Handling
// ============================================================================

async function errorHandlingExample() {
  const agent = createNexusAgent({
    apiKeys: {
      claude: 'invalid-key'
    }
  });

  try {
    await agent.chat('This will fail');
  } catch (error) {
    console.error('Error caught:', error);
    // Handle error gracefully
  }
}

// ============================================================================
// Example 7: Settings Configuration
// ============================================================================

async function settingsExample() {
  const agent = createNexusAgent({
    apiKeys: {
      claude: process.env.ANTHROPIC_API_KEY!
    }
  });

  // Update settings
  agent.updateSettings({
    model: 'claude-opus-4-20250514',
    temperature: 0.7,
    maxTokens: 2048,
    language: 'zh',
    theme: 'dark'
  });

  const response = await agent.chat('你好！');
  console.log(response);
}

// ============================================================================
// Run Examples
// ============================================================================

async function main() {
  console.log('=== Nexus Agent Examples ===\n');

  try {
    await basicChatExample();
    await streamingExample();
    await multiProviderExample();
    await sessionExample();
    await listModelsExample();
    await errorHandlingExample();
    await settingsExample();
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Uncomment to run
// main();
