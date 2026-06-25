# Cola 对齐实施计划

> 基于深度逆向分析，完整对齐 Cola Desktop v1.0.10 架构
> 开始时间：2026-06-24
> 预计完成：16-23 周（4-6 人月）

---

## 一、当前状态

### 完成度评估
- **整体完成度**: 65%
- **代码规模**: 177 文件，36,597 行
- **核心差距**: 8 个 CRITICAL/HIGH 功能缺失

### 已完成模块 ✅
- ✅ 备份恢复系统（完整）
- ✅ 任务调度系统（完整）
- ✅ 智能推荐系统（完整）
- ✅ 插件系统（marketplace）
- ✅ 多 AI Provider（7 个，优于 Cola 的 3 个）
- ✅ 配置加密（Scrypt + AES-256-GCM，优于 Cola）
- ✅ 遥测分析（OpenTelemetry + PostHog）
- ✅ 代码质量（完整 TypeScript，清晰架构）

### 核心缺失模块 ❌
1. **pi-agent-core 框架** - CRITICAL
2. **SKILL.md 技能系统** - CRITICAL
3. **进程沙箱 (box3)** - CRITICAL
4. **API Gateway** - CRITICAL
5. **MCP 支持** - HIGH
6. **OAuth 系统** - HIGH
7. **ColaLink (IM)** - HIGH
8. **CLI 接口** - HIGH

---

## 二、实施路线图

### Phase 1: 核心架构对齐 (4-6 周) 🔴

#### 任务清单

**Task #135: 迁移到 pi-agent-core** (2-3 周)
- [ ] 安装依赖
  ```bash
  npm install @earendil-works/pi-agent-core@^0.74.0
  npm install @earendil-works/pi-ai@^0.74.0
  npm install @earendil-works/pi-coding-agent@^0.74.0
  ```
- [ ] 研究 pi-agent-core API
  - 阅读 `/mnt/d/cola/extracted/deps/node_modules/@earendil-works/pi-agent-core`
  - 分析 agent-loop.js 核心循环
  - 理解工具调用 + 权限控制机制
- [ ] 实现适配层
  - 保留现有 Orchestrator 作为兼容层
  - 创建 `src/agent/pi-adapter.ts`
  - 封装 pi-agent-core 到 Nexus 接口
- [ ] 迁移工具系统
  - 将现有 105 工具注册到 pi-agent-core
  - 实现工具权限映射
- [ ] 测试与验证
  - 端到端测试 agent 循环
  - 性能对比测试

**Task #136: 实现 SKILL.md 技能系统** (2-3 周)
- [ ] 设计技能格式
  ```markdown
  ---
  name: skill-name
  description: Brief description for matching
  triggers:
    - keyword1
    - keyword2
  parameters:
    - name: param1
      type: string
      required: true
  ---
  
  # Skill Documentation
  
  Detailed usage instructions...
  
  ## Examples
  ...
  ```
- [ ] 实现解析器
  - YAML frontmatter 解析（gray-matter）
  - Markdown body 解析（mdast-util-from-markdown）
  - 三级加载：metadata → body → resources
- [ ] 实现技能管理器
  - `src/skills/skill-loader.ts` - 动态加载
  - `src/skills/skill-registry.ts` - 注册表
  - `src/skills/skill-matcher.ts` - 触发匹配
- [ ] 迁移现有工具
  - 将 105 工具转换为 SKILL.md 格式
  - 创建 `/mnt/d/cola/nexus-agent/skills/` 目录
  - 编写迁移脚本
- [ ] 技能目录结构
  ```
  skills/
  ├── gws-gmail/
  │   ├── SKILL.md
  │   ├── handler.ts
  │   └── resources/
  ├── notion/
  │   ├── SKILL.md
  │   └── handler.ts
  └── ...
  ```

**Task #137: 实现进程沙箱** (1-2 周)
- [ ] Windows 实现
  - 使用 Node.js child_process
  - Job Object 隔离（via koffi FFI）
  - 资源限制（CPU/内存/IO）
- [ ] Linux 实现
  - cgroup v2 隔离
  - seccomp 系统调用过滤
  - namespace 隔离
- [ ] 统一接口
  - `src/sandbox/sandbox-executor.ts`
  - 工具调用拦截
  - 超时控制
- [ ] 安全策略
  - 路径白名单
  - 网络访问控制
  - 文件系统权限

---

### Phase 2: 关键功能补全 (6-8 周) 🟠

**Task #138: 集成 MCP SDK** (1-2 周)
- [ ] 安装依赖
  ```bash
  npm install @modelcontextprotocol/sdk@1.27.1
  ```
- [ ] MCP Server 管理器
  - `src/mcp/mcp-server-manager.ts`
  - 启动/停止 MCP 服务器
  - 工具发现与注册
- [ ] MCP 客户端
  - `src/mcp/mcp-client.ts`
  - 调用 MCP 工具
  - 结果处理
