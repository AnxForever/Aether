# Aether - Architecture

## System Overview

Aether is a complete reimplementation of AI agent architecture, built from ground-up analysis of Cola with significant improvements in security, modularity, and capabilities.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Aether                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐      ┌──────────────┐                   │
│  │  User Input  │─────▶│ Orchestrator │                   │
│  └──────────────┘      └──────┬───────┘                   │
│                               │                            │
│                               ▼                            │
│                        ┌──────────────┐                   │
│                        │   Pipeline   │                   │
│                        └──────┬───────┘                   │
│                               │                            │
│              ┌────────────────┼────────────────┐          │
│              ▼                ▼                ▼          │
│       ┌──────────┐    ┌──────────┐    ┌──────────┐      │
│       │ Context  │    │Inference │    │ Response │      │
│       │  Stage   │    │  Stage   │    │  Stage   │      │
│       └──────────┘    └────┬─────┘    └──────────┘      │
│                            │                             │
│                            ▼                             │
│                   ┌─────────────────┐                   │
│                   │ Connector Layer │                   │
│                   └────────┬────────┘                   │
│                            │                             │
│      ┌────────┬────────┬───┴───┬────────┬────────┐     │
│      ▼        ▼        ▼       ▼        ▼        ▼     │
│   Claude   OpenAI  Gemini  MiniMax Moonshot  GLM       │
│                    DeepSeek                             │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Orchestrator
- **Role**: Central coordination engine
- **Responsibilities**:
  - Manage processing cycles
  - Coordinate pipeline execution
  - Handle concurrent requests
  - Emit lifecycle events
- **Files**: `src/core/orchestrator.ts`

### 2. Pipeline
- **Role**: Multi-stage processing flow
- **Stages**:
  1. Context preparation
  2. AI inference
  3. Tool execution
  4. Response formatting
- **Files**: `src/core/pipeline.ts`

### 3. Connectors
- **Role**: Unified AI provider interface
- **Providers**: 7 total
  - Claude (Anthropic)
  - OpenAI (GPT-4)
  - Google Gemini
  - MiniMax
  - Moonshot AI
  - Zhipu GLM
  - DeepSeek
- **Files**: `src/connectors/`

### 4. Storage Layer
- **Components**:
  - Chat History (SQLite + WAL)
  - Config Manager (AES-256-GCM + Scrypt)
  - Model Registry (Dynamic configuration)
  - Device Identity (UUID management)
- **Files**: `src/storage/`

### 5. Skills System
- **Built-in Skills**:
  - Gmail (read, send, manage)
  - Google Sheets (read, write, format)
  - Google Docs (read, write)
  - Google Calendar (events)
  - GitHub CLI (repositories)
  - Office (PDF, Excel, Word, PowerPoint)
- **Files**: `src/skills/`

### 6. System Components
- **Scheduler**: Croner-based task scheduling
- **Gateway**: API gateway authentication
- **Updater**: Electron auto-update
- **Analytics**: PostHog-style user tracking
- **Telemetry**: OpenTelemetry monitoring
- **Watcher**: File monitoring & hot reload
- **Render**: GPU acceleration optimization
- **Files**: `src/scheduler/`, `src/gateway/`, etc.

## Data Flow

### Standard Request Flow

```
1. User Input
   ↓
2. Orchestrator.processInput()
   ↓
3. CycleManager.createCycle()
   ↓
4. Pipeline.execute()
   ├─ contextStage()
   ├─ inferenceStage()
   ├─ toolExecutionStage()
   └─ responseStage()
   ↓
5. Connector.getResponse()
   ↓
6. Return Message
```

### Streaming Flow

```
1. User Input
   ↓
2. Orchestrator.streamResponse()
   ↓
3. Connector.streamResponse()
   ↓
4. Yield StreamChunk*
   ↓
5. Client receives chunks
```

## Security Architecture

### Encryption
- **Algorithm**: AES-256-GCM
- **Key Derivation**: Scrypt (32 bytes)
- **Format**: `nexus.enc.v1:<iv>:<authTag>:<encrypted>`
- **Salt**: `nexus-salt` (static, for deterministic keys)

### Authentication
- **Gateway Token**: SHA-256 based (64 bytes)
- **Device ID**: UUID v4
- **API Keys**: Encrypted at rest

## Performance Characteristics

### Benchmarks (Expected)
- **Startup Time**: ~2-3s (cold start)
- **Memory Usage**: ~150MB (main process)
- **IPC Latency**: <10ms (local)
- **SQLite WAL**: High concurrency support

### Optimizations
- Worker thread isolation for CPU-intensive tasks
- WAL mode for concurrent database access
- Connection pooling for AI providers
- Streaming responses to reduce perceived latency

## Extension Points

### Plugin System
- Dynamic plugin loading
- Isolated execution context
- Plugin marketplace integration
- Versioned APIs

### Custom Connectors
```typescript
class CustomConnector implements Connector {
  async initialize(config: ConnectorConfig) { }
  async *streamResponse(request: ConnectorRequest) { }
  async getResponse(request: ConnectorRequest) { }
  async listModels() { }
  async isAvailable() { }
}
```

### Custom Skills
```typescript
const customSkill: Skill = {
  id: 'my-skill',
  name: 'My Skill',
  description: 'Custom skill',
  tools: [{
    name: 'my-tool',
    description: 'Does something',
    parameters: [],
    handler: async (params) => ({ success: true })
  }]
};
```

## Comparison with Cola

| Feature | Cola | Aether |
|---------|------|-------|
| **AI Providers** | 3 | **7** |
| **Security** | Hardcoded key | **Scrypt KDF** |
| **Type Safety** | Partial | **Complete** |
| **Code Clarity** | Minified | **Readable** |
| **Architecture** | Monolithic | **Modular** |
| **Documentation** | None | **Complete** |
| **Test Coverage** | Unknown | **High** |

## Development Guidelines

### Code Organization
- One responsibility per file
- Clear module boundaries
- Export through index files
- Type definitions in `/types`

### Error Handling
```typescript
try {
  await riskyOperation();
} catch (error) {
  console.error('[Component] Operation failed:', error);
  throw new AetherError('Descriptive message', error);
}
```

### Logging
```typescript
console.info('[Component] Info message');
console.warn('[Component] Warning message');
console.error('[Component] Error message');
console.debug('[Component] Debug message');
```

## Future Roadmap

- [ ] Multi-modal support (images, audio)
- [ ] Distributed tracing integration
- [ ] Advanced plugin sandboxing
- [ ] Real-time collaboration features
- [ ] Mobile platform support

---

**Last Updated**: 2026-06-24
**Version**: 1.0.0
