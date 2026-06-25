# Changelog

All notable changes to Aether will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-06-25

### Added

#### 🧠 Self-Learning System
- **Automatic performance tracking**: Records cycle metrics, response times, and success rates
- **User feedback collection**: 1-5 star rating system with optional comments
- **Skill usage statistics**: Tracks success rate, response time, and error patterns for each skill
- **Improvement suggestions**: Automatically generates suggestions when detecting low ratings
- **Learning reports**: Comprehensive performance reports with time-range filtering
- **Dual-mode learning**: Persistent (SQLite) + in-memory (FeedbackLoop) tracking
- **New APIs**: `recordFeedback()`, `getLearningStats()`, `generateLearningReport()`
- **REST endpoints**: 6 learning API endpoints (`/api/learning/*`)

#### 🛠️ Skill Creator (Dynamic Tool Generation)
- **Intent detection**: 7 patterns for detecting tool creation requests (Chinese + English)
- **AI-powered generation**: Automatic skill template generation from natural language
- **Auto-registration**: Generated skills automatically register to SkillRegistry
- **Pipeline integration**: New `skill-creation-detection` stage in processing pipeline
- **New APIs**: `createSkill(description)`, `listDynamicSkills()`, `getSkillCreatorStats()`
- **Safety-first design**: Generated tools are validated but execution is sandboxed

#### ⚙️ Workflow Engine (Automation)
- **4 built-in templates**: Code deployment, data processing, batch operations, notifications
- **Croner scheduling**: Full cron expression support for scheduled workflows
- **Advanced control flow**: Conditional branching, loops, parallel execution, retry logic
- **Error handling**: Automatic retry with exponential backoff, fallback steps
- **SQLite persistence**: Complete execution history and status tracking
- **AI integration**: 6 workflow tools exposed to AI for intelligent automation
- **REST API**: 10 workflow endpoints (`/api/workflow/*`)
- **New APIs**: `executeWorkflow()`, `listWorkflows()`, `getWorkflowStatus()`, `cancelWorkflow()`

#### 🏢 API Gateway (Enterprise)
- **Unified Express server**: Single entry point for all API services
- **JWT authentication**: Token-based auth with secure secret validation (≥32 chars)
- **Token bucket rate limiting**: Differentiated rates (1x auth, 10x unauth)
- **CORS protection**: Whitelist-based origin validation
- **Request timeout**: 30s timeout to prevent slow attacks
- **Health & metrics**: `/health` and `/metrics` endpoints for monitoring
- **API routes**: Chat, Skills, Learning (7 endpoints), Workflow (10 endpoints)
- **Comprehensive demo**: 7-scenario client demo with all features

#### 👥 Collaboration Server (Real-time)
- **WebSocket server**: Real-time communication on port 8081
- **Multi-user sessions**: Session management with SQLite persistence
- **Real-time sync**: Cursor position, edit operations, comments
- **Edit history**: Complete operation tracking with timestamps
- **Comment system**: Threaded comments with resolve status
- **Security**: Message size limits (1MB), parse error protection (5 strikes)
- **IPC integration**: 3 Electron IPC channels for desktop app
- **Browser client**: Complete HTML/JS client with beautiful UI (576 lines)

#### 🔌 Plugin System (Ecosystem)
- **Security validator**: 8 dangerous pattern detections (eval, child_process, injection)
- **Permission system**: 9 granular permissions (filesystem, network, process, etc.)
- **Lifecycle management**: Load, unload, reload, enable, disable
- **Marketplace integration**: Search, install, update, uninstall plugins
- **Validation on load**: Automatic security checks before plugin activation
- **13 management APIs**: Complete plugin control via NexusAgent
- **Development guide**: 16KB comprehensive documentation (11 chapters)
- **Example plugin**: 4 working tools with 22 unit tests

### Changed

- **Pipeline**: Added `skill-creation-detection` stage (now 5 stages total)
- **Orchestrator**: Integrated LearningIntegration and SkillCreatorIntegration
- **NexusAgent**: Extended with 40+ new management methods
- **Agent initialization**: Now loads plugins automatically on startup
- **Config interface**: Added `enableLearning`, `pluginsDir`, `marketplaceUrl` options

### Documentation

- **NEW**: `docs/PLUGIN-DEVELOPMENT.md` - Complete plugin development guide
- **NEW**: `docs/GATEWAY.md` - API Gateway usage and security guide
- **NEW**: `docs/PHASE4-PLAN.md` - Testing and documentation roadmap
- **UPDATED**: `ARCHITECTURE.md` - Added 6 new system descriptions
- **UPDATED**: `API.md` - Documented 40+ new APIs
- **UPDATED**: `README.md` - Added v2.0 features section

