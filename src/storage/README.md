# Nexus Storage Layer

完整的存储层实现，基于 Cola 架构设计，包含 4 个核心模块。

## 架构概览

```
src/storage/
├── chat-history.ts      # SQLite3 聊天历史 (WAL mode)
├── config-manager.ts    # AES-256-GCM 加密配置
├── model-registry.ts    # 动态模型注册表
├── device-identity.ts   # 设备 UUID 管理
├── index.ts            # 模块导出
└── example.ts          # 使用示例
```

## 模块详解

### 1. ChatHistory - 聊天历史

SQLite3 + WAL 模式，优化并发访问性能。

**特性**:
- WAL (Write-Ahead Logging) 日志模式
- 会话与消息两级存储
- 全文搜索支持
- 索引优化查询

**核心 API**:
```typescript
const chatHistory = new ChatHistory('/path/to/chat-history.db');

// 会话管理
chatHistory.createSession({ id, title, type, createdAt, updatedAt });
chatHistory.getSession(sessionId);
chatHistory.listSessions(limit, offset);
chatHistory.deleteSession(sessionId);

// 消息管理
chatHistory.saveMessage({ id, sessionId, role, content, timestamp, metadata });
chatHistory.getMessages(sessionId, limit, offset);
chatHistory.searchMessages('query', limit);

// 维护
chatHistory.vacuum();
chatHistory.checkpoint();
chatHistory.close();
```

**Schema**:
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'chat',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  metadata TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
```

### 2. ConfigManager - 加密配置

AES-256-GCM 加密，Scrypt 密钥派生，兼容 Cola 格式。

**格式**: `nexus.enc.v1:<iv>:<authTag>:<encrypted>`

**特性**:
- AES-256-GCM 认证加密
- Scrypt 密钥派生 (N=16384, r=8, p=1)
- 支持密钥轮换
- 类型安全的配置 API

**核心 API**:
```typescript
const configManager = new ConfigManager(password, salt);

// Auth 配置 (auth.json)
configManager.setApiKey(authPath, 'claude', 'sk-ant-xxxxx');
configManager.getApiKey(authPath, 'claude');
configManager.setToken(authPath, 'github', 'ghp_xxxxx');

// Settings 配置 (settings.json)
configManager.saveSettings(settingsPath, {
  model: 'claude-3-7-sonnet-20250219',
  temperature: 0.7,
  maxTokens: 8192,
  streamResponse: true,
  language: 'en',
  theme: 'dark',
});

configManager.updateSettings(settingsPath, { theme: 'light' });
configManager.getSetting(settingsPath, 'model');

// 密钥轮换
configManager.rotateKey(newPassword, authPath, settingsPath);
```

**加密参数**:
- Algorithm: AES-256-GCM
- Key length: 32 bytes (256 bits)
- IV length: 16 bytes
- Auth tag: 16 bytes
- Scrypt: N=16384, r=8, p=1

### 3. ModelRegistry - 模型注册表

动态模型配置与价格管理。

**特性**:
- 预置主流模型配置
- 动态添加/更新模型
- 能力筛选
- 成本计算
- 批量操作

**核心 API**:
```typescript
const modelRegistry = new ModelRegistry('/path/to/models.json');

// 查询模型
modelRegistry.getModel('claude-3-7-sonnet-20250219');
modelRegistry.getAllModels();
modelRegistry.getModelsByProvider('claude');
modelRegistry.getModelsByCapability('vision');

// 管理模型
modelRegistry.addModel(modelConfig);
modelRegistry.updateModel(modelId, updates);
modelRegistry.removeModel(modelId);

// 价格相关
modelRegistry.calculateCost(modelId, inputTokens, outputTokens);
modelRegistry.getCheapestModel(provider?, capability?);
modelRegistry.getMostCapableModel(provider?);

