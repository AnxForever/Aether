# Aether - Project Context for Claude Code

> Multi-AI orchestration platform with enhanced security and extensibility

## Project Overview

**Aether** is a desktop AI assistant built with Electron, designed to orchestrate multiple AI providers (7 providers: Claude, OpenAI, Gemini, MiniMax, Moonshot, GLM, DeepSeek) into a unified workflow. This project is a complete reimplementation and enhancement of Cola Desktop v1.0.10, built through reverse engineering with significant improvements in security, modularity, and capabilities.

### Core Identity
- **Type**: Desktop application (Electron-based)
- **Target Users**: Developers and power users who need local AI orchestration
- **Primary Use Cases**: 
  - Multi-AI provider management and switching
  - Code generation and debugging (Coding Mode)
  - General conversation and Q&A (Chat Mode)
  - Tool execution and workflow automation

### Key Features
- 7 AI provider integrations with unified interface
- 105+ built-in skills across 8 categories (Gmail, Google Sheets, GitHub, Office, etc.)
- Dual mode system: Chat Mode (creative) vs Coding Mode (precise)
- Self-learning system with feedback loop and skill creator
- Scheduled tasks with Croner-based automation
- Hot-reload plugin system
- Enhanced security: AES-256-GCM encryption + Scrypt key derivation

---

## Architecture Overview

```
aether/
├── src/
│   ├── core/           # Orchestrator, Pipeline, Cycle Manager
│   ├── connectors/     # AI provider integrations (7 providers)
│   ├── storage/        # SQLite (chat history, config, models)
│   ├── skills/         # 105+ built-in tools
│   ├── plugins/        # Plugin system (loader, registry, marketplace)
│   ├── ipc/            # Electron IPC protocol (20+ channels)
│   ├── server/         # HTTP/WebSocket/SSE server
│   ├── modes/          # Chat mode & Coding mode
│   ├── learning/       # Self-improvement & skill creator
│   ├── scheduler/      # Task scheduling (cron expressions)
│   ├── watcher/        # @parcel/watcher file monitoring
│   └── utils/          # Crypto, logger, validator, formatter
├── docs/               # Architecture & API documentation
└── examples/           # Usage examples
```

### Core Components

1. **Orchestrator** (`src/core/orchestrator.ts`)
   - Central coordination engine
   - Manages processing cycles
   - Coordinates pipeline execution

2. **Pipeline** (`src/core/pipeline.ts`)
   - Multi-stage processing: context → inference → tool-execution → response
   - Handles AI provider routing
   - **Note**: Tool execution stage is marked TODO (not yet implemented)

3. **Connectors** (`src/connectors/`)
   - 7 AI providers with unified interface
   - Handles streaming, function calling, vision capabilities

4. **Storage Layer** (`src/storage/`)
   - SQLite with WAL mode for chat history
   - Encrypted config management
   - Dynamic model registry with pricing

---

## Development Guidelines

### Code Standards

#### TypeScript Configuration
- Strict mode enabled
- Target: ES2022, CommonJS modules
- Path aliases: `@/*`, `@types/*`, `@core/*`, etc.

#### Code Style
- **NO console.log in production code** - Use `createLogger()` from `src/utils/logger.ts`
- **Minimize `any` type usage** - Current count: 533 (needs reduction)
- **Follow immutability patterns** - Use spread operators for updates
- **Error handling** - Always use try-catch with proper error types

#### Testing
- Framework: Vitest
- Target: 80%+ test coverage (currently insufficient)
- Run: `npm test` or `npm run test:coverage`

### Git Workflow

#### Author Identity (MANDATORY)
```bash
git config user.name "AnxForever"
git config user.email "130662349+AnxForever@users.noreply.github.com"
```

**Never** allow any other name or email in commits. This is enforced.

#### Commit Message Format
```
<type>: <description>

<optional body>
```
Types: feat, fix, refactor, docs, test, chore, perf, ci

### Build & Development