- [ ] 技能集成
  - MCP 工具自动转换为技能
  - 暴露到 pi-agent-core

**Task #139: 实现 OAuth 系统** (2-3 周)
- [ ] GitHub OAuth
  - `src/auth/github-oauth.ts`
  - OAuth 流程（authorize → callback → token）
  - Token 刷新
- [ ] 渠道插件 OAuth
  - `src/auth/channel-oauth.ts`
  - 通用 OAuth 框架
  - 插件注册机制
- [ ] 扫码登录
  - `src/auth/qr-login.ts`
  - QR code 生成（qrcode）
  - 状态轮询
- [ ] IPC 通道
  - `oauth:authorize`
  - `oauth:callback`
  - `oauth:revoke`

**Task #140: 集成语音模型** (2-3 周)
- [ ] sherpa-onnx 集成
  - 研究 Node.js binding 或 Python 子进程
  - SenseVoice 模型下载
  - ASR 实现
- [ ] Silero VAD
  - onnx 模型加载（onnxruntime-node）
  - 语音活动检测
  - 静音检测
- [ ] marswave TTS
  - `src/voice/marswave-tts.ts`
  - API 对接（硬编码 client-id）
  - 音频流处理
- [ ] IPC 通道
  - `host.stt.start` / `host.stt.stop`
  - `host.tts.speak` / `host.tts.cancel`

**Task #141: 替换为 Playwright** (1 周)
- [ ] 安装依赖
  ```bash
  npm install playwright-core@1.58.2
  ```
- [ ] 替换 sandboxed-browser
  - 移除 Electron WebContentsView 实现
  - 创建 `src/browser/playwright-browser.ts`
  - 保持相同接口
- [ ] 功能迁移
  - 导航、点击、填表
  - 截图、录制
  - 网络拦截
- [ ] 测试覆盖

---

### Phase 3: 协作与扩展 (4-6 周) 🟡

**Task #142: 实现 ColaLink** (3-4 周)
- [ ] 数据模型
  - `src/cola-link/models.ts`
  - Contact、Conversation、Message
- [ ] 联系人管理
  - `src/cola-link/contact-manager.ts`
  - 增删改查
  - 同步机制
- [ ] 消息系统
  - `src/cola-link/message-manager.ts`
  - 收发消息
  - 历史记录
- [ ] 扫码登录
  - QR 生成与展示
  - 状态轮询
- [ ] WeChat 插件
  - 协议逆向或使用第三方库
  - 插件适配层
- [ ] IPC 通道
  - `colaLink.getContacts`
  - `colaLink.sendMessage`
  - `colaLink.getConversations`

**Task #143: 实现 API Gateway** (2-3 周)
- [ ] Express Server
  - `src/gateway/gateway-server.ts`
  - 路由定义
  - 中间件
- [ ] 鉴权层
  - JWT token 验证
  - Device ID 校验
  - 请求头标准化
- [ ] 请求转发
  - AI Provider 路由
  - 负载均衡
  - 重试机制
- [ ] 流量控制
  - Rate limiting
  - 配额管理
  - 日志记录
- [ ] 监控
  - 请求统计
  - 错误率
  - 延迟监控

**Task #144: 实现 CLI 接口** (1 周)
- [ ] HTTP Server
  - `src/cli/cola-server.ts`
  - RESTful API
  - WebSocket 支持
- [ ] CLI 工具
  - `src/cli/cola-cli.ts`
  - 命令行参数解析（commander）
  - 子命令：chat、task、skill
- [ ] 打包
  - bin 脚本：`cola.mjs`
  - package.json 配置
- [ ] 测试
  - CLI 命令测试
  - 集成测试

---

### Phase 4: 安全与优化 (2-3 周) 🟢

**安全强化**
- [ ] 更新白名单
  - URL 白名单机制
  - 路径校验正则
- [ ] cola-dir 模块
  - 路径穿越防护
  - 软链接检测
  - 绝对路径强制
- [ ] IPC 加固
  - 输入校验
  - 类型检查
  - 异常处理

**性能优化**
- [ ] Agent 循环优化
  - 性能基准测试
  - 瓶颈分析
  - 并发控制
- [ ] 技能加载优化
  - 懒加载
  - 缓存机制
  - 预热策略
- [ ] 内存管理
  - 泄漏排查
  - GC 优化
  - 资源池

---

## 三、依赖安装清单

```bash
# Phase 1 - 核心框架
npm install @earendil-works/pi-agent-core@^0.74.0
npm install @earendil-works/pi-ai@^0.74.0
npm install @earendil-works/pi-coding-agent@^0.74.0
npm install gray-matter          # YAML frontmatter 解析
npm install koffi                 # FFI for Job Object

# Phase 2 - 关键功能
npm install @modelcontextprotocol/sdk@1.27.1
npm install playwright-core@1.58.2
npm install qrcode qrcode-terminal
npm install onnxruntime-node      # ONNX 模型加载（VAD）

# Phase 3 - 协作扩展
npm install express@^5.2.1
npm install commander@^14.0.3

# 类型定义
npm install @types/express @types/qrcode --save-dev
```

