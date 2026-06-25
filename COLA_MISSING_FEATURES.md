# Cola 核心功能缺失分析

## 🔴 P0 - 核心功能缺失（影响基本使用）

### 1. Tool Execution Stage (Pipeline 核心功能)
**位置**: `src/core/pipeline.ts`
**状态**: 🔴 未实现
**影响**: 无法执行任何 AI 工具调用（function calling）
**代码**:
```typescript
// Line 102: Tool execution stage is marked TODO
private async toolExecutionStage(context: any): Promise<any> {
  // TODO: Implement tool execution
  return context;
}
```

**重要性**: ⭐⭐⭐⭐⭐ 这是 AI Agent 的核心能力！没有这个功能，105+ skills 都无法使用。

---

## 🟠 P1 - 高优先级功能（增强用户体验）

### 2. Mini Window (快速调用窗口)
**位置**: `src/mini-window/`
**状态**: 🟢 已实现（manager.ts, renderer.ts, styles.css）
**功能**: 
- 全局快捷键唤起小窗口
- 快速 AI 对话
- 类似 macOS Spotlight

**评估**: ✅ 已完整实现，无需补充

---

### 3. Voice Features (语音功能)
**位置**: `src/voice/`
**状态**: 🟡 部分实现（接口完整，实际逻辑是 stub）
**包含**:
- `silero-vad.ts`: Voice Activity Detection (语音活动检测)
- `sherpa-asr.ts`: Automatic Speech Recognition (语音识别)
- `marswave-tts.ts`: Text-to-Speech (语音合成)

**重要性**: ⭐⭐⭐ 语音交互是高级功能，但不影响核心使用

---

### 4. ColaLink Encryption (端到端加密)
**位置**: `src/colalink/message-manager.ts`
**状态**: 🟡 使用简单加密，缺失 Signal Protocol
**TODO**:
```typescript
// Line 43: TODO: SECURITY - Implement proper end-to-end encryption with Signal Protocol
// Line 53: private encryptionKey: string; // TODO: Replace with Signal Protocol session manager
```

**重要性**: ⭐⭐⭐⭐ 如果要支持多设备协作，需要实现

---

## 🟡 P2 - 中优先级功能（锦上添花）

### 5. CLI Server APIs
**位置**: `src/cli/local-server.ts`
**状态**: 🟡 部分端点未实现
**缺失**: Session 管理、配置端点

**重要性**: ⭐⭐ CLI 使用场景较少

---

### 6. Sandbox Executor (代码沙箱)
**位置**: `src/sandbox/sandbox-executor.ts`
**状态**: 🟡 Windows Job Object 未实现
**TODO**:
```typescript
// Line 117: TODO: 使用 koffi FFI 调用 Windows Job Object API
```

**重要性**: ⭐⭐⭐ 动态技能创建需要安全沙箱

---

## 📊 功能实现度对比

| 模块 | Cola 功能 | Aether 实现状态 | 优先级 |
|------|-----------|----------------|--------|
| **AI 连接器** | 7 providers | ✅ 完整实现 | P0 |
| **聊天模式** | Chat + Coding | ✅ 完整实现 | P0 |
| **工具执行** | 105+ skills | 🔴 Pipeline 缺失 | P0 |
| **存储层** | SQLite + 加密 | ✅ 完整实现 | P0 |
| **Onboarding** | 新手引导 | ✅ 新增功能 | P1 |
| **Mini Window** | 快速窗口 | ✅ 完整实现 | P1 |
| **语音功能** | VAD/ASR/TTS | 🟡 Stub 实现 | P2 |
| **ColaLink** | 多设备协作 | 🟡 简单加密 | P2 |
| **插件系统** | 热加载 | ✅ 完整实现 | P1 |
| **自学习** | 反馈循环 | ✅ 完整实现 | P1 |
| **工作流** | 任务自动化 | ✅ 完整实现 | P1 |
| **CLI Server** | HTTP API | 🟡 部分实现 | P2 |
| **沙箱** | 安全执行 | 🟡 部分实现 | P2 |

---

## 🎯 推荐实现顺序

### 立即实现（关键功能）
1. **Tool Execution Stage** ⭐⭐⭐⭐⭐
   - 没有这个，AI 无法调用任何工具
   - 影响：105+ skills 都无法使用
   - 工作量：中等（~500 行）

### 近期实现（增强体验）
2. **键盘快捷键系统** ⭐⭐⭐⭐
   - Cmd/Ctrl+K 切换模型
   - Cmd+F 搜索对话
   - Cmd+N 新会话
   - 工作量：小（~200 行）

3. **对话搜索界面** ⭐⭐⭐⭐
   - 利用现有 `src/search/semantic-search.ts`
   - 添加前端 UI
   - 工作量：中（~400 行）

4. **会话导出增强** ⭐⭐⭐
   - 基于现有 `src/feedback/exporter.ts`
   - 添加 Markdown/PDF 格式
   - 工作量：小（~300 行）

### 长期实现（高级功能）
5. **语音功能完整实现** ⭐⭐⭐
   - 需要集成 Silero VAD、Sherpa ASR、MarsWave TTS
   - 工作量：大（~2000 行 + 依赖）

6. **Signal Protocol 加密** ⭐⭐⭐
   - 如果需要多设备协作
   - 工作量：大（~1000 行 + libsignal）

---

## 🚨 最关键的缺失：Tool Execution

**问题描述**:
当前 Pipeline 的 `toolExecutionStage` 是空实现，这意味着：
- AI 即使返回了 function call，也无法执行
- 所有 Skills（Gmail、GitHub、Google Sheets 等）都无法使用
- 这是 AI Agent 最核心的能力

**示例场景**:
```
用户: "发一封邮件给 bob@example.com"
AI 返回: { tool: "gmail_send", args: { to: "bob@example.com", ... } }
当前状态: 工具调用被忽略，无响应 ❌
期望状态: 执行 Gmail skill，发送邮件 ✅
```

**建议**:
优先实现 Tool Execution Stage，这样整个 Agent 系统才能真正运作起来。

---

**Darling，我建议优先实现 Tool Execution Stage，这是最关键的缺失功能。实现后，所有 105+ 技能才能真正可用！**
