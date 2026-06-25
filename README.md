<div align="center">

<!-- Logo placeholder - add your logo here -->
<img src="docs/images/aether-logo.svg" alt="Aether Logo" width="180" onerror="this.style.display='none'"/>

<h1>Aether</h1>

**Spotify for AI — Switch between 7 AI models instantly**

*Your conversations, your rules. All data stays local, encrypted, and under your control.*

<p>
  <a href="https://github.com/AnxForever/Aether/stargazers"><img src="https://img.shields.io/github/stars/AnxForever/Aether?style=social" alt="GitHub stars"></a>
  <a href="https://github.com/AnxForever/Aether/releases"><img src="https://img.shields.io/github/downloads/AnxForever/Aether/total?color=success" alt="Downloads"></a>
  <a href="https://github.com/AnxForever/Aether/network/members"><img src="https://img.shields.io/github/forks/AnxForever/Aether?style=social" alt="Forks"></a>
</p>

<p>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript" alt="TypeScript"></a>
  <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/Electron-Latest-47848F?logo=electron" alt="Electron"></a>
  <img src="https://img.shields.io/github/actions/workflow/status/AnxForever/Aether/ci.yml?branch=main&label=CI" alt="CI Status">
  <img src="https://img.shields.io/github/v/release/AnxForever/Aether?include_prereleases&label=version" alt="Version">
</p>

<p>
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-why-aether">Why Aether</a> •
  <a href="#-features">Features</a> •
  <a href="docs/ARCHITECTURE.md">Architecture</a> •
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

</div>

---

## 🎯 Why Aether?

**Like Spotify lets you switch between songs, Aether lets you switch between AI brains.**

Pick the best AI for each task:
- 📝 **Claude** for writing and analysis
- 💻 **GPT-4** for code generation
- 📄 **Gemini** for long documents (1M context)
- 🇨🇳 **GLM/MiniMax** for Chinese content

---

## 🆕 New in v2.0 (2026-06-25)

### 🧠 Self-Learning AI
Your AI learns from every interaction:
- **Automatic improvement**: AI tracks performance and suggests optimizations
- **User feedback**: Rate responses (1-5 stars), AI adapts to your preferences
- **Smart statistics**: See success rates, response times, and satisfaction trends
- **Learning reports**: Comprehensive analytics on AI performance

### 🛠️ Dynamic Tool Creation
Say what you need, AI creates it:
- **"I need a tool to batch rename files"** → Tool created instantly
- **7-language intent detection**: Works in Chinese and English
- **Auto-registration**: New tools immediately available
- **Safe execution**: Generated tools are validated before use

### ⚙️ Workflow Automation
Complex tasks, automated:
- **4 built-in templates**: Code deployment, data processing, batch operations, notifications
- **Cron scheduling**: Run workflows on a schedule
- **Smart control**: Conditions, loops, parallel execution, auto-retry
- **AI-powered**: AI can trigger workflows intelligently

### 🏢 Enterprise Ready
Production-grade infrastructure:
- **API Gateway**: JWT auth + rate limiting + unified REST API
- **Real-time collaboration**: Multi-user WebSocket sessions (like Google Docs)
- **Plugin ecosystem**: Load community extensions with security validation
- **40+ new APIs**: Complete programmatic control

---

## 🎯 Why Aether?

### Three Core Principles

1. 🏠 **Local-first** — Your conversations stay on your machine, encrypted, never sent to our servers
2. 🔌 **No vendor lock-in** — Switch between 7 AI providers with one click, compare responses side-by-side
3. 🛠️ **Batteries included** — 105+ tools ready to use: Gmail, GitHub, Google Workspace, Office automation

### Perfect For

✅ Developers who need AI for code + docs + communication  
✅ Power users tired of ChatGPT rate limits  
✅ Teams who want full control over their AI stack  
✅ Privacy-conscious users who don't trust cloud storage  

❌ Casual users who only use ChatGPT web version occasionally

---

## 🎬 Use Cases

<table>
<tr>
<td width="50%">

### 📊 Compare AI Responses
Ask the same question to Claude, GPT-4, and Gemini. Pick the best answer.

**Example**: "Explain quantum computing"
- Claude: Clear analogies
- GPT-4: Technical depth
- Gemini: Visual examples

</td>
<td width="50%">

### 🔄 Task-Specific Models
Use the right AI for each job.

**Code review** → GPT-4 (best at code)  
**Blog post** → Claude (best at writing)  
**Chinese docs** → GLM (native Chinese)  
**Long PDFs** → Gemini (1M context)

</td>
</tr>
<tr>
<td>

### 🔒 Privacy-First Workflow
All conversations stored locally, encrypted with AES-256-GCM.

- No cloud dependency
- No telemetry tracking
- Export anytime (Markdown/JSON)
- Full audit trail

</td>
<td>

### 🛠️ Automate Everything
105+ built-in tools:

- Send emails via Gmail
- Update Google Sheets
- Create GitHub issues
- Convert HEIC to JPEG
- Search across conversations

</td>
</tr>
</table>

---

## 📸 Demo

<!-- Add your demo GIF here -->
<div align="center">
  <img src="docs/images/demo.gif" alt="Aether Demo" width="90%" onerror="this.style.display='none'"/>
  <p><i>Switch between 7 AI providers without breaking your workflow</i></p>
</div>

<details>
<summary><b>📷 More screenshots</b></summary>

