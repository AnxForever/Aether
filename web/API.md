# Aether Web API 客户端文档

> 本文档描述 `web/src/api/client.ts` 的配置、认证流程、所有 API 端点和 SSE 流式传输机制。

---

## 1. 基础配置

### Base URL

客户端通过环境变量 `VITE_API_URL` 配置 API 基础路径。默认值为空字符串（同源代理）。

```ts
const BASE = import.meta.env.VITE_API_URL || '';
```

在 `vite.config.ts` 中，开发服务器 `/api` 路径被代理到 `http://localhost:3000`：

```ts
// vite.config.ts
server: {
  proxy: {
    '/api': { target: 'http://localhost:3000', changeOrigin: true },
  },
}
```

### 通用响应格式

所有非流式接口返回统一格式：

```ts
interface ApiResponse<T> {
  success: boolean;   // 请求是否成功
  data?: T;           // 成功时的数据负载
  error?: string;     // 失败时的错误信息
}
```

### 请求头

- `Content-Type: application/json` — 始终设置
- `Authorization: Bearer <token>` — 当存在有效 token 时自动添加

---

## 2. 认证流程

### 登录

```ts
async function login(username: string, password: string): Promise<ApiResponse<{ token: string; expiresIn: number }>>
```

- 发送 `POST /api/auth/login`，体为 `{ username, password }`
- 成功后自动将 token 存储到 `localStorage`（key: `aether_token`）

### Token 存储与验证

```ts
// 存储
function setToken(token: string | null): void

// 读取（自动检查过期）
function getToken(): string | null
```

| 方法 | 说明 |
|------|------|
| `setToken(token)` | 写入内存 + localStorage |
| `getToken()` | 从内存读取，检查 JWT `exp` 声明，过期则清除并返回 `null` |

**安全策略**:
- Token 存储在 `localStorage`，每次请求前检查是否过期
- 过期前 5 分钟（`EXPIRY_GRACE_S = 300`）即视为过期，预刷新窗口
- 收到 401 响应时立即清除 token 并重定向到 `/login`

### 登出

```ts
// 清除 token（通过 store 的 logout 方法）
localStorage.removeItem('aether_token');
```

---

## 3. API 端点

### 3.1 切换模型

```ts
async function switchModel(model: string): Promise<ApiResponse<{ model: string }>>
```

- **Method**: `POST`
- **Path**: `/api/models/switch`
- **Body**: `{ model: string }`

### 3.2 发送聊天消息（非流式）

```ts
async function sendMessage(
  message: string,
  sessionId?: string,
  model?: string
): Promise<ApiResponse<{ message: string; sessionId: string }>>
```

- **Method**: `POST`
- **Path**: `/api/chat`
- **Parameters in body**:
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | `message` | `string` | 是 | 用户消息内容 |
  | `sessionId` | `string` | 否 | 会话 ID，不传则创建新会话 |
  | `model` | `string` | 否 | 模型标识，不传则使用默认模型 |

### 3.3 流式聊天（SSE）

```ts
function streamChat(
  message: string,
  sessionId: string | undefined,
  model: string,
  onChunk: (text: string) => void,
  onDone: (sessionId: string) => void,
  onError: (error: string) => void
): AbortController
```

- **Method**: `GET`
- **Path**: `/api/chat/stream`

**Query Parameters**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `message` | `string` | 是 | 用户消息内容 |
| `sessionId` | `string` | 否 | 会话 ID |
| `model` | `string` | 否 | 模型标识 |

**返回值**: `AbortController` — 调用 `controller.abort()` 可取消流式请求。

#### SSE 事件格式

```
data: {"type": "chunk", "content": "你好"}
data: {"type": "chunk", "content": "世界"}
data: {"type": "done", "sessionId": "abc123"}
```

| 事件类型 | 说明 | 回调 |
|----------|------|------|
| `chunk` | AI 回复的文本片段 | `onChunk(content)` |
| `done` | 流式生成完成 | `onDone(sessionId)` |
| `error` | 发生错误 | `onError(error)` |

**使用示例**:

```tsx
import { streamChat } from '../api/client';

function useStreamChat() {
  const [content, setContent] = useState('');
  const controllerRef = useRef<AbortController | null>(null);

  const startStream = (message: string, sessionId?: string) => {
    setContent('');

    controllerRef.current = streamChat(
      message,
      sessionId,
      'claude-sonnet-4-20250514',
      (chunk) => setContent((prev) => prev + chunk),
      (newSessionId) => console.log('Session:', newSessionId),
      (error) => console.error('Stream error:', error),
    );
  };

  const cancelStream = () => {
    controllerRef.current?.abort();
  };

  return { content, startStream, cancelStream };
}
```

