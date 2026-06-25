/**
 * IPC Renderer - Renderer process IPC interface
 */

import { ipcRenderer, IpcRendererEvent } from 'electron';
import { IPCRequest, IPCResponse, IPC_CHANNELS } from './protocol';
import { generateUuid } from '../utils/crypto';

export type EventCallback<T = any> = (data: T) => void;

/**
 * IPC Client for renderer process
 */
export class IPCClient {
  private eventListeners = new Map<string, Set<EventCallback>>();

  /**
   * Invoke IPC request
   */
  async invoke<Req = any, Res = any>(
    channel: string,
    data: Req
  ): Promise<Res> {
    const request: IPCRequest<Req> = {
      id: generateUuid(),
      channel,
      data
    };

    const response: IPCResponse<Res> = await ipcRenderer.invoke(channel, request);

    if (!response.success) {
      throw new Error(response.error || 'IPC request failed');
    }

    return response.data!;
  }

  /**
   * Listen to event from main process
   */
  on<T = any>(channel: string, callback: EventCallback<T>): void {
    if (!this.eventListeners.has(channel)) {
      this.eventListeners.set(channel, new Set());

      // Setup IPC listener
      ipcRenderer.on(channel, (_event: IpcRendererEvent, data: T) => {
        const callbacks = this.eventListeners.get(channel);
        if (callbacks) {
          for (const cb of callbacks) {
            cb(data);
          }
        }
      });
    }

    this.eventListeners.get(channel)!.add(callback);
  }

  /**
   * Remove event listener
   */
  off<T = any>(channel: string, callback: EventCallback<T>): void {
    const callbacks = this.eventListeners.get(channel);
    if (callbacks) {
      callbacks.delete(callback);

      if (callbacks.size === 0) {
        this.eventListeners.delete(channel);
        ipcRenderer.removeAllListeners(channel);
      }
    }
  }

  /**
   * Remove all listeners for channel
   */
  removeAllListeners(channel: string): void {
    this.eventListeners.delete(channel);
    ipcRenderer.removeAllListeners(channel);
  }
}

/**
 * Create IPC client instance
 */
export function createIPCClient(): IPCClient {
  return new IPCClient();
}

/**
 * Preload script API - exposed to renderer via contextBridge
 */
export interface PreloadAPI {
  // Agent
  startAgent: () => Promise<void>;
  stopAgent: () => Promise<void>;
  getAgentStatus: () => Promise<any>;

  // Chat
  sendMessage: (message: string, sessionId?: string) => Promise<any>;
  streamChat: (message: string, sessionId?: string) => Promise<void>;
  stopChat: () => Promise<void>;
  clearChat: () => Promise<void>;

  // Session
  newSession: () => Promise<{ sessionId: string }>;
  listSessions: () => Promise<any>;
  getSession: (sessionId: string) => Promise<any>;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, title: string) => Promise<void>;

  // Settings
  getSettings: () => Promise<any>;
  updateSettings: (settings: any) => Promise<void>;
  resetSettings: () => Promise<void>;

  // Models
  listModels: () => Promise<any>;
  switchModel: (modelId: string) => Promise<void>;

  // Skills
  listSkills: () => Promise<any>;
  enableSkill: (skillId: string) => Promise<void>;
  disableSkill: (skillId: string) => Promise<void>;

  // Onboarding
  getOnboardingStatus: () => Promise<any>;
  getOnboardingProgress: () => Promise<any>;
  nextOnboardingStep: () => Promise<any>;
  skipOnboardingStep: () => Promise<any>;
  validateAPIKey: (provider: string, apiKey: string) => Promise<any>;
  saveAPIKey: (provider: string, apiKey: string) => Promise<void>;
  saveModel: (modelId: string) => Promise<void>;
  completeOnboarding: (data: any) => Promise<void>;
  skipOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;

  // Agent control
  testConnection: (provider: string) => Promise<any>;
  abortAgent: () => Promise<void>;

  // Mode
  listModes: () => Promise<any>;
  switchMode: (mode: string) => Promise<any>;
  getCurrentMode: () => Promise<any>;

  // Window
  showMainWindow: () => Promise<void>;
  minimizeWindow: () => Promise<void>;
  hideWindow: () => Promise<void>;

  // Diagnostics
  getNetworkDiagnostics: () => Promise<any>;
  getUpdaterDiagnostics: () => Promise<any>;

  // Storage
  storageGet: (key: string) => Promise<any>;
  storageSet: (key: string, data: any) => Promise<void>;
  storageDelete: (key: string) => Promise<void>;

  // Skills
  setSkillEnabled: (skillId: string, enabled: boolean) => Promise<void>;

  // Model
  setModel: (modelId: string) => Promise<void>;

  // Plugin channel
  listChannelPlugins: () => Promise<any>;
  installChannelPlugin: (pluginId: string, version?: string) => Promise<any>;
  uninstallChannelPlugin: (pluginId: string) => Promise<any>;
  getChannelPluginConfig: (pluginId: string) => Promise<any>;

  // Settings advanced
  saveSettings: (settings: any) => Promise<void>;
  refreshAuth: () => Promise<void>;

  // Billing
  getBillingStatus: () => Promise<any>;
  getBillingUsage: () => Promise<any>;
  subscribePlan: (plan: string) => Promise<any>;

  // Search
  searchConversations: (query: string, limit?: number) => Promise<any>;
  getSearchSuggestions: (prefix: string) => Promise<any>;
  indexContent: (id: string, content: string, metadata?: any) => Promise<any>;
  getSearchHistory: () => Promise<any>;

  // Notifications
  listNotifications: () => Promise<any>;
  dismissNotification: (id: string) => Promise<void>;

  // Themes
  loadTheme: () => Promise<any>;
  saveTheme: (config: any) => Promise<void>;

  // Events
  onMessage: (callback: EventCallback) => void;
  onStreamChunk: (callback: EventCallback) => void;
  onStreamEnd: (callback: EventCallback) => void;
  onError: (callback: EventCallback) => void;
  onStatusChange: (callback: EventCallback) => void;
}

