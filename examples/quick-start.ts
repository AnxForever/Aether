/**
 * Aether Quick Start Example
 * 
 * This example demonstrates basic usage of the Aether platform
 */

import { NexusAgent } from '../src/agent';
import { ClaudeConnector } from '../src/connectors/claude';
import { OpenAIConnector } from '../src/connectors/openai';

async function main() {
  // Initialize AI connectors
  const connectors = {
    claude: new ClaudeConnector(process.env.ANTHROPIC_API_KEY!),
    openai: new OpenAIConnector(process.env.OPENAI_API_KEY!)
  };

  // Create agent instance
  const agent = new NexusAgent({
    defaultProvider: 'claude',
    connectors
  });

  // Basic chat
  const response = await agent.chat('Hello! How can you help me?');
  console.log('Assistant:', response);

  // Chat with specific model
  const codingResponse = await agent.chat(
    'Write a TypeScript function to calculate fibonacci',
    { model: 'claude-3-5-sonnet-20241022' }
  );
  console.log('Coding Response:', codingResponse);

  // Streaming response
  const stream = agent.streamChat('Tell me a short story');
  for await (const chunk of stream) {
    process.stdout.write(chunk.content);
  }
}

main().catch(console.error);
