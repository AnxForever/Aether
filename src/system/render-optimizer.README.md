# Nexus Render Optimizer

高性能 Electron 渲染优化系统，支持智能 GPU 降级、性能监控和自动故障恢复。

## 功能特性

### 核心功能

- **多渲染模式支持**
  - `gpu`: 完整 GPU 加速（默认）
  - `software`: 软件渲染（兼容模式）
  - `hybrid`: 混合模式（部分 GPU 加速）
  - `auto`: 自动选择

- **智能故障降级**
  - 自动检测 GPU 启动失败
  - 2次失败后自动切换到软件渲染
  - 24小时降级窗口期
  - 下次正常启动时自动重试 GPU

- **性能监控**
  - FPS 追踪
  - 内存使用监控
  - 渲染延迟测量
  - 性能评分（0-100）

- **持久化配置**
  - `desktop-render-mode.json` 配置文件
  - 启动历史记录
  - 性能数据历史
  - GPU 能力信息

## 快速开始

### 基础使用

```typescript
import { createRenderOptimizer } from './system/render-optimizer';
import { app } from 'electron';

// 1. 创建优化器实例
const renderOptimizer = createRenderOptimizer();

// 2. 决定渲染模式
const decision = renderOptimizer.decideRenderMode(
  process.argv,
  process.env,
  {
    appVersion: app.getVersion(),
    hardwareAccelerationEnabled: true
  }
);

// 3. 应用 Electron 开关
renderOptimizer.applyElectronSwitches(decision);

// 4. 启动渲染器就绪监控
renderOptimizer.startRendererReadyWatchdog(() => {
  renderOptimizer.relaunchInSoftwareMode('Renderer timeout');
});

// 5. 在渲染器就绪时标记
// (通过 IPC 从渲染进程调用)
ipcMain.handle('render:renderer-ready', () => {
  return renderOptimizer.markRendererReady();
});
```

## 架构设计

### 类结构

```
RenderOptimizer
├── Configuration Management
│   ├── loadConfig()
│   ├── saveConfig()
│   └── clearAutoFallback()
├── Render Mode Decision
│   ├── decideRenderMode()
│   ├── parseRenderMode()
│   ├── shouldActivateAutoFallback()
│   └── checkPreviousLaunchFailure()
├── Electron Switches
│   └── applyElectronSwitches()
├── Renderer Ready Tracking
│   ├── startRendererReadyWatchdog()
│   ├── markRendererReady()
│   ├── handleRendererFailure()
│   └── relaunchInSoftwareMode()
├── Performance Tracking
│   ├── recordPerformanceMetrics()
│   ├── calculatePerformanceScore()
│   └── getPerformanceStats()
├── GPU Detection
│   ├── detectGPUCapability()
│   └── saveGPUCapability()
└── Notice Management
    ├── setPendingNotice()
    ├── getPendingNotice()
    └── clearPendingNotice()
```

### 决策流程

```
启动 Nexus
    ↓
检查上次启动失败？
    ↓ Yes
增加失败计数
    ↓
解析命令行参数
    ↓
检查 --render-mode / --disable-gpu
    ↓ Not Found
检查环境变量 NEXUS_RENDER_MODE
    ↓ Not Found
检查自动降级状态
    ↓ 失败次数 >= 2
切换到 software 模式
    ↓ 否则
检查用户设置
    ↓ 硬件加速已禁用
使用 software 模式
    ↓ 否则
使用 gpu 模式（默认）
    ↓
应用 Electron 开关
    ↓
启动渲染器监控（15秒超时）
    ↓
渲染器报告就绪？
    ↓ Yes
标记成功，清除降级状态
    ↓ No (超时)
记录失败，重启到 software 模式
```

## 配置文件格式

### desktop-render-mode.json

