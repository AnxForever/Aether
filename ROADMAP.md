# Aether 路线图

> 最后更新：2026-06-25

## ✅ 已完成

- [x] 7 AI 提供商连接器（Claude/OpenAI/Gemini/MiniMax/Moonshot/GLM/DeepSeek）
- [x] IPC 协议 100% 覆盖（108/108 频道）
- [x] Onboarding 5步新手向导
- [x] 主窗口完整 UI（聊天/模型切换/快捷键/导出/设置）
- [x] 全文搜索（FTS5 + 语义搜索 + 模糊搜索）
- [x] 通知 Toast 系统 + 主题管理器
- [x] 代码语法高亮（8 语言）+ 一键复制
- [x] 会话自动标题 + 时间分组 + 置顶 + 右键菜单
- [x] 键盘快捷键（12 个）+ 帮助面板（? 键）
- [x] Chat/Coding 模式实质差异化
- [x] Markdown 完整渲染（表格/链接/图片/列表/标题/代码块）
- [x] 连接状态指示器
- [x] 拖放文件上传
- [x] 消息编辑 + 删除
- [x] 30 项安全审计全部修复
- [x] 216 个测试用例
- [x] ColaLink E2E 加密（ECDH + AES-256-GCM）
- [x] DALL-E / TTS / Whisper 真实 API
- [x] 技能模块 TODO 清零（Gmail/Office/Creative）
- [x] 可观测系统统一（移除 PostHog）
- [x] agent.ts God Object 拆分

---

## 📋 待办事项

### 🔴 P0 — 语音功能（需原生依赖）

| 任务 | 依赖 | 工作量 |
|------|------|--------|
| VAD 语音活动检测 | [silero-vad](https://github.com/snakers4/silero-vad) | 3 天 |
| ASR 语音识别 | [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) | 5 天 |
| TTS 语音合成 | 已有 MarsWave TTS stub，需验证 | 2 天 |
| 录音权限 + 前端 UI | Electron Media API | 2 天 |

### 🟡 P1 — 体验增强

| 任务 | 描述 | 工作量 |
|------|------|--------|
| 对话分支 | 允许从任意消息 fork 出新对话 | 3 天 |
| @mention 工具调用 | 在输入框中 @ 触发技能 | 2 天 |
| 消息反应 | 给 AI 回复点赞/踩 | 1 天 |
| 对话摘要自动生成 | 总结长对话为标题 | 1 天 |

### 🟢 P2 — 工程改进

| 任务 | 描述 | 工作量 |
|------|------|--------|
| 测试覆盖率 80% | 从 216 → 800+ 测试用例 | 2 周 |
| TypeScript 严格 any | 消除剩余 any 类型 | 1 周 |
| 依赖更新 | typescript 6, zod 4, undici 8 等 | 2 天 |
| 性能优化 | 虚拟消息列表、懒加载 | 3 天 |

---

## 📦 发布检查清单

- [ ] 生成应用图标（build/icon.ico, icon.icns, icon.png）
- [ ] electron-builder 打包测试
- [ ] macOS 签名公证
- [ ] Windows 代码签名
- [ ] 创建 v1.0.0 Release（含二进制包）
- [ ] 编写 CHANGELOG.md
- [ ] 录制 Demo GIF