/**
 * Create preload API implementation
 */
export function createPreloadAPI(client: IPCClient): PreloadAPI {
  return {
    // Agent
    startAgent: () => client.invoke(IPC_CHANNELS.AGENT_START, {}),
    stopAgent: () => client.invoke(IPC_CHANNELS.AGENT_STOP, {}),
    getAgentStatus: () => client.invoke(IPC_CHANNELS.AGENT_STATUS, {}),

    // Chat
    sendMessage: (message, sessionId) =>
      client.invoke(IPC_CHANNELS.CHAT_SEND, { message, sessionId }),
    streamChat: (message, sessionId) =>
      client.invoke(IPC_CHANNELS.CHAT_STREAM, { message, sessionId }),
    stopChat: () => client.invoke(IPC_CHANNELS.CHAT_STOP, {}),
    clearChat: () => client.invoke(IPC_CHANNELS.CHAT_CLEAR, {}),

    // Session
    newSession: () => client.invoke(IPC_CHANNELS.SESSION_NEW, {}),
    listSessions: () => client.invoke(IPC_CHANNELS.SESSION_LIST, {}),
    getSession: (sessionId) => client.invoke(IPC_CHANNELS.SESSION_GET, { sessionId }),
    deleteSession: (sessionId) => client.invoke(IPC_CHANNELS.SESSION_DELETE, { sessionId }),
    renameSession: (sessionId, title) =>
      client.invoke(IPC_CHANNELS.SESSION_RENAME, { sessionId, title }),

    // Settings
    getSettings: () => client.invoke(IPC_CHANNELS.SETTINGS_GET, {}),
    updateSettings: (settings) => client.invoke(IPC_CHANNELS.SETTINGS_UPDATE, { settings }),
    resetSettings: () => client.invoke(IPC_CHANNELS.SETTINGS_RESET, {}),

    // Models
    listModels: () => client.invoke(IPC_CHANNELS.MODELS_LIST, {}),
    switchModel: (modelId) => client.invoke(IPC_CHANNELS.MODELS_SWITCH, { modelId }),

    // Skills
    listSkills: () => client.invoke(IPC_CHANNELS.SKILLS_LIST, {}),
    enableSkill: (skillId) => client.invoke(IPC_CHANNELS.SKILLS_ENABLE, { skillId }),
    disableSkill: (skillId) => client.invoke(IPC_CHANNELS.SKILLS_DISABLE, { skillId }),

    // Onboarding
    getOnboardingStatus: () => client.invoke(IPC_CHANNELS.ONBOARDING_GET_STATUS, {}),
    getOnboardingProgress: () => client.invoke(IPC_CHANNELS.ONBOARDING_GET_PROGRESS, {}),
    nextOnboardingStep: () => client.invoke(IPC_CHANNELS.ONBOARDING_NEXT_STEP, {}),
    skipOnboardingStep: () => client.invoke(IPC_CHANNELS.ONBOARDING_SKIP_STEP, {}),
    validateAPIKey: (provider, apiKey) =>
      client.invoke(IPC_CHANNELS.ONBOARDING_VALIDATE_API_KEY, { provider, apiKey }),
    saveAPIKey: (provider, apiKey) =>
      client.invoke(IPC_CHANNELS.ONBOARDING_SAVE_API_KEY, { provider, apiKey }),
    saveModel: (modelId) =>
      client.invoke(IPC_CHANNELS.ONBOARDING_SAVE_MODEL, { modelId }),
    completeOnboarding: (data) =>
      client.invoke(IPC_CHANNELS.ONBOARDING_COMPLETE, data),
    skipOnboarding: () =>
      client.invoke(IPC_CHANNELS.ONBOARDING_SKIP, {}),
    resetOnboarding: () =>
      client.invoke(IPC_CHANNELS.ONBOARDING_RESET, {}),

    // Search
    searchConversations: (query, limit = 10) =>
      client.invoke(IPC_CHANNELS.SEARCH_CONVERSATIONS, { query, limit }),
    getSearchSuggestions: (prefix) =>
      client.invoke(IPC_CHANNELS.SEARCH_SUGGESTIONS, { prefix }),
    indexContent: (id, content, metadata) =>
      client.invoke(IPC_CHANNELS.SEARCH_INDEX, { id, content, metadata }),
    getSearchHistory: () =>
      client.invoke(IPC_CHANNELS.SEARCH_HISTORY, {}),

    // Notifications
    listNotifications: () =>
      client.invoke(IPC_CHANNELS.NOTIFICATION_LIST, {}),
    dismissNotification: (id) =>
      client.invoke(IPC_CHANNELS.NOTIFICATION_DISMISS, { id }),

    // Themes
    loadTheme: () =>
      client.invoke(IPC_CHANNELS.THEMES_LOAD, {}),
    saveTheme: (config) =>
      client.invoke(IPC_CHANNELS.THEMES_SAVE, { theme: config }),

    // Agent control
    testConnection: (provider) =>
      client.invoke(IPC_CHANNELS.AGENT_TEST_CONNECTION, { provider }),
    abortAgent: () =>
      client.invoke(IPC_CHANNELS.AGENT_ABORT, {}),

    // Mode
    listModes: () =>
      client.invoke(IPC_CHANNELS.MOD_LIST, {}),
    switchMode: (mode) =>
      client.invoke(IPC_CHANNELS.MOD_SWITCH, { mode }),
    getCurrentMode: () =>
      client.invoke(IPC_CHANNELS.MOD_CURRENT, {}),

    // Window
    showMainWindow: () =>
      client.invoke(IPC_CHANNELS.WINDOW_SHOW_MAIN, {}),
    minimizeWindow: () =>
      client.invoke(IPC_CHANNELS.WINDOW_MINIMIZE, {}),
    hideWindow: () =>
      client.invoke(IPC_CHANNELS.WINDOW_HIDE, {}),

    // Diagnostics
    getNetworkDiagnostics: () =>
      client.invoke(IPC_CHANNELS.DIAGNOSTICS_NETWORK, {}),
    getUpdaterDiagnostics: () =>
      client.invoke(IPC_CHANNELS.DIAGNOSTICS_UPDATER, {}),

    // Storage
    storageGet: (key) =>
      client.invoke(IPC_CHANNELS.STORAGE_GET, { key }),
    storageSet: (key, data) =>
      client.invoke(IPC_CHANNELS.STORAGE_SET, { key, data }),
    storageDelete: (key) =>
      client.invoke(IPC_CHANNELS.STORAGE_DELETE, { key }),

    // Skills
    setSkillEnabled: (skillId, enabled) =>
      client.invoke(IPC_CHANNELS.SKILL_SET_ENABLED, { skillId, enabled }),

    // Model
    setModel: (modelId) =>
      client.invoke(IPC_CHANNELS.MODEL_SET, { modelId }),

    // Plugin channel
    listChannelPlugins: () =>
      client.invoke(IPC_CHANNELS.CHANNEL_PLUGIN_LIST, {}),
    installChannelPlugin: (pluginId: string, version?: string) =>
      client.invoke(IPC_CHANNELS.CHANNEL_PLUGIN_INSTALL, { pluginId, version }),
    uninstallChannelPlugin: (pluginId: string) =>
      client.invoke(IPC_CHANNELS.CHANNEL_PLUGIN_UNINSTALL, { pluginId }),
    getChannelPluginConfig: (pluginId: string) =>
      client.invoke(IPC_CHANNELS.CHANNEL_PLUGIN_CONFIG, { pluginId }),

    // Settings advanced
    saveSettings: (settings: any) =>
      client.invoke(IPC_CHANNELS.SETTINGS_SAVE, { settings }),
    refreshAuth: () =>
      client.invoke(IPC_CHANNELS.SETTINGS_REFRESH_AUTH_BACKEND, {}),

    // Billing
    getBillingStatus: () =>
      client.invoke(IPC_CHANNELS.BILLING_STATUS, {}),
    getBillingUsage: () =>
      client.invoke(IPC_CHANNELS.BILLING_USAGE, {}),
    subscribePlan: (plan: string) =>
      client.invoke(IPC_CHANNELS.BILLING_SUBSCRIBE, { plan }),

    // Events
    onMessage: (callback) => client.on(IPC_CHANNELS.EVENT_MESSAGE, callback),
    onStreamChunk: (callback) => client.on(IPC_CHANNELS.EVENT_STREAM_CHUNK, callback),
    onStreamEnd: (callback) => client.on(IPC_CHANNELS.EVENT_STREAM_END, callback),
    onError: (callback) => client.on(IPC_CHANNELS.EVENT_ERROR, callback),
    onStatusChange: (callback) => client.on(IPC_CHANNELS.EVENT_STATUS_CHANGE, callback)
  };
}