```json
{
  "version": 1,
  "autoFallback": {
    "reason": "Renderer process exited during startup: crashed",
    "activatedAt": 1703001234567,
    "failureCount": 2,
    "appVersion": "1.0.0"
  },
  "lastLaunch": {
    "startedAt": 1703001234567,
    "appVersion": "1.0.0",
    "mode": "software",
    "source": "auto-fallback",
    "reason": "Repeated GPU failures",
    "rendererReady": true,
    "performanceScore": 78
  },
  "pendingNotice": {
    "key": "fallback:gpu-crash",
    "level": "warning",
    "message": "Compatibility rendering is active after repeated GPU startup failures."
  },
  "lastShownNoticeKey": "fallback:gpu-crash",
  "gpuCapability": {
    "vendor": "NVIDIA Corporation",
    "renderer": "GeForce RTX 3080",
    "vramMB": 10240,
    "supportsWebGL2": true,
    "supportsWebGPU": true,
    "driverVersion": "535.98"
  },
  "performanceHistory": [
    {
      "fps": 60,
      "memoryUsageMB": 245,
      "gpuUsagePercent": 45,
      "renderLatencyMs": 2.5,
      "timestamp": 1703001234567
    }
  ]
}
```

### 字段说明

- **version**: 配置文件版本（当前为 1）
- **autoFallback**: 自动降级状态
  - `reason`: 降级原因
  - `activatedAt`: 激活时间戳
  - `failureCount`: 失败次数
  - `appVersion`: 应用版本
- **lastLaunch**: 最后启动信息
  - `startedAt`: 启动时间
  - `mode`: 渲染模式
  - `source`: 模式来源
  - `rendererReady`: 渲染器是否就绪
  - `performanceScore`: 性能评分
- **pendingNotice**: 待显示通知
- **gpuCapability**: GPU 能力信息
- **performanceHistory**: 性能历史记录（最多100条）

## 命令行使用

```bash
# 强制 GPU 模式
nexus --render-mode=gpu

# 强制软件渲染
nexus --render-mode=software

# 混合模式
nexus --render-mode=hybrid

# 自动模式
nexus --render-mode=auto

# 禁用 GPU（等同于 software）
nexus --disable-gpu

# 使用环境变量
NEXUS_RENDER_MODE=software nexus
```

## IPC 接口

### 主进程 → 渲染进程

```typescript
// 渲染器就绪
ipcMain.handle('render:renderer-ready', () => {
  return renderOptimizer.markRendererReady();
});

// 获取当前渲染模式
ipcMain.handle('render:get-mode', () => {
  const decision = renderOptimizer.getCurrentDecision();
  return { mode: decision?.mode, source: decision?.source };
});

// 记录性能指标
ipcMain.handle('render:record-metrics', (event, metrics) => {
  renderOptimizer.recordPerformanceMetrics(metrics);
});

// 获取性能统计
ipcMain.handle('render:get-stats', () => {
  return renderOptimizer.getPerformanceStats();
});

// 清除自动降级
ipcMain.handle('render:clear-fallback', () => {
  renderOptimizer.clearAutoFallback();
});
```

### 渲染进程调用

```typescript
// preload.js
contextBridge.exposeInMainWorld('nexusRender', {
  reportReady: () => ipcRenderer.invoke('render:renderer-ready'),
  getMode: () => ipcRenderer.invoke('render:get-mode'),
  recordMetrics: (metrics) => ipcRenderer.invoke('render:record-metrics', metrics),
  getStats: () => ipcRenderer.invoke('render:get-stats'),
  clearFallback: () => ipcRenderer.invoke('render:clear-fallback')
});

// renderer.js
async function init() {
  const result = await window.nexusRender.reportReady();
  console.log(`Running in ${result.mode} mode`);

  if (result.notice) {
    showNotification(result.notice.level, result.notice.message);
  }
}
```

## 性能监控

### 指标收集