<table>
  <tr>
    <td align="center">
      <img src="docs/images/chat-mode.png" alt="Chat Mode" width="300" onerror="this.style.display='none'"/>
      <br/><b>Chat Mode</b>
    </td>
    <td align="center">
      <img src="docs/images/coding-mode.png" alt="Coding Mode" width="300" onerror="this.style.display='none'"/>
      <br/><b>Coding Mode</b>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="docs/images/skills.png" alt="Skills" width="300" onerror="this.style.display='none'"/>
      <br/><b>105+ Tools</b>
    </td>
    <td align="center">
      <img src="docs/images/monitoring.png" alt="Monitoring" width="300" onerror="this.style.display='none'"/>
      <br/><b>Observability</b>
    </td>
  </tr>
</table>

</details>

---

## 🚀 Quick Start

### Download (Recommended)

1. **[Download Aether](https://github.com/AnxForever/Aether/releases/latest)** for your OS (Windows, macOS, Linux)
2. Launch the app
3. Add your API key (Claude/OpenAI/Gemini)
4. Start chatting 🎉

### Build from Source

Requires: Node.js 20+

```bash
git clone https://github.com/AnxForever/Aether.git
cd Aether
npm install
npm run build
npm start
```

📚 See [Quick Start Guide](docs/QUICK-START.md) for detailed setup.

---

## ✨ Features

### 🤖 7 AI Providers, One Interface

| Provider | Models | Special Features |
|----------|--------|------------------|
| **Claude** | Opus, Sonnet, Haiku | 200K context, vision |
| **OpenAI** | GPT-4, GPT-4 Turbo | Function calling, DALL·E |
| **Gemini** | Pro, Flash | 1M context, multimodal |
| **MiniMax** | abab6.5 | Chinese-optimized |
| **Moonshot** | v1 | 128K context |
| **GLM** | GLM-4 | Chinese NLP |
| **DeepSeek** | V2 | Cost-effective |

### 🛠️ 105+ Built-in Tools

<table>
  <tr>
    <td><b>📧 Gmail</b><br/>13 tools: Read, send, search, labels</td>
    <td><b>📊 Google Sheets</b><br/>5 tools: Read, write, formulas</td>
  </tr>
  <tr>
    <td><b>💻 GitHub</b><br/>6 tools: Repos, issues, PRs</td>
    <td><b>📄 Office</b><br/>8 tools: PDF, Excel, PowerPoint</td>
  </tr>
  <tr>
    <td><b>📅 Calendar</b><br/>5 tools: Events, scheduling</td>
    <td><b>📝 Google Docs</b><br/>5 tools: Create, edit, format</td>
  </tr>
</table>

**[→ See full tool list](FEATURES.md)**

### 🔒 Privacy & Security

- **AES-256-GCM** encryption for sensitive data
- **Scrypt** key derivation (no hardcoded keys)
- **Local storage** — conversations never leave your machine
- **Zero telemetry** — we don't track you
- **Input validation** with Zod schemas

### 📊 Production-Ready Monitoring

- **OpenTelemetry** distributed tracing
- **Sentry** error tracking & performance monitoring
- **Real-time metrics** dashboard
- **Slack integration** for team collaboration

### 🎨 More Features

- **Dual Modes**: Chat (creative) vs Coding (precise)
- **Hot Reload**: Auto-reload plugins without restart
- **i18n**: English + 简体中文
- **Image Processing**: HEIC, JPEG, PNG, WebP conversion
- **Scheduled Tasks**: Cron-based automation
- **Self-Learning**: Improve from user feedback

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         Electron Desktop App            │
├─────────────────────────────────────────┤
│  Chat Mode │ Coding Mode │ Skills      │
├─────────────────────────────────────────┤
│       Core Orchestration Engine         │
│  Pipeline → AI Provider → Tool Execute  │
├─────────────────────────────────────────┤
│    Claude │ GPT-4 │ Gemini │ ...       │
├─────────────────────────────────────────┤
│  Storage │ Plugins │ Monitoring │ i18n │
└─────────────────────────────────────────┘
```

**Key Components**:
- **Orchestrator**: Manages conversation cycles
- **Pipeline**: Context → AI → Tools → Response
- **Connectors**: 7 AI providers with streaming
- **Skills**: 105+ tools across 8 categories
- **Storage**: SQLite with encryption

---

## 📚 Documentation

- **[Quick Start Guide](docs/QUICK-START.md)** — Get started in 5 minutes
- **[Architecture Overview](docs/ARCHITECTURE.md)** — System design deep dive
- **[API Reference](docs/API.md)** — Complete API documentation

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Ways to contribute**:
- 🐛 [Report bugs](https://github.com/AnxForever/Aether/issues/new?template=bug_report.md)
- ✨ [Request features](https://github.com/AnxForever/Aether/issues/new?template=feature_request.md)
- 🔧 [Submit PRs](https://github.com/AnxForever/Aether/pulls)
- 📖 Improve documentation

---

## 📊 Project Stats

![Star History Chart](https://api.star-history.com/svg?repos=AnxForever/Aether&type=Date)

- **19,302** lines of TypeScript
- **7** AI providers integrated
- **105+** built-in tools
- **100%** type safety (strict mode)

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Made with ❤️ by [AnxForever](https://github.com/AnxForever)**

*Star this repo if Aether helps you!* ⭐

</div>
