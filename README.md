# Aether

> Multi-AI orchestration platform with enhanced security and extensibility

## 🎯 Project Overview

Aether is a complete reimplementation and enhancement of AI agent architecture, built from ground-up reverse engineering of Cola with significant improvements:

### Key Improvements over Cola

- **7 AI Providers** (vs Cola's 3): Claude, OpenAI, Gemini, MiniMax, Moonshot, GLM, DeepSeek
- **Enhanced Security**: Scrypt key derivation instead of hardcoded encryption keys
- **Type Safety**: Complete TypeScript implementation with strict types
- **Modular Architecture**: Clean separation of concerns
- **Better Testing**: Comprehensive test coverage
- **Production Ready**: Full error handling, monitoring, and observability

## 🏗️ Architecture

```
aether/
├── src/
│   ├── core/           # Orchestrator, Pipeline, Cycle Manager
│   ├── connectors/     # AI provider integrations (7 providers)
│   ├── storage/        # SQLite, Config, Model Registry
│   ├── skills/         # 105+ built-in tools across 8 categories
│   ├── plugins/        # Plugin system (loader, registry, store, installer)
│   ├── ipc/            # Electron IPC protocol (20+ channels)
│   ├── server/         # HTTP/WebSocket/SSE server
│   ├── speech/         # SenseVoice, Silero VAD, TTS
│   ├── modes/          # Chat mode & Coding mode
│   ├── learning/       # Self-improvement & skill creator
│   ├── scheduler/      # Croner-based task scheduling
│   ├── gateway/        # API gateway client
│   ├── updater/        # Auto-update system
│   ├── analytics/      # PostHog user tracking
│   ├── telemetry/      # OpenTelemetry monitoring
│   ├── watcher/        # @parcel/watcher file monitoring
│   ├── system/         # Process manager, render optimizer
│   ├── utils/          # Crypto, logger, validator, formatter
│   └── types/          # Complete type system
├── docs/               # Architecture & API documentation
├── examples/           # Usage examples
└── scripts/            # CLI & deployment tools
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 20.0.0
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/AnxForever/Aether.git
cd Aether

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Build the project
npm run build

# Start Electron app
npm run start
```

### Development

```bash
# Development mode with auto-rebuild
npm run dev

# Run tests
npm test

# Run tests with coverage
npm test:coverage

# Lint code
npm run lint

# Format code
npm run format

# Type checking
npm run typecheck
```

## 📦 Core Features

### AI Providers
- Claude (Anthropic)
- OpenAI (GPT-4)
- Google Gemini
- MiniMax
- Moonshot AI
- Zhipu GLM
- DeepSeek

### Built-in Skills (105+ tools)
- **Gmail** (13 tools): Read, send, search, label management
- **Google Sheets** (5 tools): Read, write, format, formula
- **Google Docs** (5 tools): Create, read, update documents
- **Google Calendar** (5 tools): Event management, scheduling
- **GitHub** (6 tools): Repository, issues, PRs
- **Office** (8 tools): PDF, Excel, PowerPoint, Word processing
- **Creative** (6 tools): Mermaid, GraphViz, diagrams
- **System** (17 tools): File operations, process management

### System Features
- **Mode System**: Chat mode (creative) vs Coding mode (precise)
- **Learning System**: Self-improvement, feedback loop, skill creator
- **Scheduled Tasks**: Croner-based automation (cron expressions)
- **Plugin System**: Load, install, update third-party plugins
- **Hot Reload**: Auto-reload skills and plugins via @parcel/watcher
- **Auto Update**: Seamless version updates with electron-updater
- **HTTP Server**: REST API + WebSocket + SSE streaming
- **Speech**: SenseVoice recognition + Silero VAD + TTS
- **Analytics**: PostHog user behavior tracking
- **Telemetry**: OpenTelemetry distributed tracing
- **Gateway**: Centralized API authentication
- **IPC Protocol**: 20+ Electron channels for main↔renderer communication

## 🔒 Security

- **AES-256-GCM encryption** for sensitive data
- **Scrypt key derivation** (no hardcoded keys)
- **Secure credential storage**
- **Input validation** with Zod
- **SQL injection protection**

## 📊 Project Status

**✅ COMPLETED**: Full reimplementation from Cola reverse engineering

**Statistics**:
- **19,302 lines** of production TypeScript
- **100 files** across 15+ modules
- **7 AI providers** (vs Cola's 3)
- **105+ tools** across 8 skill categories
- **20+ IPC channels** for Electron communication
- **Complete type safety** with strict TypeScript
- **Full test coverage** with Vitest

**Implementation Progress**:
- ✅ Phase 1: Core types (542 lines)
- ✅ Phase 2: AI connectors (7 providers)
- ✅ Phase 3: Core engine (Orchestrator + Pipeline)
- ✅ Phase 4: Storage layer (SQLite + encryption)
- ✅ Phase 5: Skills system (105+ tools)
- ✅ Phase 6: System components (all missing features)
- ✅ Phase 7: Utils, IPC, Plugins, Server, Modes, Speech, Learning

## 📚 Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Quick Start Guide](docs/QUICK-START.md)
- [API Reference](docs/API.md)
- [Skills Development](docs/SKILLS.md)
- [Plugin System](docs/PLUGINS.md)

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines first.

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

Built through comprehensive reverse engineering and enhancement of the Cola AI agent architecture.

---

**Built with ❤️ by AnxForever**
