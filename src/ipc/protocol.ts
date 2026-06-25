/**
 * IPC Protocol - Type definitions for Electron IPC
 */

import { Message, Session, AgentSettings, ModelConfig } from '../types';

/**
 * IPC Channel names (60+ channels matching Cola)
 */
export const IPC_CHANNELS = {
  // Agent lifecycle
  AGENT_START: 'agent:start',
  AGENT_STOP: 'agent:stop',
  AGENT_STATUS: 'agent:status',
  AGENT_PROMPT: 'agent:prompt',
  AGENT_ABORT: 'agent:abort',
  AGENT_TEST_CONNECTION: 'agent:testConnection',

  // Chat
  CHAT_SEND: 'chat:send',
  CHAT_STREAM: 'chat:stream',
  CHAT_STOP: 'chat:stop',
  CHAT_CLEAR: 'chat:clear',
  CHAT_NEW: 'chat:new',

  // Session
  SESSION_NEW: 'session:new',
  SESSION_LIST: 'session:list',
  SESSION_GET: 'session:get',
  SESSION_DELETE: 'session:delete',
  SESSION_RENAME: 'session:rename',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_RESET: 'settings:reset',
  SETTINGS_SAVE: 'settings:save',
  SETTINGS_REFRESH_AUTH_BACKEND: 'settings:refreshAuthBacked',
  SETTINGS_BLOCKED_PATHS_CHANGED: 'settings:blocked-paths-changed',

  // Themes
  THEMES_LOAD: 'themes:load',
  THEMES_SAVE: 'themes:save',

  // Modes
  MOD_LIST: 'mod:list',
  MOD_SWITCH: 'mod:switch',
  MOD_CURRENT: 'mod:current',

  // Models
  MODELS_LIST: 'models:list',
  MODELS_SWITCH: 'models:switch',
  MODEL_SET: 'model:set',
  MODEL_SET_TIER: 'model:setTier',

  // Skills
  SKILLS_LIST: 'skills:list',
  SKILLS_ENABLE: 'skills:enable',
  SKILLS_DISABLE: 'skills:disable',
  SKILL_SET_ENABLED: 'skill:setEnabled',

  // Cron/Scheduled tasks
  CRON_LIST: 'cron:list',
  CRON_DELETE: 'cron:delete',
  CRON_SET_ENABLED: 'cron:setEnabled',

  // Channels
  CHANNEL_LIST: 'channel:list',
  CHANNEL_SET_MAIN: 'channel:setMain',
  CHANNEL_LOGIN: 'channel:login',
  CHANNEL_DISCONNECT: 'channel:disconnect',
  CHANNEL_PLUGIN_LIST: 'channel:plugin.list',
  CHANNEL_PLUGIN_INSTALL: 'channel:plugin.install',
  CHANNEL_PLUGIN_UNINSTALL: 'channel:plugin.uninstall',
  CHANNEL_PLUGIN_CONFIG: 'channel:plugin.config',
  CHANNEL_PLUGIN_LOGIN: 'channel:plugin.login',

  // Work queue
  QUEUE_LIST: 'queue:list',
  QUEUE_ADD: 'queue:add',
  QUEUE_REMOVE: 'queue:remove',
  WORK_COMPLETE: 'work:complete',
  WORK_DELETE: 'work:delete',

  // Auth
  AUTH_GET: 'auth:get',
  AUTH_REFRESH: 'auth:refresh',
  AUTH_SET_TOKENS: 'auth:setTokens',
  AUTH_LOGOUT: 'auth:logout',

  // OAuth
  OAUTH_LOGIN: 'oauth:login',
  OAUTH_RESPOND: 'oauth:respond',
  OAUTH_CANCEL: 'oauth:cancel',

  // Permission
  PERMISSION_REQUEST: 'permission:request',
  PERMISSION_PATH_REQUEST: 'permission:path-request',
  PERMISSION_RESPOND: 'permission:respond',
  PERMISSION_CANCEL: 'permission:cancel',

  // Mini Window
  MINI_WINDOW_SHOW: 'mini-window:show',
  MINI_WINDOW_HIDE: 'mini-window:hide',
  MINI_WINDOW_TOGGLE: 'mini-window:toggle',
  MINI_WINDOW_SEND_MESSAGE: 'mini-window:send-message',
  MINI_CHAT_SHORTCUT_REGISTER: 'mini-chat-shortcut:register',
  MINI_CHAT_SHORTCUT_GET_STATUS: 'mini-chat-shortcut:get-status',

  // Window management
  WINDOW_SHOW_MAIN: 'window:show-main',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_HIDE: 'window:hide',
  WINDOW_TRAFFIC_LIGHTS: 'window:traffic-lights',

  // Speech (STT/TTS)
  HOST_STT_CREATE_STREAM: 'host:stt-createStream',
  HOST_STT_PUSH: 'host:stt-push',
  HOST_STT_FINISH: 'host:stt-finish',
  HOST_STT_CANCEL: 'host:stt-cancel',
  HOST_STT_PARTIAL: 'host:stt-partial',
  HOST_TTS_SYNTHESIZE: 'host:tts-synthesize',

  // Diagnostics
  DIAGNOSTICS_NETWORK: 'diagnostics:network',
  DIAGNOSTICS_UPDATER: 'diagnostics:updater',

  // Storage
  STORAGE_GET: 'storage:get',
  STORAGE_SET: 'storage:set',
  STORAGE_DELETE: 'storage:delete',

  // Billing
  BILLING_STATUS: 'billing:status',
  BILLING_USAGE: 'billing:usage',
  BILLING_SUBSCRIBE: 'billing:subscribe',

  // ColaLink (social)
  COLALINK_PROFILE_GET: 'colaLink:profile-get',
  COLALINK_PROFILE_UPDATE: 'colaLink:profile-update',
  COLALINK_CONTACTS_LIST: 'colaLink:contacts-list',
  COLALINK_CONTACTS_ADD: 'colaLink:contacts-add',
  COLALINK_CONTACTS_DELETE: 'colaLink:contacts-delete',
  COLALINK_CONTACTS_BLOCK: 'colaLink:contacts-block',
  COLALINK_MESSAGE_SEND: 'colaLink:message-send',
  COLALINK_MESSAGE_HISTORY: 'colaLink:message-history',
  COLALINK_RELAY_CONNECT: 'colaLink:relay-connect',
  COLALINK_RELAY_DISCONNECT: 'colaLink:relay-disconnect',

  // Files
  FILE_UPLOAD: 'file:upload',
  FILE_DELETE: 'file:delete',

  // Onboarding
  ONBOARDING_GET_STATUS: 'onboarding:getStatus',
  ONBOARDING_GET_PROGRESS: 'onboarding:getProgress',
  ONBOARDING_NEXT_STEP: 'onboarding:nextStep',
  ONBOARDING_SKIP_STEP: 'onboarding:skipStep',
  ONBOARDING_VALIDATE_API_KEY: 'onboarding:validateApiKey',
  ONBOARDING_SAVE_API_KEY: 'onboarding:saveApiKey',
  ONBOARDING_SAVE_MODEL: 'onboarding:saveModel',
  ONBOARDING_COMPLETE: 'onboarding:complete',
  ONBOARDING_SKIP: 'onboarding:skip',
  ONBOARDING_RESET: 'onboarding:reset',

  // Events (renderer <- main)
  EVENT_MESSAGE: 'event:message',
  EVENT_STREAM_CHUNK: 'event:stream-chunk',
  EVENT_STREAM_END: 'event:stream-end',
  EVENT_ERROR: 'event:error',
  EVENT_STATUS_CHANGE: 'event:status-change',
  EVENT_QUEUE_UPDATED: 'event:queue-updated',
  EVENT_PERMISSION_REQUEST: 'event:permission-request'
} as const;