### Testing

- **6 integration test suites**: Self-Learning, Skill Creator, Workflow, Gateway, Collaboration, Plugins
- **3 E2E test suites**: Complete user flows for key features
- **Example plugins**: Fully tested example plugin (22 tests)
- **Total test coverage**: Expanded from 5 to 14+ test files

### Code Statistics

- **New files**: ~30 files
- **New code**: ~7,500+ lines
- **New APIs**: ~40+ methods
- **Examples**: ~1,500+ lines
- **Documentation**: ~100+ pages

## [2.1.0] - 2026-06-25

### Added — 10 New Subsystem Activations

#### 🔗 ColaLink — Cross-Device Messaging
- **End-to-end encrypted messaging**: Signal Protocol-based encryption
- **Contact management**: Add, block, unblock contacts with status tracking
- **Conversation history**: Get, search, and paginate message history
- **WeChat bridge**: Optional WeChat plugin for message relay
- **ColaLink events**: Real-time events for message and contact changes
- **New APIs**: `sendColaLinkMessage()`, `listColaLinkContacts()`, `addColaLinkContact()`, `getColaLinkUnreadCount()` (9 methods)

#### 📔 Awareness System — AI Self-Reflection
- **Daily diary generation**: AI automatically generates daily reflections at 9 PM
- **Conversation drafts**: Extract and save conversation highlights
- **Daily episodes**: Summarize each day's conversations
- **Imprint management**: List and query all diaries/drafts/episodes
- **Color scheme & cover images**: Auto-generate visual covers for reflections
- **New APIs**: `generateAwarenessDiary()`, `createAwarenessDraft()`, `generateAwarenessEpisode()`, `listAwarenessImprints()`

#### 🔍 Semantic Search — Vector-Based Search
- **Embedding-based indexing**: 384-dim vector embeddings for content
- **Full-text search**: FTS5-powered text search
- **Fuzzy & regex search**: Advanced search modes
- **Search history & suggestions**: Auto-suggest based on history
- **Integrated in main.ts**: Direct IPC channels for desktop search
- **New APIs**: `searchIndex()`, `searchSemantic()`, `getSearchHistory()`, `removeFromSearchIndex()`

#### 🎯 Recommendation Engine — Intelligent Suggestions
- **6 recommendation types**: Skills, workflows, content, collaborators, code snippets, learning paths
- **Collaborative filtering**: User behavior-based recommendations
- **Content-based filtering**: Feature-based similarity matching
- **Interaction tracking**: View, use, like, dislike, skip actions
- **New APIs**: `recordRecommendationInteraction()`, `getRecommendations()`

#### 🪟 Mini Window — Floating Quick Access
- **280×42px ultra-compact window**: Always-on-top floating bar
- **6 positions**: top/bottom × left/center/right
- **Global shortcut**: Cmd/Ctrl+Shift+Space to toggle
- **Transparent & acrylic**: macOS vibrancy + Windows acrylic material
- **IPC channels**: `mini-window:show`, `mini-window:hide`, `mini-window:toggle`

#### 🌐 Browser Automation — Playwright Integration
- **Multi-browser support**: Chromium, Firefox, WebKit
- **Headless & headed modes**: Configurable for debugging
- **Page navigation & screenshots**: Full-page capture with format options
- **New APIs**: `launchBrowser()`, `browserNavigate()`, `browserScreenshot()`, `closeBrowser()`

#### 🎤 Voice Processing — Speech Pipeline
- **ASR (Sherpa)**: Speech recognition with language support
- **VAD (Silero)**: Voice activity detection for audio preprocessing
- **TTS (Marswave)**: Text-to-speech synthesis with voice options
- **Unified pipeline**: Single API for recognize → synthesize → detect
- **New APIs**: `recognizeVoice()`, `synthesizeVoice()`, `detectVoiceActivity()`

#### 📊 Visualization Engine — Chart Generation
- **7 chart types**: Line, bar, pie, scatter, area, radar, heatmap
- **Data transformation**: Pre-processing for visualization
- **Multi-format export**: SVG, PNG, JSON output
- **Theme support**: Light/dark with custom color palettes
- **New APIs**: `generateChart()`, `transformChartData()`

