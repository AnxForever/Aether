# Aether Web 组件文档

> 本文档描述 `web/src/components/` 下所有组件的用途、Props、状态和用法。

---

## 目录

1. [ProviderBar](#providerbar)
2. [Sidebar](#sidebar)
3. [Layout](#layout)
4. [ChatMessage](#chatmessage)
5. [SuggestedPrompts](#suggestedprompts)
6. [Skeleton](#skeleton)
7. [EmptyState](#emptystate)
8. [ErrorBoundary](#errorboundary)
9. [Toast](#toast)

---

## ProviderBar

AI 提供者切换栏。显示在页面顶部，列出所有可用的 AI 模型提供商，支持当前活跃 provider 的高亮和溢出菜单。

### Props

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| (无) | — | — | 从 zustand store (`useAppStore`) 读取 `currentModel` 和 `setModel` |

### 内部组件：`ProviderButton`

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | Provider 标识（如 `claude`, `openai`） |
| `name` | `string` | 是 | 显示名称（如 `Claude`, `GPT-4`） |
| `model` | `string` | 是 | 模型名称（如 `Sonnet`, `Turbo`） |
| `dot` | `string` | 是 | 状态点颜色 hex 值 |
| `active` | `boolean` | 是 | 是否当前活跃 |
| `onSelect` | `(id: string) => void` | 是 | 选中回调 |

### 状态

| 状态 | 说明 |
|------|------|
| Default | 所有 provider 可见，非活跃项文字透明度 0.4 |
| Active | 选中项显示发光点动画 + 边框高亮 |
| Overflow | 小屏幕下第 5~7 个 provider 隐藏到 `MoreHorizontal` 下拉菜单 |
| Empty | N/A（provider 列表硬编码，不为空） |
| Error | 切换模型失败时，logger 输出错误（不影响 UI） |

### 使用示例

```tsx
// ProviderBar 自动挂载在 Layout 顶部，无需手动传参
import ProviderBar from '../components/ProviderBar';

function App() {
  return (
    <div>
      <ProviderBar />
      <main>...</main>
    </div>
  );
}
```

---

## Sidebar

左侧导航侧边栏。包含：用户标识、Aether 品牌、新对话按钮、导航链接（对话/技能/工作流/设置）和退出按钮。

### Props

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| (无) | — | — | 从 zustand store 读取 `logout`, `clearMessages`, `toggleSidebar` |

### 状态

| 状态 | 说明 |
|------|------|
| Default | 侧边栏展开（`w-56`），显示所有导航项 |
| Collapsed | `sidebarOpen = false` 时宽度为 `w-0`（通过 Layout 控制） |
| Active Nav | 当前路由对应导航项高亮（`bg-accent/10` + 边框） |
| Error | N/A（不涉及数据加载） |

### 使用示例

```tsx
// Sidebar 自动挂载在 Layout 中
import Sidebar from '../components/Sidebar';

function Page() {
  return (
    <aside>
      <Sidebar />
    </aside>
  );
}
```

---

## Layout

页面整体布局容器。包含顶部的 ProviderBar、可折叠的左侧 Sidebar 和右侧内容区域。

### Props

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `children` | `ReactNode` | 是 | 页面内容 |

### 状态

| 状态 | 说明 |
|------|------|
| Default | 侧边栏展开，内容区显示网格背景 + 环境光晕 |
| Sidebar Collapsed | `sidebarOpen = false`，侧边栏宽度归零 |
| Loading | N/A（Layout 不负责数据加载） |
| Error | N/A（Layout 不处理错误，由 ErrorBoundary 捕获） |

### 使用示例

```tsx
import Layout from '../components/Layout';

function App() {
  return (
    <Layout>
      <ChatPage />
    </Layout>
  );
}
```

---

## ChatMessage

单条聊天消息气泡组件。支持 user 和 assistant 两种角色。

### Props

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `msg` | `MessageData` | 是 | 消息数据对象 |

### MessageData

```ts
interface MessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  model?: string;
}
```

### 状态

| 状态 | 说明 |
|------|------|
| User Message | 右对齐，cyan 色边框背景 |
| Assistant Message | 左对齐，深色背景，显示 provider 色点和名称 |
| Streaming | 内容后追加闪烁光标（CSS class `cursor-blink`） |
| Empty | N/A（父组件控制是否渲染） |
| Error | N/A（不单独处理错误消息） |

### 使用示例

```tsx
import ChatMessage from '../components/ChatMessage';

function ChatList({ messages }: { messages: MessageData[] }) {
  return (
    <div className="space-y-4">
      {messages.map((msg) => (
        <ChatMessage key={msg.id} msg={msg} />
      ))}
    </div>
  );
}
```

---

## SuggestedPrompts

快速开始建议提示词网格。在空白对话页显示，点击后自动填入输入框。

### Props

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `onSelect` | `(text: string) => void` | 是 | 用户选中提示词时的回调 |

### 状态

| 状态 | 说明 |
|------|------|
| Default | 2x2 网格，显示 4 条预设提示词 |
| Hover | 提示卡片缩放 `1.02` + 发光阴影 |
| Empty | N/A（提示词硬编码，始终存在） |
| Error | N/A |

### 使用示例

```tsx
import SuggestedPrompts from '../components/SuggestedPrompts';

function ChatPage() {
  const handleSelect = (text: string) => {
    setInput(text);
  };

  return <SuggestedPrompts onSelect={handleSelect} />;
}
```

---

## Skeleton

加载占位骨架屏组件。带 shimmer 动画效果。

### Props

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `className` | `string` | 否 | 额外 CSS 类，用于控制尺寸（默认 `''`） |

### 状态

| 状态 | 说明 |
|------|------|
| Default | 显示带 shimmer 动画的灰色占位块 |
| Custom Size | 通过 `className` 控制宽高 |

### 使用示例

```tsx
import Skeleton from '../components/Skeleton';

function LoadingList() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-10 w-full rounded-md" />
    </div>
  );
}
```

---

## EmptyState

空状态占位组件。用于列表或内容区无数据时的友好提示。

### Props

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `icon` | `LucideIcon` | 是 | lucide-react 图标组件 |
| `title` | `string` | 是 | 标题文字 |
| `description` | `string` | 是 | 描述文字 |

### 状态

| 状态 | 说明 |
|------|------|
| Default | 居中显示图标 + 标题 + 描述 |
| Empty | N/A（组件本身就是空状态展示） |
| Error | N/A |

### 使用示例

```tsx
import EmptyState from '../components/EmptyState';
import { MessageSquare } from 'lucide-react';

function NoMessages() {
  return (
    <EmptyState
      icon={MessageSquare}
      title="还没有对话"
      description="点击上方"新对话"按钮开始你的第一次对话"
    />
  );
}
```

---

## ErrorBoundary

React 错误边界组件。捕获子组件抛出的渲染异常，显示错误 UI 并提供重试按钮。集成 Sentry 错误上报（如果配置了 DSN）。

### Props

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `children` | `ReactNode` | 是 | 需要错误保护的内容 |

### 状态

| 状态 | 说明 |
|------|------|
| Normal | 正常渲染子组件 |
| Error | 捕获到异常，显示错误提示卡片 + 重试按钮 |
| After Retry | 重置 `hasError = false`，恢复正常渲染 |

### 使用示例

```tsx
import ErrorBoundary from '../components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <MainContent />
    </ErrorBoundary>
  );
}
```

---

## Toast

Toast 通知容器组件。固定在右下角，支持 info / error / success 三种类型，自动 4 秒消失。

### Props

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| (无) | — | — | 从 zustand store (`useToastStore`) 读取 `toasts` 和 `removeToast` |

### Toast 数据类型

```ts
interface Toast {
  id: string;
  message: string;
  type: 'info' | 'error' | 'success';
}
```

### 状态

| 状态 | 说明 |
|------|------|
| Empty | `toasts.length === 0` 时返回 `null`，不渲染 |
| Info | 青色左边框 + `●` 图标 |
| Success | 绿色左边框 + `✓` 图标 |
| Error | 红色左边框 + `✕` 图标 |
| Auto-dismiss | 4 秒后自动移除 |

### 使用示例

```tsx
import { useToastStore } from '../stores/toast';

function MyComponent() {
  const addToast = useToastStore((s) => s.addToast);

  return (
    <button onClick={() => addToast('操作成功', 'success')}>
      提交
    </button>
  );
}
```

```tsx
// ToastContainer 应放置在应用根节点（已在 main.tsx 中挂载）
// 不需要手动渲染，只需通过 store 添加 toast 即可
import { useToastStore } from '../stores/toast';

// 在任意组件中触发通知
useToastStore.getState().addToast('保存失败，请重试', 'error');
```