---

## 四、验收标准

### Phase 1 验收
- ✅ pi-agent-core 成功运行基础对话
- ✅ SKILL.md 技能可动态加载
- ✅ 进程沙箱成功隔离工具调用
- ✅ 所有现有测试通过

### Phase 2 验收
- ✅ MCP 工具可被发现和调用
- ✅ GitHub OAuth 登录成功
- ✅ 语音识别可用（英文/中文）
- ✅ Playwright 浏览器自动化正常
- ✅ TTS 语音合成可用

### Phase 3 验收
- ✅ 联系人/消息管理功能完整
- ✅ API Gateway 鉴权和转发正常
- ✅ CLI 命令可正常执行
- ✅ WeChat 插件基础功能可用

### Phase 4 验收
- ✅ 安全审计通过
- ✅ 性能基准达标
- ✅ 无内存泄漏
- ✅ 端到端测试全部通过

---

## 五、风险管理

### 高风险项
| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| pi-agent-core 迁移失败 | 核心循环不稳定 | 保留 Orchestrator 作为 fallback |
| 技能系统重构工作量大 | 进度延期 | 分批迁移，优先核心技能 |
| ColaLink 协议复杂 | 功能不完整 | 先实现基础功能，逐步扩展 |

### 中风险项
| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| sherpa-onnx binding 问题 | 语音功能不可用 | 使用 Python 子进程作为 fallback |
| OAuth 测试复杂 | 测试不充分 | 建立自动化测试环境 |
| Gateway 性能瓶颈 | 响应延迟 | 分阶段压测，及时优化 |

### 低风险项
- MCP 集成：官方 SDK 完善
- Playwright 替换：成熟方案
- CLI 实现：标准技术栈

---

## 六、进度追踪

### Week 1-2: Phase 1 启动
- [ ] 安装核心依赖
- [ ] 研究 pi-agent-core API
- [ ] 开始适配层开发

### Week 3-4: Phase 1 推进
- [ ] 完成 pi-agent-core 集成
- [ ] 启动 SKILL.md 系统开发

### Week 5-6: Phase 1 完成 + Phase 2 启动
- [ ] 完成技能系统重构
- [ ] 完成进程沙箱
- [ ] 启动 MCP 集成

### Week 7-10: Phase 2 推进
- [ ] 完成 MCP + OAuth
- [ ] 完成语音模型集成
- [ ] 完成 Playwright 替换

### Week 11-14: Phase 3 推进
- [ ] 完成 ColaLink 基础功能
- [ ] 完成 API Gateway
- [ ] 完成 CLI

### Week 15-16: Phase 4 + 总结
- [ ] 安全加固
- [ ] 性能优化
- [ ] 全面测试
- [ ] 文档完善

---

## 七、成功指标

### 功能完整性
- ✅ 所有 8 个核心缺失模块完成
- ✅ 技能系统兼容 Cola SKILL.md 格式
- ✅ 通过 Cola 功能对比清单验收

### 代码质量
- ✅ TypeScript 类型覆盖率 > 95%
- ✅ 单元测试覆盖率 > 80%
- ✅ 端到端测试通过率 100%
- ✅ 无 CRITICAL/HIGH 优先级 bug

### 性能指标
- ✅ Agent 循环延迟 < 100ms
- ✅ 技能加载时间 < 50ms
- ✅ 内存占用 < 500MB (空闲)
- ✅ CPU 占用 < 5% (空闲)

### 用户体验
- ✅ CLI 响应时间 < 1s
- ✅ 语音识别准确率 > 90%
- ✅ 浏览器自动化成功率 > 95%
- ✅ OAuth 登录流程流畅

---

## 八、资源分配

### 人力需求
- **后端开发**: 1-2 人
- **前端开发**: 1 人（Electron UI）
- **测试**: 0.5 人
- **文档**: 0.5 人

### 硬件需求
- **开发机**: 16GB+ RAM, 8+ 核 CPU
- **测试环境**: Windows + Linux + macOS
- **服务器**: API Gateway 部署（可选）

---

## 九、后续规划

完成对齐后，Nexus-Agent 将具备：
1. ✅ 与 Cola 功能对等
2. ✅ 更好的代码质量和架构
3. ✅ 更多的 AI Provider 支持
4. ✅ 更强的类型安全
5. ✅ 完整的测试覆盖

差异化优势：
- 🚀 7 AI Providers vs Cola 的 3 个
- 🔒 更安全的加密方案（Scrypt）
- 🏗️ 更清晰的代码架构
- 📦 完整的 TypeScript 类型系统

---

**最后更新**: 2026-06-24
**状态**: 规划完成，准备启动 Phase 1
