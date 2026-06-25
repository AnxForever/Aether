# Aether API Reference

Complete API documentation for Aether.

## Table of Contents

- [Core API](#core-api)
- [Storage API](#storage-api)
- [Skills API](#skills-api)
- [Server API](#server-api)
- [Plugin API](#plugin-api)
- [IPC Protocol](#ipc-protocol)

---

## Core API

### AetherAgent

Main agent class for interacting with Aether.

#### Constructor

```typescript
new AetherAgent(config: AetherAgentConfig)
```

**Config:**
```typescript
interface AetherAgentConfig {
  apiKeys: Record<string, string>;  // AI provider API keys
  model?: string;                   // Default model
  provider?: string;                // Default provider
  dataDir?: string;                 // Data directory path
  deviceId?: string;                // Device identifier
}
```

#### Methods

##### `initialize()`

Initialize the agent.

```typescript
await agent.initialize(): Promise<void>
```

##### `chat()`

Send a message and get response.

```typescript
await agent.chat(
  message: string,
  sessionId?: string
): Promise<string>
```

**Example:**
```typescript
const response = await agent.chat('Hello, how are you?');
console.log(response);
```

##### `streamChat()`

Stream response in real-time.

```typescript
agent.streamChat(
  message: string,
  sessionId?: string
): AsyncIterable<string>
```

**Example:**
```typescript
for await (const chunk of agent.streamChat('Tell me a story')) {
  process.stdout.write(chunk);
}
```

##### `newSession()`

Create a new chat session.

```typescript
agent.newSession(): void
```

##### `getSessionId()`

Get current session ID.

```typescript
agent.getSessionId(): string
```

##### `updateSettings()`

Update agent settings.

```typescript
await agent.updateSettings(
  settings: Partial<AgentSettings>
): Promise<void>
```

**Settings:**
```typescript
interface AgentSettings {
  model: string;
  temperature?: number;
  maxTokens?: number;
  streamResponse?: boolean;
  language: 'en' | 'zh';
  theme: 'light' | 'dark' | 'auto';
}
```

##### `getSettings()`

Get current settings.

```typescript
await agent.getSettings(): Promise<AgentSettings>
```

##### `getAvailableModels()`

Get list of available AI models.

```typescript
await agent.getAvailableModels(): Promise<ModelConfig[]>
```

##### `isProcessing()`

Check if agent is currently processing.

```typescript
agent.isProcessing(): boolean
```

##### `cleanup()`

Cleanup and shutdown agent.

```typescript
await agent.cleanup(): Promise<void>
```

---

## Storage API

### ChatHistory

Manage chat sessions and messages.

#### Constructor

```typescript
new ChatHistory(dbPath: string)
```

#### Methods

##### `createSession()`

Create a new session.

```typescript
chatHistory.createSession(
  type: 'chat' | 'coding',
  title: string
): string  // Returns session ID
```

##### `addMessage()`

Add message to session.

```typescript
chatHistory.addMessage(
  sessionId: string,
  message: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
  }
): void
```

##### `getMessages()`

Get all messages in session.

```typescript
chatHistory.getMessages(
  sessionId: string,
  limit?: number
): Message[]
```

##### `listSessions()`

List all sessions.

```typescript
chatHistory.listSessions(): Session[]
```

##### `deleteSession()`

Delete a session.

```typescript
chatHistory.deleteSession(sessionId: string): void
```

---

### ConfigManager

Manage encrypted configuration.

#### Constructor

```typescript
new ConfigManager(
  configPath: string,
  encryptionKey: Buffer
)
```

#### Methods

##### `load()`

Load configuration.

```typescript
await configManager.load<T>(): Promise<T>
```

##### `save()`

Save configuration.

```typescript
await configManager.save(config: any): Promise<void>
```

##### `update()`

Update specific fields.

```typescript
await configManager.update(
  updates: Record<string, any>
): Promise<void>
```

---

## Skills API

### Skill Registry

Manage skills and tools.

#### Methods

##### `register()`

Register a skill.

```typescript
skillRegistry.register(skill: Skill): void
```

##### `listAll()`

List all skills.

```typescript
skillRegistry.listAll(): Skill[]
```

##### `listEnabled()`

List enabled skills.

```typescript
skillRegistry.listEnabled(): Skill[]
```

##### `getAllTools()`

Get all tools from enabled skills.

```typescript
skillRegistry.getAllTools(): Tool[]
```

##### `findTool()`

Find tool by name.

```typescript
skillRegistry.findTool(name: string): Tool | undefined
```

---

## Server API

### HTTPServer

REST API server.

#### Constructor

```typescript
new HTTPServer(config: {
  port: number;
  host?: string;
  cors?: boolean;
})
```

#### Methods

##### `start()`

Start server.

```typescript
await httpServer.start(): Promise<void>
```

##### `stop()`

Stop server.

```typescript
await httpServer.stop(): Promise<void>
```

##### `route()`

Add route.

```typescript
httpServer.route(
  method: string,
  path: string,
  handler: RouteHandler
): void
```

---

### WebSocket Server

Real-time communication.

#### Methods

##### `attach()`

Attach to HTTP server.

```typescript
wsServer.attach(httpServer: HTTPServer): void
```

##### `broadcast()`

Broadcast message to all connections.

```typescript
wsServer.broadcast(type: string, data: any): void
```

##### `sendTo()`

Send to specific connection.

```typescript
wsServer.sendTo(
  connectionId: string,
  type: string,
  data: any
): void
```

---

## Plugin API

### Plugin Loader

Load and manage plugins.

#### Methods

##### `loadAll()`

Load all plugins from directory.

```typescript
await pluginLoader.loadAll(): Promise<Plugin[]>
```

##### `loadPlugin()`

Load single plugin.

```typescript
await pluginLoader.loadPlugin(
  pluginId: string
): Promise<Plugin>
```

##### `reloadPlugin()`

Reload plugin.

```typescript
await pluginLoader.reloadPlugin(
  pluginId: string
): Promise<Plugin>
```

---

## IPC Protocol

Electron IPC communication channels.

### Channels

#### Agent

- `agent:start` - Start agent
- `agent:stop` - Stop agent
- `agent:status` - Get status

#### Chat

- `chat:send` - Send message
- `chat:stream` - Stream response
- `chat:stop` - Stop generation
- `chat:clear` - Clear history

#### Session

- `session:new` - Create session
- `session:list` - List sessions
- `session:get` - Get session
- `session:delete` - Delete session

#### Settings

- `settings:get` - Get settings
- `settings:update` - Update settings
- `settings:reset` - Reset to defaults

#### Events

- `event:message` - New message
- `event:stream-chunk` - Stream chunk
- `event:stream-end` - Stream ended
- `event:error` - Error occurred

---

## Error Handling

All async methods may throw errors. Always use try-catch:

```typescript
try {
  const response = await agent.chat('Hello');
  console.log(response);
} catch (error) {
  console.error('Error:', error.message);
}
```

---

## Type Definitions

See [src/types/index.ts](../src/types/index.ts) for complete type definitions.