/**
 * IPC Request base
 */
export interface IPCRequest<T = any> {
  id: string;
  channel: string;
  data: T;
}

/**
 * IPC Response base
 */
export interface IPCResponse<T = any> {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Chat send request
 */
export interface ChatSendRequest {
  message: string;
  sessionId?: string;
  attachments?: Array<{
    type: 'image' | 'file' | 'audio';
    path: string;
  }>;
}

/**
 * Chat send response
 */
export interface ChatSendResponse {
  message: Message;
  sessionId: string;
}

/**
 * Chat stream request
 */
export interface ChatStreamRequest {
  message: string;
  sessionId?: string;
}

/**
 * Chat stream chunk event
 */
export interface ChatStreamChunk {
  type: 'text' | 'tool-call' | 'thinking';
  content: string;
  sessionId: string;
}

/**
 * Session new response
 */
export interface SessionNewResponse {
  sessionId: string;
}

/**
 * Session list response
 */
export interface SessionListResponse {
  sessions: Session[];
}

/**
 * Session get request
 */
export interface SessionGetRequest {
  sessionId: string;
}

/**
 * Session get response
 */
export interface SessionGetResponse {
  session: Session;
}

/**
 * Session delete request
 */
export interface SessionDeleteRequest {
  sessionId: string;
}

/**
 * Session rename request
 */
export interface SessionRenameRequest {
  sessionId: string;
  title: string;
}

/**
 * Settings get response
 */
export interface SettingsGetResponse {
  settings: AgentSettings;
}

/**
 * Settings update request
 */
export interface SettingsUpdateRequest {
  settings: Partial<AgentSettings>;
}

/**
 * Models list response
 */
export interface ModelsListResponse {
  models: ModelConfig[];
  currentModel: string;
}

/**
 * Models switch request
 */
export interface ModelsSwitchRequest {
  modelId: string;
}

/**
 * Skills list response
 */
export interface SkillsListResponse {
  skills: Array<{
    id: string;
    name: string;
    enabled: boolean;
  }>;
}

/**
 * Skills enable request
 */
export interface SkillsEnableRequest {
  skillId: string;
}

/**
 * Skills disable request
 */
export interface SkillsDisableRequest {
  skillId: string;
}

/**
 * File upload request
 */
export interface FileUploadRequest {
  path: string;
  type: 'image' | 'file' | 'audio';
}

/**
 * File upload response
 */
export interface FileUploadResponse {
  id: string;
  url: string;
  size: number;
}

/**
 * Agent status response
 */
export interface AgentStatusResponse {
  isProcessing: boolean;
  currentSessionId: string;
  uptime: number;
}

/**
 * Error event
 */
export interface ErrorEvent {
  message: string;
  code?: string;
  stack?: string;
}

/**
 * Status change event
 */
export interface StatusChangeEvent {
  isProcessing: boolean;
  sessionId: string;
}

/**
 * Theme configuration
 */
export interface ThemeConfig {
  mode: 'light' | 'dark' | 'auto';
  primaryColor?: string;
  accentColor?: string;
  customCSS?: string;
}

/**
 * Mode configuration
 */
export interface ModeConfig {
  id: string;
  name: string;
  description: string;
  soulPath?: string;
  icon?: string;
}

/**
 * Work item
 */
export interface WorkItem {
  id: string;
  type: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'running' | 'completed' | 'failed';
  data: any;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

/**
 * Permission request
 */
export interface PermissionRequest {
  id: string;
  type: 'file' | 'directory' | 'network';
  path: string;
  operation: 'read' | 'write' | 'execute';
  reason?: string;
}

/**
 * Permission response
 */
export interface PermissionResponse {
  id: string;
  granted: boolean;
  remember?: boolean;
}

/**
 * OAuth credentials
 */
export interface OAuthCredentials {
  provider: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

/**
 * Diagnostics result
 */
export interface DiagnosticsResult {
  timestamp: number;
  network: {
    latency: number;
    bandwidth: number;
    dnsResolution: boolean;
  };
  storage: {
    totalSpace: number;
    freeSpace: number;
    usedSpace: number;
  };
  models: {
    provider: string;
    available: boolean;
    latency?: number;
  }[];
}

/**
 * Billing status
 */
export interface BillingStatus {
  subscription: 'free' | 'pro' | 'team';
  usage: {
    tokens: number;
    requests: number;
    resetAt: number;
  };
  quota: {
    tokens: number;
    requests: number;
  };
}

/**
 * Queue list response
 */
export interface QueueListResponse {
  items: WorkItem[];
  total: number;
  pending: number;
  running: number;
}

/**
 * Shortcut status
 */
export interface ShortcutStatus {
  registered: boolean;
  shortcut: string;
  enabled: boolean;
}

/**
 * Onboarding status response
 */
export interface OnboardingStatusResponse {
  isNeeded: boolean;
  currentStep?: string;
  completedSteps: string[];
  totalSteps: number;
}

/**
 * Onboarding progress response
 */
export interface OnboardingProgressResponse {
  currentStep: string;
  completedSteps: string[];
  totalSteps: number;
  percentComplete: number;
}

/**
 * Validate API key request
 */
export interface ValidateAPIKeyRequest {
  provider: string;
  apiKey: string;
}

/**
 * Validate API key response
 */
export interface ValidateAPIKeyResponse {
  provider: string;
  valid: boolean;
  error?: string;
  model?: string;
}

/**
 * Save API key request
 */
export interface SaveAPIKeyRequest {
  provider: string;
  apiKey: string;
}

/**
 * Save model request
 */
export interface SaveModelRequest {
  modelId: string;
}

/**
 * Complete onboarding request
 */
export interface CompleteOnboardingRequest {
  selectedProviders: string[];
  defaultModel: string;
  language: 'en' | 'zh';
  theme: 'light' | 'dark' | 'auto';
  tourCompleted: boolean;
  completedAt: number;
}

