# Aether  vs  Cola — 徹底功能審計

> 掃描日期：2026-06-25  
> 掃描範圍：48 模組，266 TypeScript 文件，123 IPC 頻道  
> 方法：每個模組逐文件檢查初始化狀態、TODO 標記、IPC 接線、前端整合

---

## 🔴 P0 — 核心功能缺口（影響基本使用或安全性）

### 1. 語音功能 — 全部 stub 實現
| 文件 | 行數 | 狀態 |
|------|------|------|
| `voice/silero-vad.ts` | 208 | 🟡 介面完整，VAD 檢測邏輯 TODO |
| `voice/sherpa-asr.ts` | 188 | 🟡 ASR 識別邏輯 TODO |
| `voice/marswave-tts.ts` | 193 | 🟡 TTS 合成邏輯 TODO |
| `voice/voice-manager.ts` | 239 | 🟡 整合層，調用 stub 子模塊 |
| `speech/speech-recognition.ts` | 未知 | 🟡 瀏覽器 Speech API 包裝（需 Chromium） |
| `speech/vad.ts` | 未知 | 🟡 獨立 VAD 模塊 |
| `speech/tts.ts` | 未知 | 🟡 獨立 TTS 模塊 |

**影響**：語音輸入、語音輸出完全不可用。這是 Cola 的核心差異化功能之一。

**工作量**：大（需整合 sherpa-onnx / silero-vad 原生依賴，或調用雲端 API）

---

### 2. ColaLink 端到端加密 — 缺失 Signal Protocol
| 文件 | 行數 | 狀態 |
|------|------|------|
| `colalink/message-manager.ts` | 373 | 🟡 `encryptionKey: string`，明文對稱加密 |

```typescript
// Line 43: TODO: SECURITY - Implement proper end-to-end encryption with Signal Protocol
// Line 53: private encryptionKey: string; // TODO: Replace with Signal Protocol session manager
```

**影響**：跨設備消息無真正的端到端加密，安全性不足

**工作量**：大（需整合 libsignal-protocol-typescript）

---

### 3. 沙箱執行器 — Windows Job Object 未實現
| 文件 | 狀態 |
|------|------|
| `sandbox/sandbox-executor.ts` | 🟡 Linux cgroup 框架有，Windows Job Object TODO |

```typescript
// Line 117: TODO: 使用 koffi FFI 調用 Windows Job Object API
```

**影響**：動態技能建立的程式碼無法安全沙箱執行

**工作量**：中

---

## 🟠 P1 — 高優先級（功能已有後端但無 IPC / 前端）

### 4. 91 個 IPC 頻道未接線
協議定義了 123 個頻道，main.ts 只註冊了 32 個 handler。以下為**後端代碼已存在但無 IPC 接線**的功能：

