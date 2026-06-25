<div align="center">

<!-- Logo placeholder - add your logo here -->
<img src="docs/images/aether-logo.svg" alt="Aether Logo" width="180" onerror="this.style.display='none'"/>

<h1>Aether</h1>

**Local-first Multi-AI Orchestration Desktop App**

*Switch between 7 AI providers instantly. No cloud lock-in. 105+ tools built-in.*

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
  <a href="#-features">Features</a> •
  <a href="docs/ARCHITECTURE.md">Architecture</a> •
  <a href="#-documentation">Docs</a> •
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

</div>

---

## 🎯 Why Aether?

**Tired of vendor lock-in?** Aether gives you full control over your AI workflow.

- 🏠 **Local-first** — Your conversations stay on your machine, not someone else's cloud
- 🔌 **Multi-provider freedom** — Switch between Claude, GPT-4, Gemini, and 4 more with one click
- 🛠️ **Batteries included** — 105+ tools for Gmail, GitHub, Google Workspace, Office automation
- 🖥️ **Desktop native** — Fast, responsive Electron app (not another web UI)
- 🔒 **Enterprise security** — AES-256-GCM encryption, zero telemetry

**Perfect for**: Developers, power users, and teams who want full control over their AI stack.

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
