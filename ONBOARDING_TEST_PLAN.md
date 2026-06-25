# Onboarding Testing Plan

## 准备工作

### 1. 设置环境变量
```bash
export NODE_ENV=development
export ENCRYPTION_PASSWORD=test-password-123
```

### 2. 清除已有配置（模拟首次启动）
```bash
# 找到 userData 目录
# Linux: ~/.config/Electron/
# macOS: ~/Library/Application Support/Electron/
# Windows: %APPDATA%\Electron\

# 备份（如果需要）
mv ~/.config/Electron ~/.config/Electron.backup

# 或直接删除配置文件
rm -f ~/.config/Electron/settings.json
rm -f ~/.config/Electron/auth.json
```

### 3. 启动应用
```bash
npm run start:dev
```

---

## 测试场景

### ✅ Scenario 1: 首次启动显示 Onboarding

**期望行为**:
1. 启动应用
2. 自动显示 Onboarding 窗口（900x700px）
3. 显示 Welcome 步骤
4. 进度条显示 20%（1/5）

**验证点**:
- [ ] Onboarding 窗口出现
- [ ] 主窗口不出现
- [ ] Welcome 步骤显示正确（3 个 feature cards）
- [ ] "Get Started" 和 "Skip Setup" 按钮可见

---

### ✅ Scenario 2: API Keys 配置流程

**操作步骤**:
1. 点击 "Get Started"
2. 进入 API Keys 步骤
3. 勾选 Claude provider checkbox
4. 输入测试 API Key: `sk-ant-api03-test123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890`
5. 点击 "Validate" 按钮

**期望行为**:
- [ ] 进度条变为 40%（2/5）
- [ ] Checkbox 勾选后显示输入框
- [ ] 输入框类型为 password（隐藏内容）
- [ ] 验证按钮变为 "Validating..."
- [ ] 显示验证结果（✓ Valid 或 Invalid + 错误信息）
- [ ] "Continue" 按钮启用（至少一个 provider 验证成功）

**已知问题**:
- 目前只验证格式，不验证真实 API 连接
- 如果格式不对会显示 "Invalid format. Should start with sk-ant-api03-"

---

### ✅ Scenario 3: Model Selection

**操作步骤**:
1. 点击 "Continue"
2. 进入 Model Selection 步骤
3. 选择一个模型（点击 model card）

**期望行为**:
- [ ] 进度条变为 60%（3/5）
- [ ] 显示已配置 provider 的模型列表
- [ ] Model cards 动态生成（只显示已配置的 providers）
- [ ] 点击后 card 显示蓝色边框（selected 状态）
- [ ] "Continue" 按钮启用

---

### ✅ Scenario 4: Quick Tour

**操作步骤**:
1. 点击 "Continue"
2. 阅读 Quick Tour（或跳过）
3. 点击 "Finish Setup" 或 "Skip Tour"

**期望行为**:
- [ ] 进度条变为 80%（4/5）
- [ ] 显示 3 个 tour items
- [ ] 两个按钮都能完成 onboarding

---

### ✅ Scenario 5: Completion & Launch

**操作步骤**:
1. 完成 Quick Tour
2. 查看 Completion summary
3. 点击 "Launch Aether"

**期望行为**:
- [ ] 进度条变为 100%（5/5）
- [ ] 显示成功图标（✓）
- [ ] Summary 显示配置信息（providers 数量、默认模型）
- [ ] 点击后 Onboarding 窗口关闭
- [ ] 主窗口自动打开

---

### ✅ Scenario 6: 第二次启动跳过 Onboarding

**操作步骤**:
1. 关闭应用
2. 再次启动 `npm start`

**期望行为**:
- [ ] 不显示 Onboarding 窗口
- [ ] 直接显示主窗口
- [ ] 配置已保存（在 settings.json 中）

---

### ✅ Scenario 7: Skip Onboarding 流程

**操作步骤**:
1. 清除配置重新启动
2. 在 Welcome 步骤点击 "Skip Setup"
3. 确认 dialog

**期望行为**:
- [ ] 显示确认 dialog: "Are you sure you want to skip setup?"
- [ ] 点击 OK 后 Onboarding 窗口关闭
- [ ] 主窗口打开
- [ ] 配置中标记 `onboarding.skipped: true`

---

## 潜在问题排查

### Issue: Onboarding 窗口不显示
**检查**:
1. 是否有 renderer/onboarding.html 文件？
2. main.js 是否正确加载？`loadFile(join(__dirname, '../renderer/onboarding.html'))`
3. 路径是否正确？（开发环境 vs 生产环境）

### Issue: API Key 验证失败
**检查**:
1. 格式是否匹配？查看 `onboarding-manager.ts` 中的正则表达式
2. IPC 通信是否正常？检查 console 错误

### Issue: 窗口关闭后主窗口不打开
**检查**:
1. main.ts 中的事件监听是否正确？
2. `onboarding-completed` 事件是否触发？
3. `createWindow()` 是否被调用？

### Issue: 配置未保存
**检查**:
1. ENCRYPTION_PASSWORD 是否设置？
2. userData 目录是否可写？
3. ConfigManager 是否正确初始化？

---

## 预期日志输出

**正常启动流程**:
```
[Main] Agent initialized
[Main] Onboarding manager initialized
[Main] IPC handlers registered
[Main] First launch detected, showing onboarding
[Main] Onboarding window created
[OnboardingManager] Onboarding: moved to step api-keys
[OnboardingManager] API key saved for provider: claude
[OnboardingManager] Default model set to: claude-3-7-sonnet-20250219
[OnboardingManager] Onboarding completed successfully
[Main] Onboarding completed, closing onboarding window
[Main] Main window created
```

---

## 测试完成标准

✅ 所有 7 个场景通过
✅ 无 console 错误
✅ 配置正确保存
✅ UI 样式符合 design_sense
✅ 第二次启动跳过 onboarding

---

**Darling，我已经准备好测试计划了！现在我无法直接运行 Electron 应用（需要图形界面），你可以按照上面的步骤测试。遇到任何问题告诉我，我会立即修复！** 🌺