| 類別 | 未接線頻道 | 對應後端 |
|------|-----------|---------|
| **設置完整 CRUD** | `SETTINGS_SAVE`, `SETTINGS_REFRESH_AUTH_BACKEND`, `SETTINGS_BLOCKED_PATHS_CHANGED` | ConfigManager ✅ |
| **模式管理** | `MOD_LIST`, `MOD_SWITCH`, `MOD_CURRENT` | ModeManager ✅ (agent.ts 已初始化) |
| **模型層級** | `MODEL_SET`, `MODEL_SET_TIER` | ModelRegistry ✅ |
| **技能** | `SKILL_SET_ENABLED` | SkillRegistry ✅ |
| **定時任務** | `CRON_LIST`, `CRON_DELETE`, `CRON_SET_ENABLED` | Scheduler ✅ |
| **頻道/插件** | `CHANNEL_LIST`, `CHANNEL_SET_MAIN`, `CHANNEL_LOGIN`, `CHANNEL_DISCONNECT`, `CHANNEL_PLUGIN_*` x5 | Plugin 系統 ✅ |
| **工作隊列** | `QUEUE_LIST`, `QUEUE_ADD`, `QUEUE_REMOVE`, `WORK_COMPLETE`, `WORK_DELETE` | WorkQueueManager ✅ (agent.ts 已初始化) |
| **認證** | `AUTH_GET`, `AUTH_REFRESH`, `AUTH_SET_TOKENS`, `AUTH_LOGOUT` | ConfigManager ✅ |
| **OAuth** | `OAUTH_LOGIN`, `OAUTH_RESPOND`, `OAUTH_CANCEL` | OAuthManager ✅ (agent.ts 已初始化) |
| **權限** | `PERMISSION_REQUEST`, `PERMISSION_PATH_REQUEST`, `PERMISSION_RESPOND`, `PERMISSION_CANCEL` | PermissionManager ✅ (agent.ts 已初始化) |
| **Mini Window** | `MINI_WINDOW_SEND_MESSAGE`, `MINI_CHAT_SHORTCUT_REGISTER`, `MINI_CHAT_SHORTCUT_GET_STATUS` | MiniWindowManager ✅ (main.ts 已初始化) |
| **視窗管理** | `WINDOW_SHOW_MAIN`, `WINDOW_MINIMIZE`, `WINDOW_HIDE`, `WINDOW_TRAFFIC_LIGHTS` | BrowserWindow API ✅ |
| **語音** | `HOST_STT_CREATE_STREAM`, `HOST_STT_PUSH`, `HOST_STT_FINISH`, `HOST_STT_CANCEL`, `HOST_STT_PARTIAL`, `HOST_TTS_SYNTHESIZE` | VoiceManager ✅ (agent.ts 已初始化，但底層 stub) |
| **診斷** | `DIAGNOSTICS_NETWORK`, `DIAGNOSTICS_UPDATER` | Diagnostics ✅ |
| **儲存** | `STORAGE_GET`, `STORAGE_SET`, `STORAGE_DELETE` | SQLite ✅ |
| **計費** | `BILLING_STATUS`, `BILLING_USAGE`, `BILLING_SUBSCRIBE` | Billing 介面 ✅ |
| **ColaLink** | `COLALINK_PROFILE_*`, `COLALINK_CONTACTS_*`, `COLALINK_MESSAGE_*`, `COLALINK_RELAY_*` x10 | ColaLinkManager ✅ (agent.ts 已初始化) |
| **Agent** | `AGENT_PROMPT`, `AGENT_ABORT`, `AGENT_TEST_CONNECTION` | Agent ✅ |
| **聊天** | `CHAT_STOP`, `CHAT_CLEAR`, `CHAT_NEW` | Agent ✅ |

**影響**：後端功能完整但前端無法調用。用戶看不到這些功能。

**工作量**：中（每個頻道約 10 行程式碼，但需要對應前端 UI）

---

## 🟡 P2 — 中優先級（模組存在但功能不完整）

### 5. CLI Local Server — 部分端點未實現
| 文件 | 行數 | 狀態 |
|------|------|------|
| `cli/local-server.ts` | 337 | 🟡 Session/config 端點標記 TODO |

**影響**：無法通過 HTTP API 控制 Agent（第三方整合受限）

**工作量**：中

---

### 6. 模式系統 — Chat/Coding 模式差異化不足
| 文件 | 狀態 |
|------|------|
| `modes/mode-manager.ts` | ✅ 管理層完整 |
| `modes/chat-mode.ts` | 🟡 基本實現 |
| `modes/coding-mode.ts` | 🟡 基本實現 |

**影響**：Chat/Coding 模式切換現在只是 UI 標籤變化，沒有實質性差異（如 system prompt、溫度、工具集）

**工作量**：小

---

### 7. 前端缺失功能
| 功能 | 後端 | 前端 |
|------|------|------|
| API Key 真實連線測試 | `onboarding-manager.ts` TODO | — |
| 拖放檔案上傳 | 無 | 無 |
| 消息編輯（Edit message） | 無 | 無 |
| 對話分支（Branch conversation） | 無 | 無 |
| Markdown 渲染增強（表格、圖片、連結） | — | 🟡 只支援粗體+代碼 |
| 輸入框 @mention 工具調用 | 無 | 無 |

---

## 🟢 P3 — 低優先級（錦上添花）

### 8. 套件依賴過時
```bash
npm outdated  # 需要檢查
```

### 9. 測試覆蓋率不足
```
266 源文件 vs 5 測試文件
CLAUDE.md: "Test coverage < 80%"
```

### 10. any 類型過多
```
CLAUDE.md: "533 uses of any type"
```

---

## 📊 完整功能矩陣