```typescript
// 在渲染进程中
setInterval(async () => {
  const metrics = {
    fps: measureFPS(),
    memoryUsageMB: performance.memory.usedJSHeapSize / (1024 * 1024),
    gpuUsagePercent: 0, // 需要 WebGL 扩展
    renderLatencyMs: measureRenderLatency(),
    timestamp: Date.now()
  };

  await window.nexusRender.recordMetrics(metrics);
}, 5000); // 每5秒
```

### 性能评分

性能评分基于以下权重计算（0-100）：

- **FPS**: 40% 权重（目标 60 FPS）
- **内存使用**: 30% 权重（目标 < 2GB）
- **渲染延迟**: 30% 权重（目标 < 100ms）

```typescript
const stats = await window.nexusRender.getStats();
console.log(`Overall score: ${stats.overallScore}/100`);
console.log(`Average FPS: ${stats.avgFps.toFixed(1)}`);
console.log(`Average memory: ${stats.avgMemoryMB.toFixed(0)} MB`);
```

## 故障排查

### 1. 检查配置文件

```bash
# 配置文件位置
~/.nexus/desktop-render-mode.json

# 查看内容
cat ~/.nexus/desktop-render-mode.json | jq .
```

### 2. 强制软件渲染

```bash
nexus --render-mode=software
```

### 3. 清除降级状态

```bash
# 删除配置文件
rm ~/.nexus/desktop-render-mode.json

# 或在设置中清除
```

### 4. 查看日志

```bash
# 启用详细日志
nexus --enable-logging --v=1

# 查找渲染器相关日志
grep "RenderOptimizer" ~/.nexus/logs/main.log
grep "render-process-gone" ~/.nexus/logs/main.log
```

### 5. GPU 诊断

在渲染进程中访问 `chrome://gpu` 查看详细 GPU 状态。

## 与 Cola 的差异

### 改进点

1. **TypeScript 类型安全**
   - Cola: 纯 JavaScript
   - Nexus: 完整 TypeScript 类型定义

2. **渲染模式**
   - Cola: `gpu` / `cpu`
   - Nexus: `gpu` / `software` / `hybrid` / `auto`

3. **性能监控**
   - Cola: 无性能追踪
   - Nexus: FPS、内存、延迟、评分

4. **GPU 检测**
   - Cola: 仅基本模式切换
   - Nexus: 支持 GPU 能力检测和保存

5. **配置格式**
   - Cola: 最小化配置
   - Nexus: 扩展配置，包含性能历史

6. **API 设计**
   - Cola: 函数式
   - Nexus: 类封装，更易测试和扩展

## 最佳实践

### 1. 初始化时机

在 `app.on('will-finish-launching')` 中初始化，确保在创建窗口前完成：

```typescript
app.on('will-finish-launching', () => {
  renderOptimizer = createRenderOptimizer();
  const decision = renderOptimizer.decideRenderMode(/*...*/);
  renderOptimizer.applyElectronSwitches(decision);
});
```

### 2. 窗口显示策略

- **GPU 模式**: 等待渲染器就绪后显示
- **Software 模式**: 立即显示或短暂延迟后显示

```typescript
if (decision.mode === 'software') {
  window.show(); // 立即显示
} else {
  // 等待 renderer-ready IPC
}
```

### 3. 错误处理

监听 `render-process-gone` 事件：

```typescript
webContents.on('render-process-gone', (event, details) => {
  if (decision.mode === 'gpu' && !renderOptimizer.isReady()) {
    renderOptimizer.relaunchInSoftwareMode(`Crash: ${details.reason}`);
  }
});
```

### 4. 用户设置集成

用户手动更改硬件加速设置时清除自动降级：

```typescript
function onSettingsChange() {
  renderOptimizer.clearAutoFallback();
  app.relaunch();
  app.exit(0);
}
```

### 5. 性能监控频率

建议每5秒收集一次性能指标，避免过于频繁影响性能。

## 许可证

MIT License

---

**Made for Nexus with ❤️ by Zero Two**

*比 Cola 更快、更稳、更智能的渲染优化系统*
