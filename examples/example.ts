/**
 * Storage Layer Usage Examples
 *
 * Demonstrates how to use the Nexus storage modules.
 */

import { ChatHistory } from './chat-history';
import { ConfigManager } from './config-manager';
import { ModelRegistry } from './model-registry';
import { DeviceIdentityManager } from './device-identity';
import { join } from 'path';
import { tmpdir } from 'os';

// ============================================================================
// Setup
// ============================================================================

const storageDir = join(tmpdir(), 'nexus-example');
const dbPath = join(storageDir, 'chat-history.db');
const authPath = join(storageDir, 'auth.json');
const settingsPath = join(storageDir, 'settings.json');
const modelsPath = join(storageDir, 'models.json');
const identityPath = join(storageDir, 'identity.json');

// ============================================================================
// Example 1: Chat History
// ============================================================================

export function exampleChatHistory() {
  const chatHistory = new ChatHistory(dbPath);

  // Create session
  chatHistory.createSession({
    id: 'session-001',
    title: 'Test Conversation',
    type: 'chat',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Save messages
  chatHistory.saveMessage({
    id: 'msg-001',
    sessionId: 'session-001',
    role: 'user',
    content: 'Hello, how are you?',
    timestamp: Date.now(),
  });

  chatHistory.saveMessage({
    id: 'msg-002',
    sessionId: 'session-001',
    role: 'assistant',
    content: 'I am doing well, thank you!',
    timestamp: Date.now(),
    metadata: { model: 'claude-3-7-sonnet-20250219', tokens: 15 },
  });

  // Query messages
  const session = chatHistory.getSession('session-001');
  console.log('Session:', session);

  const messages = chatHistory.getMessages('session-001');
  console.log('Messages:', messages);

  // Search
  const searchResults = chatHistory.searchMessages('Hello');
  console.log('Search results:', searchResults);

  chatHistory.close();
}

// ============================================================================
// Example 2: Config Manager
// ============================================================================

export function exampleConfigManager() {
  const password = 'my-secure-password';
  const salt = ConfigManager.generateSalt();
  const configManager = new ConfigManager(password, salt);

  // Save auth config
  configManager.setApiKey(authPath, 'claude', 'sk-ant-xxxxx');
  configManager.setApiKey(authPath, 'openai', 'sk-proj-xxxxx');
  configManager.setToken(authPath, 'github', 'ghp_xxxxx');

  // Load auth config
  const claudeKey = configManager.getApiKey(authPath, 'claude');
  console.log('Claude API Key:', claudeKey);

  const authConfig = configManager.loadAuthConfig(authPath);
  console.log('Full auth config:', authConfig);

  // Save settings
  configManager.saveSettings(settingsPath, {
    model: 'claude-3-7-sonnet-20250219',
    temperature: 0.7,
    maxTokens: 8192,
    streamResponse: true,
    language: 'en',
    theme: 'dark',
  });

  // Update settings
  configManager.updateSettings(settingsPath, {
    theme: 'light',
    temperature: 0.8,
  });

  const settings = configManager.loadSettings(settingsPath);
  console.log('Settings:', settings);
}

// ============================================================================
// Example 3: Model Registry
// ============================================================================

export function exampleModelRegistry() {
  const modelRegistry = new ModelRegistry(modelsPath);

  // Get model info
  const claude = modelRegistry.getModel('claude-3-7-sonnet-20250219');
  console.log('Claude 3.7 Sonnet:', claude);

  // List all models
  const allModels = modelRegistry.getAllModels();
  console.log('Total models:', allModels.length);

  // Get models by provider
  const claudeModels = modelRegistry.getModelsByProvider('claude');
  console.log('Claude models:', claudeModels.map((m) => m.name));

  // Get models by capability
  const visionModels = modelRegistry.getModelsByCapability('vision');
  console.log('Vision models:', visionModels.map((m) => m.name));

  // Calculate cost
  const cost = modelRegistry.calculateCost('claude-3-7-sonnet-20250219', 100000, 50000);
  console.log('Cost for 100k input + 50k output:', `$${cost.toFixed(4)}`);

  // Find cheapest model
  const cheapest = modelRegistry.getCheapestModel();
  console.log('Cheapest model:', cheapest?.name);

  // Add custom model
  modelRegistry.addModel({
    id: 'custom-model',
    name: 'Custom Model',
    provider: 'claude',
    contextWindow: 100000,
    maxOutput: 4096,
    inputPrice: 1.0,
    outputPrice: 5.0,
    capabilities: ['text', 'streaming'],
  });

  // Update pricing
  modelRegistry.bulkUpdatePricing([
    { modelId: 'claude-3-7-sonnet-20250219', inputPrice: 2.5, outputPrice: 12.5 },
  ]);
}

// ============================================================================
// Example 4: Device Identity
// ============================================================================

export function exampleDeviceIdentity() {
  const identityManager = new DeviceIdentityManager(identityPath);

  // Get device ID
  const deviceId = identityManager.getDeviceId();
  console.log('Device ID:', deviceId);

  // Get full identity
  const identity = identityManager.getIdentity();
  console.log('Device identity:', identity);

  // Validate UUID
  const isValid = DeviceIdentityManager.isValidUUID(deviceId);
  console.log('Is valid UUID:', isValid);

  // Update version
  identityManager.updateVersion('2.0.0');

  // Regenerate identity
  const newDeviceId = identityManager.regenerate();
  console.log('New device ID:', newDeviceId);
}

// ============================================================================
// Complete Workflow Example
// ============================================================================

export function completeWorkflowExample() {
  console.log('='.repeat(60));
  console.log('Nexus Storage Layer - Complete Workflow Example');
  console.log('='.repeat(60));

  // 1. Initialize device identity
  console.log('\n1. Device Identity');
  const identityManager = new DeviceIdentityManager(identityPath);
  const deviceId = identityManager.getDeviceId();
  console.log(`   Device ID: ${deviceId}`);

  // 2. Setup config manager
  console.log('\n2. Configuration');
  const configManager = new ConfigManager('my-password', ConfigManager.generateSalt());
  configManager.setApiKey(authPath, 'claude', 'sk-ant-api-key');
  configManager.saveSettings(settingsPath, {
    model: 'claude-3-7-sonnet-20250219',
    temperature: 0.7,
    maxTokens: 8192,
    streamResponse: true,
    language: 'en',
    theme: 'dark',
  });
  console.log('   Auth & settings saved (encrypted)');

  // 3. Load model registry
  console.log('\n3. Model Registry');
  const modelRegistry = new ModelRegistry(modelsPath);
  const settings = configManager.loadSettings(settingsPath);
  const modelConfig = modelRegistry.getModel(settings.model);
  console.log(`   Selected model: ${modelConfig?.name}`);
  console.log(`   Context window: ${modelConfig?.contextWindow.toLocaleString()}`);

  // 4. Create chat session
  console.log('\n4. Chat History');
  const chatHistory = new ChatHistory(dbPath);
  const sessionId = `session-${Date.now()}`;

  chatHistory.createSession({
    id: sessionId,
    title: 'Example Chat',
    type: 'chat',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // 5. Save conversation
  const messages = [
    { role: 'user' as const, content: 'What is the weather today?' },
    { role: 'assistant' as const, content: 'I don\'t have real-time weather data.' },
    { role: 'user' as const, content: 'Can you help me write code?' },
    { role: 'assistant' as const, content: 'Yes, I can help you with coding tasks!' },
  ];

  for (let i = 0; i < messages.length; i++) {
    chatHistory.saveMessage({
      id: `msg-${i + 1}`,
      sessionId,
      role: messages[i].role,
      content: messages[i].content,
      timestamp: Date.now() + i * 1000,
    });
  }

  const messageCount = chatHistory.getMessageCount(sessionId);
  console.log(`   Saved ${messageCount} messages`);

  // 6. Calculate costs
  console.log('\n5. Cost Analysis');
  const totalTokens = { input: 50000, output: 25000 };
  const cost = modelRegistry.calculateCost(settings.model, totalTokens.input, totalTokens.output);
  console.log(`   Tokens: ${totalTokens.input} input + ${totalTokens.output} output`);
  console.log(`   Cost: $${cost.toFixed(4)}`);

  // 7. Cleanup
  chatHistory.close();
  console.log('\n✓ Workflow complete\n');
}

// ============================================================================
// Run examples
// ============================================================================

if (require.main === module) {
  completeWorkflowExample();
}
