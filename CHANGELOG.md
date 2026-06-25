# Changelog

All notable changes to Aether will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