```bash
# Development with watch mode
npm run dev

# Build TypeScript
npm run build

# Type checking
npm run typecheck

# Linting (ESLint 9.x flat config)
npm run lint

# Format code
npm run format

# Start Electron app
npm run start
```

---

## Known Issues & TODOs

### P0 - Critical
- ✅ ~~Git repository not initialized~~ (Fixed)
- ✅ ~~Missing .env file~~ (Fixed)
- ✅ ~~ESLint config outdated~~ (Fixed: migrated to flat config)

### P1 - High Priority
- ⚠️ **Tool execution not implemented** (`src/core/pipeline.ts:102`)
- ⚠️ **Security gap**: ColaLink missing Signal Protocol encryption (`src/colalink/message-manager.ts`)
- ⚠️ **Voice features incomplete**: VAD, ASR, TTS are stub implementations (`src/voice/`)
- ⚠️ **CLI server APIs incomplete**: Session/config endpoints marked TODO (`src/cli/local-server.ts`)

### P2 - Medium Priority
- 533 uses of `any` type (should be reduced)
- Test coverage < 80% (only 5 test files for 204 source files)
- Dependencies outdated (see `npm outdated`)

---

## Environment Variables

Required environment variables (see `.env.example`):

### AI Provider Keys
- `ANTHROPIC_API_KEY` - Claude models
- `OPENAI_API_KEY` - GPT models
- `GOOGLE_API_KEY` - Gemini models
- `MINIMAX_API_KEY`, `MOONSHOT_API_KEY`, `GLM_API_KEY`, `DEEPSEEK_API_KEY`

### Services
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - OAuth for Gmail/Sheets/Docs
- `GITHUB_TOKEN` - GitHub integration

### Security
- `ENCRYPTION_PASSWORD` - For AES-256-GCM encryption

### Server
- `HTTP_PORT` (default: 3000)
- `WS_PORT` (default: 3001)

---

## Common Tasks

### Adding a New AI Provider
1. Create connector in `src/connectors/<provider>.ts`
2. Implement `AIConnector` interface
3. Register in `src/connectors/index.ts`
4. Add model configs to `src/storage/model-registry.ts`
5. Update `.env.example` with API key

### Adding a New Skill
1. Create skill file in `src/skills/<category>/<skill-name>.ts`
2. Implement `Skill` interface
3. Register in skill category index
4. Add tests in `src/skills/__tests__/`

### Debugging
- Check logs: `src/utils/logger.ts` creates timestamped logs
- Enable dev tools: Set `NODE_ENV=development`
- Use IPC debugging: Check `src/ipc/protocol.ts` for channel names

---

## Dependencies Notes

### Core Dependencies
- `better-sqlite3` - SQLite database (use default import, not `* as`)
- `@parcel/watcher` - File watching (native module)
- `electron` - Desktop app framework
- `zod` - Schema validation
- `croner` - Cron scheduling

### AI SDKs
- `@anthropic-ai/sdk` - Claude API
- `openai` - OpenAI/GPT API
- `@google/generative-ai` - Gemini API

---

## Conventions

### Naming
- Files: kebab-case (`chat-history.ts`)
- Classes: PascalCase (`ChatHistory`)
- Functions/variables: camelCase (`createSession`)
- Constants: UPPER_SNAKE_CASE (`DEFAULT_MODEL`)

### Module Exports
- Prefer named exports over default exports
- Group related types/interfaces in `src/types/`
- Use barrel exports (`index.ts`) for public APIs

### Error Handling
- Use custom error classes when appropriate
- Always log errors with context
- Throw errors for programming mistakes, return error objects for expected failures

---

## Resources

- **Architecture**: `docs/ARCHITECTURE.md`
- **Quick Start**: `docs/QUICK-START.md`
- **API Reference**: `docs/API.md`
- **Skills Guide**: `docs/SKILLS.md`
- **GitHub**: https://github.com/AnxForever/Aether

---

**Maintainer**: AnxForever <130662349+AnxForever@users.noreply.github.com>
**License**: MIT
