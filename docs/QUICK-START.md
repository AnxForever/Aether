/**
 * Nexus Agent - Quick Start Guide
 */

# Quick Start Guide

## Installation

```bash
cd nexus-agent
npm install
npm run build
```

## Basic Usage

```typescript
import { createNexusAgent } from 'nexus-agent';

const agent = createNexusAgent({
  apiKeys: {
    claude: process.env.ANTHROPIC_API_KEY!
  },
  model: 'claude-sonnet-4-20250514'
});

// Simple chat
const response = await agent.chat('Hello!');
console.log(response);

// Streaming
for await (const chunk of agent.streamChat('Tell me a story')) {
  process.stdout.write(chunk);
}
```

## Environment Variables

Create a `.env` file:

```bash
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx
GOOGLE_API_KEY=xxx
```

## Available Providers

- **Claude** (Anthropic) - Best reasoning
- **OpenAI** (GPT-4) - General purpose
- **Gemini** (Google) - Large context
- **MiniMax** - Chinese language
- **Moonshot** (Kimi) - Long context
- **GLM** (Zhipu) - Chinese AI
- **DeepSeek** - Code generation

## Configuration

```typescript
const agent = createNexusAgent({
  // Required
  apiKeys: {
    claude: 'your-api-key',
    openai: 'your-api-key'
  },
  
  // Optional
  model: 'claude-sonnet-4-20250514',
  provider: 'claude',
  dataDir: '~/.nexus',
  deviceId: 'custom-device-id'
});
```

## API Reference

### Chat Methods

```typescript
// Get complete response
const response: string = await agent.chat(message);

// Stream response
for await (const chunk of agent.streamChat(message)) {
  console.log(chunk);
}
```

### Session Management

```typescript
// Create new session
agent.newSession();

// Get current session ID
const sessionId = agent.getSessionId();
```

### Settings

```typescript
agent.updateSettings({
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 2048,
  language: 'zh',
  theme: 'dark'
});
```

### Check Status

```typescript
// Check if agent is processing
const isProcessing = agent.isProcessing();

// Get available models
const models = await agent.getAvailableModels();
```

## Examples

See `/examples` directory for complete examples:

- `basic-usage.ts` - Basic chat and streaming
- `multi-provider.ts` - Using multiple AI providers
- `session-management.ts` - Session handling
- `error-handling.ts` - Error handling patterns

## Next Steps

- Read [Architecture](../docs/ARCHITECTURE.md) for system design
- Check [API Documentation](../docs/API.md) for detailed reference
- Explore [Skills System](../docs/SKILLS.md) for built-in capabilities

## Support

- GitHub: https://github.com/nexus-team/nexus-agent
- Issues: https://github.com/nexus-team/nexus-agent/issues
- Docs: https://nexus-agent.dev/docs