// 批量操作
modelRegistry.bulkAddModels(models);
modelRegistry.bulkUpdatePricing(updates);
```

**预置模型**:
- Claude: 3.7 Sonnet, Opus 4, 3.5 Haiku
- OpenAI: GPT-4o, GPT-4o Mini, o1
- Gemini: 2.0 Flash, 1.5 Pro
- DeepSeek: Chat, Reasoner

### 4. DeviceIdentityManager - 设备身份

UUID 生成与持久化。

**特性**:
- UUID v4 生成
- 自动持久化
- 平台信息记录
- UUID 验证

**核心 API**:
```typescript
const identityManager = new DeviceIdentityManager('/path/to/identity.json');

// 获取身份
identityManager.getDeviceId();
identityManager.getIdentity();

// 管理
identityManager.regenerate();
identityManager.updateVersion('2.0.0');

// 工具
DeviceIdentityManager.generateUUID();
DeviceIdentityManager.isValidUUID(uuid);
```

**Identity 格式**:
```typescript
interface DeviceIdentity {
  deviceId: string;
  createdAt: number;
  platform: string;   // process.platform
  version: string;    // process.version
}
```

## 使用示例

### 完整工作流

```typescript
import { 
  ChatHistory, 
  ConfigManager, 
  ModelRegistry, 
  DeviceIdentityManager 
} from './storage';

// 1. 初始化设备身份
const identity = new DeviceIdentityManager('./identity.json');
const deviceId = identity.getDeviceId();

// 2. 配置管理
const config = new ConfigManager('password', ConfigManager.generateSalt());
config.setApiKey('./auth.json', 'claude', 'sk-ant-xxxxx');
config.saveSettings('./settings.json', {
  model: 'claude-3-7-sonnet-20250219',
  temperature: 0.7,
  maxTokens: 8192,
  streamResponse: true,
  language: 'en',
  theme: 'dark',
});

// 3. 模型注册表
const models = new ModelRegistry('./models.json');
const modelConfig = models.getModel('claude-3-7-sonnet-20250219');
console.log(`Context window: ${modelConfig.contextWindow}`);

// 4. 聊天历史
const chatHistory = new ChatHistory('./chat-history.db');
chatHistory.createSession({
  id: 'session-1',
  title: 'New Chat',
  type: 'chat',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

chatHistory.saveMessage({
  id: 'msg-1',
  sessionId: 'session-1',
  role: 'user',
  content: 'Hello!',
  timestamp: Date.now(),
});

// 5. 成本计算
const cost = models.calculateCost('claude-3-7-sonnet-20250219', 100000, 50000);
console.log(`Cost: $${cost.toFixed(4)}`);
```

### 运行示例

```bash
# 编译
npm run build

# 运行示例
node dist/storage/example.js
```

## 技术细节

### 性能优化

**ChatHistory**:
- WAL 模式: 并发读写不阻塞
- 索引策略: session_id + timestamp 复合索引
- Cache size: 64MB
- Synchronous: NORMAL (平衡性能与安全)

**ConfigManager**:
- Scrypt 参数经过优化，平衡安全性与性能
- GCM 模式提供认证加密
- 延迟加载配置文件

**ModelRegistry**:
- 内存 Map 存储，O(1) 查询
- 懒加载文件系统

### 安全考虑

1. **加密强度**: AES-256-GCM 提供机密性和完整性
2. **密钥派生**: Scrypt 抗 GPU/ASIC 攻击
3. **认证标签**: 防止密文篡改
4. **版本控制**: 支持未来升级加密方案

### 兼容性

- **Cola 格式兼容**: 加密格式、数据库 schema 完全兼容
- **Node.js**: >= 20.0.0
- **TypeScript**: 类型安全，完整类型定义
- **跨平台**: Linux, macOS, Windows

## 依赖

```json
{
  "better-sqlite3": "^11.0.0",  // SQLite3 驱动
  "crypto": "built-in"           // Node.js 加密模块
}
```

## 测试

```bash
# 类型检查
npx tsc --noEmit src/storage/*.ts

# 运行示例
npm run build
node dist/storage/example.js
```

## 文件大小

- `chat-history.ts`: ~8 KB (300 行)
- `config-manager.ts`: ~9 KB (350 行)
- `model-registry.ts`: ~9 KB (250 行)
- `device-identity.ts`: ~3 KB (100 行)
- **总计**: ~29 KB (1000 行)

## 许可证

MIT
