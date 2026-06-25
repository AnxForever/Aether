/**
 * Multi-Provider Example
 *
 * Demonstrates switching between different AI providers
 */

import { NexusAgent } from '../src/agent';

async function main() {
  // Initialize with multiple providers
  const agent = new NexusAgent({
    apiKeys: {
      claude: process.env.ANTHROPIC_API_KEY!,
      openai: process.env.OPENAI_API_KEY!,
      gemini: process.env.GOOGLE_API_KEY!,
      minimax: process.env.MINIMAX_API_KEY!,
      moonshot: process.env.MOONSHOT_API_KEY!,
      glm: process.env.GLM_API_KEY!,
      deepseek: process.env.DEEPSEEK_API_KEY!
    }
  });

  await agent.initialize();

  console.log('=== Testing Multiple AI Providers ===\n');

  // Test Claude
  console.log('1. Testing Claude (Anthropic)...');
  await agent.updateSettings({ model: 'claude-sonnet-4-20250514' });
  const claudeResponse = await agent.chat('Say hello in Chinese');
  console.log('Claude:', claudeResponse);
  console.log();

  // Test OpenAI
  console.log('2. Testing OpenAI GPT-4...');
  await agent.updateSettings({ model: 'gpt-4o' });
  const openaiResponse = await agent.chat('Say hello in Japanese');
  console.log('OpenAI:', openaiResponse);
  console.log();

  // Test Gemini
  console.log('3. Testing Google Gemini...');
  await agent.updateSettings({ model: 'gemini-2.0-flash-exp' });
  const geminiResponse = await agent.chat('Say hello in Korean');
  console.log('Gemini:', geminiResponse);
  console.log();

  // Test MiniMax
  console.log('4. Testing MiniMax...');
  await agent.updateSettings({ model: 'abab6.5s-chat' });
  const minimaxResponse = await agent.chat('用中文问好');
  console.log('MiniMax:', minimaxResponse);
  console.log();

  // Test Moonshot
  console.log('5. Testing Moonshot (Kimi)...');
  await agent.updateSettings({ model: 'moonshot-v1-128k' });
  const moonshotResponse = await agent.chat('用中文介绍你自己');
  console.log('Moonshot:', moonshotResponse);
  console.log();

  // Test GLM
  console.log('6. Testing Zhipu GLM...');
  await agent.updateSettings({ model: 'glm-4-plus' });
  const glmResponse = await agent.chat('你好，请简单介绍一下自己');
  console.log('GLM:', glmResponse);
  console.log();

  // Test DeepSeek
  console.log('7. Testing DeepSeek...');
  await agent.updateSettings({ model: 'deepseek-chat' });
  const deepseekResponse = await agent.chat('Write a Python hello world');
  console.log('DeepSeek:', deepseekResponse);
  console.log();

  console.log('=== All providers tested successfully! ===');

  await agent.cleanup();
}

main().catch(console.error);