### 3.4 获取模型列表

```ts
async function getModels(): Promise<ApiResponse<{ models: unknown[]; count: number }>>
```

- **Method**: `GET`
- **Path**: `/api/models`

### 3.5 获取技能列表

```ts
async function getSkills(): Promise<ApiResponse<{ skills: unknown[]; dynamicSkills: unknown[]; count: number }>>
```

- **Method**: `GET`
- **Path**: `/api/skills`

### 3.6 切换技能启用状态

```ts
async function toggleSkill(id: string, enabled: boolean): Promise<ApiResponse<{ id: string; enabled: boolean }>>
```

- **Method**: `POST`
- **Path**: `/api/skills/:id/toggle`
- **Body**: `{ enabled: boolean }`

### 3.7 提交反馈

```ts
async function submitFeedback(
  messageId: string,
  rating: number,
  comment?: string
): Promise<ApiResponse<{ feedbackId: string }>>
```

- **Method**: `POST`
- **Path**: `/api/learning/feedback`
- **Body**: `{ messageId, rating, comment? }`

### 3.8 获取学习统计

```ts
async function getLearningStats(): Promise<ApiResponse<any>>
```

- **Method**: `GET`
- **Path**: `/api/learning/stats`

### 3.9 获取工作流列表

```ts
async function getWorkflows(): Promise<ApiResponse<{ workflows: unknown[]; count: number }>>
```

- **Method**: `GET`
- **Path**: `/api/workflows`

### 3.10 运行工作流

```ts
async function runWorkflow(
  id: string,
  inputs?: Record<string, unknown>
): Promise<ApiResponse<any>>
```

- **Method**: `POST`
- **Path**: `/api/workflows/:id/run`
- **Body**: `{ inputs? }`

### 3.11 新建会话

```ts
async function newSession(): Promise<ApiResponse<{ sessionId: string }>>
```

- **Method**: `POST`
- **Path**: `/api/session/new`

---

## 4. 内部机制

### 通用请求函数

所有 API 端点通过内部的 `request<T>()` 函数统一调用：

```ts
async function request<T>(
  method: string,   // HTTP 方法
  path: string,     // API 路径（不含 BASE）
  body?: unknown    // 可选请求体（自动 JSON 序列化）
): Promise<ApiResponse<T>>
```

**自动行为**:
1. 自动附加 `Authorization` header（若 token 存在且有效）
2. 自动 JSON 序列化请求体
3. 自动解析 JSON 响应
4. 401 时自动清除 token 并跳转到 `/login`

### SSE 流式传输详解

`streamChat()` 使用 `fetch()` + `ReadableStream` 实现 SSE：

1. 通过 `fetch()` 发起 GET 请求
2. 获取 `res.body.getReader()` 读取流
3. 使用 `TextDecoder` 解码二进制数据
4. 按 `\n` 分割行，解析 `data: ` 前缀的 SSE 事件
5. 根据 `type` 字段分发到对应的回调函数
6. 支持通过 `AbortController` 取消正在进行的流

---

## 5. 错误处理

```ts
// 401 自动处理
if (res.status === 401) {
  setToken(null);
  redirectToLogin();  // 跳转到 /login
}

// 流式请求中的错误
if (data.type === 'error') {
  onError(data.error);  // 触发 onError 回调
}

// 网络断开或请求被取消
fetch(...).catch((err) => {
  if (err.name !== 'AbortError') onError(err.message);
  // AbortError 是用户主动取消，不视为错误
});
```

---

## 6. 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VITE_API_URL` | `''` | API 基础 URL，留空表示同源代理 |
| `VITE_SENTRY_DSN` | 无 | Sentry DSN，配置后启用错误监控 |

---

## 7. 完整使用示例

```tsx
import { useEffect, useState } from 'react';
import {
  getModels,
  getSkills,
  newSession,
  streamChat,
} from '../api/client';

function useChat() {
  const [models, setModels] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // 初始化：获取模型列表 + 创建新会话
  useEffect(() => {
    getModels().then((res) => {
      if (res.success && res.data) {
        setModels(res.data.models as string[]);
      }
    });

    newSession().then((res) => {
      if (res.success && res.data) {
        setSessionId(res.data.sessionId);
      }
    });
  }, []);

  // 流式发送消息
  const send = (message: string) => {
    streamChat(
      message,
      sessionId ?? undefined,
      'claude-sonnet-4-20250514',
      (chunk) => console.log('收到片段:', chunk),
      (id) => setSessionId(id),
      (err) => console.error('错误:', err),
    );
  };

  return { models, send };
}
```