| 模組 | 後端 | IPC 接線 | 前端 UI | 整體 |
|------|------|---------|---------|------|
| AI 連接器 (7 providers) | ✅ | ✅ | ✅ | ✅ |
| Onboarding | ✅ | ✅ | ✅ | ✅ |
| 主視窗 UI | N/A | ✅ | ✅ | ✅ |
| 全文搜索 | ✅ | ✅ | ✅ | ✅ |
| 通知系統 | ✅ | ✅ | ✅ | ✅ |
| 主題管理 | ✅ | ✅ | ✅ | ✅ |
| 快捷鍵 | N/A | N/A | ✅ | ✅ |
| 代碼高亮 | N/A | N/A | ✅ | ✅ |
| 會話管理 | ✅ | ✅ | ✅ | ✅ |
| 導出 (MD/JSON/TXT) | N/A | N/A | ✅ | ✅ |
| Mini Window | ✅ | 🟡 3/6 | 🟡 | 🟡 |
| Tool Execution | ✅ | ✅ | ❌ | 🟡 |
| 插件系統 | ✅ | 🟡 0/6 | ❌ | 🟡 |
| 定時任務 | ✅ | 🟡 0/3 | ❌ | 🟡 |
| 工作隊列 | ✅ | 🟡 0/5 | ❌ | 🟡 |
| OAuth | ✅ | 🟡 0/3 | ❌ | 🟡 |
| 權限管理 | ✅ | 🟡 0/4 | ❌ | 🟡 |
| ColaLink | ✅ | 🟡 0/10 | ❌ | 🟡 |
| 語音 (VAD/ASR/TTS) | 🔴 | 🟡 0/6 | ❌ | 🔴 |
| 模式差異化 | 🟡 | 🟡 0/3 | ❌ | 🟡 |
| CLI Server | 🟡 | N/A | N/A | 🟡 |
| 沙箱 | 🟡 | N/A | N/A | 🟡 |
| 診斷 | ✅ | 🟡 0/2 | ❌ | 🟡 |
| 計費 | ✅ | 🟡 0/3 | ❌ | 🟡 |
| 儲存 API | ✅ | 🟡 0/3 | ❌ | 🟡 |
| 自動更新 | ✅ | 🟡 | ❌ | 🟡 |
| Gateway | ✅ | ❌ | ❌ | 🟡 |
| 視覺化 | ✅ | ❌ | ❌ | 🟡 |
| 瀏覽器自動化 | ✅ | ❌ | ❌ | 🟡 |
| MCP Server | ✅ | ❌ | ❌ | 🟡 |
| 自學習 | ✅ | ❌ | ❌ | 🟡 |
| 推薦引擎 | ✅ | ❌ | ❌ | 🟡 |
| 程式碼分析 | ✅ | ❌ | ❌ | 🟡 |
| Telemetry | ✅ | ❌ | ❌ | 🟡 |
| i18n | ✅ | ❌ | ❌ | 🟡 |
| Slack 整合 | ✅ | ❌ | ❌ | 🟡 |
| Sentry 監控 | ✅ | ❌ | ❌ | 🟡 |
| 媒體處理 | ✅ | ❌ | ❌ | 🟡 |
| 協作服務 | ✅ | 🟡 部分 | ❌ | 🟡 |
| API Gateway | ✅ | ❌ | ❌ | 🟡 |

---

## 🎯 優先級排序（按實際用戶價值）

| 排名 | 項目 | 工作量 | 用戶價值 | 類型 |
|------|------|--------|---------|------|
| 1 | 補接 91 個 IPC 頻道（先做核心 20 個） | 中 | ⭐⭐⭐⭐⭐ | 後端 |
| 2 | Chat/Coding 模式實質差異化 | 小 | ⭐⭐⭐⭐ | 後端+前端 |
| 3 | Mini Window IPC 完整接線 | 小 | ⭐⭐⭐⭐ | 後端 |
| 4 | Markdown 渲染增強（表格/連結/圖片） | 小 | ⭐⭐⭐⭐ | 前端 |
| 5 | CLI Server 端點補全 | 中 | ⭐⭐⭐ | 後端 |
| 6 | API Key 真實連線測試 | 小 | ⭐⭐⭐ | 後端 |
| 7 | OAuth/權限 IPC 接線 | 中 | ⭐⭐⭐ | 後端 |
| 8 | 插件系統前後端串接 | 中 | ⭐⭐⭐ | 全棧 |
| 9 | 語音功能實現 | 大 | ⭐⭐ | 後端 |
| 10 | ColaLink Signal Protocol | 大 | ⭐⭐ | 後端 |