#### 🔬 Code Analysis Suite — Quality Metrics
- **AST-based analysis**: Deep code structure analysis
- **Complexity metrics**: Cyclomatic complexity, maintainability index
- **Dependency graph**: Full dependency visualization
- **Batch analysis**: Multi-file analysis support
- **New APIs**: `analyzeCodeFile()`, `analyzeCodeFiles()`, `getCodeComplexity()`, `getCodeDependencyInfo()`, `getCodeDependencyGraph()`

#### 🔌 MCP Server Manager — Model Context Protocol
- **Protocol integration**: MCP server lifecycle management
- **Tool discovery**: Auto-discover tools from running MCP servers
- **Agent tool conversion**: Convert MCP tools to native agent tools
- **Multi-server**: Manage multiple MCP servers simultaneously
- **New APIs**: `startMcpServer()`, `stopMcpServer()`, `discoverMcpTools()`, `getMcpAgentTools()`, `listMcpServers()`

### Changed
- **agent.ts**: Added 10 subsystem fields, 50+ new API methods, expanded config interface
- **main.ts**: Added MiniWindowManager initialization and IPC channels
- **awareness-system.ts**: Fixed circular dependency with `import type`

### Code Statistics
- **New APIs**: ~50 methods across 10 subsystems
- **Agent lines**: ~550 → ~900 lines
- **All subsystems TypeScript**: 0 compilation errors
- **Total activated codebase**: ~193,400 lines of previously dormant code now accessible

## [1.0.0] - 2024-06-24

### Added

#### Core Features
- Complete AI agent architecture with 7 providers (Claude, OpenAI, Gemini, MiniMax, Moonshot, GLM, DeepSeek)
- Event-driven orchestrator with dual pipeline system
- Cycle management with primary/background queues
- Type-safe TypeScript implementation (19,302 lines)

#### Storage Layer
- SQLite with WAL mode for chat history
- AES-256-GCM encryption with Scrypt key derivation
- Model registry with 7 AI provider support
- Device identity management

#### Skills System
- 105+ tools across 8 categories
- Gmail integration (13 tools)
- Google Sheets (5 tools)
- Google Docs (5 tools)
- Google Calendar (5 tools)
- GitHub CLI (6 tools)
- Office suite (8 tools)
- Creative tools (6 tools)
- System tools (17 tools)

#### Plugin System
- Plugin loader with hot reload support
- Plugin registry with hook system
- Plugin store client for marketplace
- Plugin installer with dependency management

#### IPC Protocol
- 20+ Electron IPC channels
- Main process handlers
- Renderer process API
- Type-safe protocol definitions

#### HTTP Server
- REST API with routing
- WebSocket real-time communication
- Server-Sent Events streaming
- CORS support

#### Speech System
- SenseVoice speech recognition
- Silero VAD voice activity detection
- TTS with Edge TTS/Piper/Coqui
- Audio processing utilities

#### Mode System
- Chat mode (creative, temperature 0.7)
- Coding mode (precise, temperature 0.2)
- Auto mode switching based on input analysis

#### Learning System
- Self-improvement with pattern recognition
- Feedback loop for continuous learning
- Dynamic skill creator

#### System Components
- Croner-based task scheduler
- File watcher with @parcel/watcher
- Auto-updater with electron-updater
- PostHog analytics integration
- OpenTelemetry distributed tracing
- Gateway authentication client
- Process manager
- Render optimizer

#### Utilities
- File operations with JSON support
- Crypto utilities (AES-256-GCM, Scrypt, UUID, tokens)
- Stream utilities (merge, map, filter, buffer)
- Formatters (bytes, duration, timestamps)
- Validators (email, URL, API keys, Zod schemas)
- Structured logger with multiple handlers

#### Development
- Complete TypeScript configuration
- Vitest test framework with coverage
- ESLint + Prettier code style
- Example usage files
- Comprehensive documentation

### Security
- No hardcoded encryption keys (vs Cola's security issue)
- Scrypt key derivation function
- Input sanitization and validation
- SQL injection protection
- Secure credential storage

### Documentation
- Architecture documentation
- Quick start guide
- API reference
- Skills development guide
- Complete README

### Fixed
- **CRITICAL**: Removed hardcoded "colacola" encryption key vulnerability from original Cola
- Enhanced security with proper key derivation

## [Unreleased]

### Planned
- Desktop UI renderer
- Voice command interface
- More AI provider integrations
- Advanced plugin marketplace
- Multi-language support expansion

---

## Version History

- **1.0.0** - Initial release with complete feature parity to Cola + enhancements
