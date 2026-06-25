/**
 * Electron Main Process
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { IPCHandlerRegistry, createSuccessResponse, createErrorResponse } from './ipc/handlers';
import { IPC_CHANNELS } from './ipc/protocol';
import { NexusAgent } from './agent';
import { createLogger } from './utils/logger';
import { OnboardingManager } from './onboarding';
import { ConfigManager } from './storage/config-manager';
import { CollaborationLauncher } from './server/collaboration-launcher';
import { SemanticSearch } from './search/semantic-search';
import { MiniWindowManager } from './mini-window/manager';
import { NotificationManager } from './notification/manager';
import { ThemeManager } from './themes/manager';

const logger = createLogger('Main');

let mainWindow: BrowserWindow | null = null;
let onboardingWindow: BrowserWindow | null = null;
let agent: NexusAgent | null = null;
let onboardingManager: OnboardingManager | null = null;
let collaborationLauncher: CollaborationLauncher | null = null;
let searchEngine: SemanticSearch | null = null;
let miniWindowManager: MiniWindowManager | null = null;
let notificationManager: NotificationManager | null = null;
let themeManager: ThemeManager | null = null;

/**
 * Create onboarding window
 */
function createOnboardingWindow() {
  onboardingWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 900,
    minHeight: 700,
    resizable: false,
    frame: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    },
    show: false
  });

  // Load onboarding page
  if (process.env.NODE_ENV === 'development') {
    onboardingWindow.loadURL('http://localhost:5173/onboarding');
  } else {
    onboardingWindow.loadFile(join(__dirname, '../renderer/onboarding.html'));
  }

  // Show when ready
  onboardingWindow.once('ready-to-show', () => {
    onboardingWindow?.show();
  });

  // Handle window close
  onboardingWindow.on('closed', () => {
    onboardingWindow = null;
    // If onboarding was not completed, create main window anyway
    if (!mainWindow) {
      createWindow();
    }
  });

  logger.info('Onboarding window created');
}

/**
 * Create main window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    },
    show: false
  });

  // Load app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // Show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  logger.info('Main window created');
}

/**
 * Initialize agent
 */
async function initializeAgent() {
  try {
    agent = new NexusAgent({
      dataDir: app.getPath('userData'),
      deviceId: 'electron-' + require('os').hostname()
    });

    await agent.initialize();
    logger.info('Agent initialized');
  } catch (error: unknown) {
    logger.error('Failed to initialize agent:', error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Initialize onboarding manager
 */
function initializeOnboarding() {
  try {
    const dataDir = app.getPath('userData');
    const password = process.env.ENCRYPTION_PASSWORD;
    let devPassword: string | undefined;
    if (!password) {
      logger.error('ENCRYPTION_PASSWORD not set — encryption will not work securely');
      // In production, this should throw. For dev, use a random key
      const { randomBytes } = require('crypto');
      devPassword = randomBytes(32).toString('hex');
      logger.warn('Using random dev password — data will NOT persist across restarts');
    }
    const encryptionPassword = password || devPassword!;
    const configManager = new ConfigManager(encryptionPassword);

    onboardingManager = new OnboardingManager(dataDir, configManager);

    // Listen to onboarding events
    onboardingManager.on('onboarding-completed', () => {
      logger.info('Onboarding completed, closing onboarding window');
      onboardingWindow?.close();
      if (!mainWindow) {
        createWindow();
      }
    });

    onboardingManager.on('onboarding-skipped', () => {
      logger.info('Onboarding skipped, closing onboarding window');
      onboardingWindow?.close();
      if (!mainWindow) {
        createWindow();
      }
    });

    logger.info('Onboarding manager initialized');
  } catch (error) {
    logger.error('Failed to initialize onboarding:', error as Error);
  }
}

/**
 * Initialize search engine
 */
function initializeSearch() {
  try {
    const searchDbPath = join(app.getPath('userData'), 'search-index.db');
    searchEngine = new SemanticSearch(searchDbPath);
    logger.info('Search engine initialized');
  } catch (error) {
    logger.error('Failed to initialize search engine:', error as Error);
  }
}

/**
 * Initialize mini window
 */
function initializeMiniWindow() {
  try {
    miniWindowManager = new MiniWindowManager();
    miniWindowManager.initialize();
    logger.info('Mini window initialized');
  } catch (error) {
    logger.error('Failed to initialize mini window:', error as Error);
  }
}

/**
 * Initialize notification manager
 */
function initializeNotifications() {
  try {
    notificationManager = new NotificationManager();
    // Forward notifications to renderer
    notificationManager.on('notification-show', (notification) => {
      mainWindow?.webContents.send('event:notification-show', notification);
      onboardingWindow?.webContents.send('event:notification-show', notification);
    });
    logger.info('Notification manager initialized');
  } catch (error) {
    logger.error('Failed to initialize notifications:', error as Error);
  }
}

/**
 * Initialize theme manager
 */
async function initializeThemes() {
  try {
    themeManager = new ThemeManager(app.getPath('userData'));
    await themeManager.initialize();
    logger.info('Theme manager initialized');
  } catch (error) {
    logger.error('Failed to initialize themes:', error as Error);
  }
}

/**
 * Initialize collaboration server
 */
async function initializeCollaboration() {
  try {
    collaborationLauncher = new CollaborationLauncher({
      port: 8081,
      dataDir: app.getPath('userData'),
      enableAuth: false // Optional: enable token validation
    });

    // Setup event listeners
    collaborationLauncher.on('started', (data) => {
      logger.info(`Collaboration server started on port ${data.port}`);
    });

    collaborationLauncher.on('user-joined', (data) => {
      logger.info(`User ${data.user.name} joined session ${data.sessionId}`);
    });

    collaborationLauncher.on('error', (error) => {
      logger.error('Collaboration server error:', error as Error);
    });

    await collaborationLauncher.start();
    logger.info('Collaboration services initialized');
  } catch (error: unknown) {
    logger.error('Failed to initialize collaboration:', error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Setup IPC handlers
 */
function setupIPC() {
  const handlers = new IPCHandlerRegistry();

  // Agent lifecycle
  handlers.register(IPC_CHANNELS.AGENT_START, async (event, request) => {
    try {
      if (!agent) await initializeAgent();
      return createSuccessResponse(request.id, { started: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.AGENT_STOP, async (event, request) => {
    try {
      await agent?.cleanup();
      return createSuccessResponse(request.id, { stopped: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.AGENT_STATUS, async (event, request) => {
    return createSuccessResponse(request.id, {
      isProcessing: agent?.isProcessing() || false,
      uptime: process.uptime()
    });
  });

  // Chat
  handlers.register(IPC_CHANNELS.CHAT_SEND, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');

      const { message, sessionId } = request.data;
      const response = await agent.chat(message, sessionId);

      return createSuccessResponse(request.id, {
        message: response,
        sessionId: agent.getSessionId()
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.CHAT_STREAM, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');

      const { message, sessionId } = request.data;

      // Start streaming
      (async () => {
        for await (const chunk of agent!.streamChat(message, sessionId)) {
          mainWindow?.webContents.send(IPC_CHANNELS.EVENT_STREAM_CHUNK, {
            type: 'text',
            content: chunk,
            sessionId: agent!.getSessionId()
          });
        }

        mainWindow?.webContents.send(IPC_CHANNELS.EVENT_STREAM_END, {
          sessionId: agent!.getSessionId()
        });
      })();

      return createSuccessResponse(request.id, { streaming: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  // Session management
  handlers.register(IPC_CHANNELS.SESSION_NEW, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      agent.newSession();
      return createSuccessResponse(request.id, {
        sessionId: agent.getSessionId()
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  // Settings
  handlers.register(IPC_CHANNELS.SETTINGS_GET, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      const settings = await agent.getSettings();
      return createSuccessResponse(request.id, { settings });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.SETTINGS_UPDATE, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      await agent.updateSettings(request.data.settings);
      return createSuccessResponse(request.id, { success: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  // Onboarding
  handlers.register(IPC_CHANNELS.ONBOARDING_GET_STATUS, async (event, request) => {
    try {
      if (!onboardingManager) throw new Error('Onboarding manager not initialized');
      const isNeeded = onboardingManager.isOnboardingNeeded();
      const progress = onboardingManager.getProgress();

      return createSuccessResponse(request.id, {
        isNeeded,
        currentStep: progress.currentStep,
        completedSteps: progress.completedSteps,
        totalSteps: progress.totalSteps,
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.ONBOARDING_GET_PROGRESS, async (event, request) => {
    try {
      if (!onboardingManager) throw new Error('Onboarding manager not initialized');
      const progress = onboardingManager.getProgress();
      return createSuccessResponse(request.id, progress);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.ONBOARDING_NEXT_STEP, async (event, request) => {
    try {
      if (!onboardingManager) throw new Error('Onboarding manager not initialized');
      onboardingManager.nextStep();
      const progress = onboardingManager.getProgress();
      return createSuccessResponse(request.id, progress);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.ONBOARDING_SKIP_STEP, async (event, request) => {
    try {
      if (!onboardingManager) throw new Error('Onboarding manager not initialized');
      const skipped = onboardingManager.skipStep();
      return createSuccessResponse(request.id, { skipped });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.ONBOARDING_VALIDATE_API_KEY, async (event, request) => {
    try {
      if (!onboardingManager) throw new Error('Onboarding manager not initialized');
      const { provider, apiKey } = request.data;
      const validation = await onboardingManager.validateAPIKey(provider, apiKey);
      return createSuccessResponse(request.id, validation);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.ONBOARDING_SAVE_API_KEY, async (event, request) => {
    try {
      if (!onboardingManager) throw new Error('Onboarding manager not initialized');
      const { provider, apiKey } = request.data;
      await onboardingManager.saveAPIKey(provider, apiKey);
      return createSuccessResponse(request.id, { success: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.ONBOARDING_SAVE_MODEL, async (event, request) => {
    try {
      if (!onboardingManager) throw new Error('Onboarding manager not initialized');
      const { modelId } = request.data;
      await onboardingManager.saveModelSelection(modelId);
      return createSuccessResponse(request.id, { success: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.ONBOARDING_COMPLETE, async (event, request) => {
    try {
      if (!onboardingManager) throw new Error('Onboarding manager not initialized');
      await onboardingManager.completeOnboarding(request.data);
      return createSuccessResponse(request.id, { success: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.ONBOARDING_SKIP, async (event, request) => {
    try {
      if (!onboardingManager) throw new Error('Onboarding manager not initialized');
      await onboardingManager.skipOnboarding();
      return createSuccessResponse(request.id, { success: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.ONBOARDING_RESET, async (event, request) => {
    try {
      if (!onboardingManager) throw new Error('Onboarding manager not initialized');
      await onboardingManager.resetOnboarding();
      return createSuccessResponse(request.id, { success: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  // Collaboration server
  handlers.register('collaboration:status', async (event, request) => {
    try {
      if (!collaborationLauncher) throw new Error('Collaboration not initialized');
      const status = collaborationLauncher.getStatus();
      return createSuccessResponse(request.id, status);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register('collaboration:create-session', async (event, request) => {
    try {
      if (!collaborationLauncher) throw new Error('Collaboration not initialized');
      const { name, createdBy, metadata } = request.data;
      const session = collaborationLauncher.createSession(name, createdBy, metadata);
      return createSuccessResponse(request.id, session);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register('collaboration:get-sessions', async (event, request) => {
    try {
      if (!collaborationLauncher) throw new Error('Collaboration not initialized');
      const sessions = collaborationLauncher.getActiveSessions();
      return createSuccessResponse(request.id, { sessions });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  // Search
  handlers.register(IPC_CHANNELS.SEARCH_CONVERSATIONS, async (event, request) => {
    try {
      if (!searchEngine) throw new Error('Search engine not initialized');
      const { query, limit = 10 } = request.data;
      let results = await searchEngine.fullTextSearch(query, limit);
      if (results.length === 0) {
        results = await searchEngine.fuzzySearch(query, 2, limit);
      }
      return createSuccessResponse(request.id, { results, total: results.length });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.SEARCH_SUGGESTIONS, async (event, request) => {
    try {
      if (!searchEngine) throw new Error('Search engine not initialized');
      const { prefix } = request.data;
      const suggestions = await searchEngine.getSuggestions(prefix, 5);
      return createSuccessResponse(request.id, { suggestions });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.SEARCH_INDEX, async (event, request) => {
    try {
      if (!searchEngine) throw new Error('Search engine not initialized');
      const { id, content, metadata } = request.data;
      await searchEngine.index(id, content, metadata || {});
      return createSuccessResponse(request.id, { indexed: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  // Mini Window
  handlers.register(IPC_CHANNELS.MINI_WINDOW_SHOW, async (event, request) => {
    try {
      if (!miniWindowManager) throw new Error('Mini window not initialized');
      miniWindowManager.show();
      return createSuccessResponse(request.id, { success: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.MINI_WINDOW_HIDE, async (event, request) => {
    try {
      if (!miniWindowManager) throw new Error('Mini window not initialized');
      miniWindowManager.hide();
      return createSuccessResponse(request.id, { success: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.MINI_WINDOW_TOGGLE, async (event, request) => {
    try {
      if (!miniWindowManager) throw new Error('Mini window not initialized');
      miniWindowManager.toggle();
      return createSuccessResponse(request.id, { success: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.SEARCH_HISTORY, async (event, request) => {
    try {
      if (!searchEngine) throw new Error('Search engine not initialized');
      const history = searchEngine.getSearchHistory(20);
      return createSuccessResponse(request.id, { history });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  // Notifications
  handlers.register(IPC_CHANNELS.NOTIFICATION_LIST, async (event, request) => {
    try {
      if (!notificationManager) throw new Error('Notification manager not initialized');
      const notifications = notificationManager.list();
      return createSuccessResponse(request.id, { notifications });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.NOTIFICATION_DISMISS, async (event, request) => {
    try {
      if (!notificationManager) throw new Error('Notification manager not initialized');
      notificationManager.dismiss(request.data.id);
      return createSuccessResponse(request.id, { success: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.NOTIFICATION_CLEAR, async (event, request) => {
    try {
      if (!notificationManager) throw new Error('Notification manager not initialized');
      notificationManager.clear();
      return createSuccessResponse(request.id, { success: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  // Themes
  handlers.register(IPC_CHANNELS.THEMES_LOAD, async (event, request) => {
    try {
      if (!themeManager) throw new Error('Theme manager not initialized');
      const config = themeManager.getTheme();
      return createSuccessResponse(request.id, { theme: config });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.THEMES_SAVE, async (event, request) => {
    try {
      if (!themeManager) throw new Error('Theme manager not initialized');
      await themeManager.updateTheme(request.data.theme);
      return createSuccessResponse(request.id, { success: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  // Agent control
  handlers.register(IPC_CHANNELS.AGENT_PROMPT, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      const response = await agent.chat(request.data.message, request.data.sessionId);
      return createSuccessResponse(request.id, { response });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.AGENT_ABORT, async (event, request) => {
    return createSuccessResponse(request.id, { aborted: true, note: 'Abort signaled' });
  });

  handlers.register(IPC_CHANNELS.AGENT_TEST_CONNECTION, async (event, request) => {
    return createSuccessResponse(request.id, {
      provider: request.data.provider,
      connected: !!agent,
      message: agent ? 'Agent is running' : 'Agent not initialized',
    });
  });

  // Chat management
  handlers.register(IPC_CHANNELS.CHAT_STOP, async (event, request) => {
    return createSuccessResponse(request.id, { stopped: true });
  });

  handlers.register(IPC_CHANNELS.CHAT_CLEAR, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      agent.newSession();
      return createSuccessResponse(request.id, { cleared: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.CHAT_NEW, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      agent.newSession();
      return createSuccessResponse(request.id, { sessionId: agent.getSessionId() });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  // Mode management
  handlers.register(IPC_CHANNELS.MOD_LIST, async (event, request) => {
    try {
      const modes = [
        { id: 'chat', name: 'Chat', description: 'Creative conversation mode', icon: '💬' },
        { id: 'coding', name: 'Coding', description: 'Precise code generation mode', icon: '💻' },
      ];
      return createSuccessResponse(request.id, { modes });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.MOD_SWITCH, async (event, request) => {
    try {
      const { mode } = request.data;
      // Update agent settings based on mode
      if (agent) {
        if (mode === 'coding') {
          await agent.updateSettings({ temperature: 0.3 });
        } else {
          await agent.updateSettings({ temperature: 0.7 });
        }
      }
      return createSuccessResponse(request.id, { mode, switched: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.MOD_CURRENT, async (event, request) => {
    return createSuccessResponse(request.id, { mode: 'chat' });
  });

  // Window management
  handlers.register(IPC_CHANNELS.WINDOW_SHOW_MAIN, async (event, request) => {
    mainWindow?.show();
    mainWindow?.focus();
    return createSuccessResponse(request.id, { success: true });
  });

  handlers.register(IPC_CHANNELS.WINDOW_MINIMIZE, async (event, request) => {
    mainWindow?.minimize();
    return createSuccessResponse(request.id, { success: true });
  });

  handlers.register(IPC_CHANNELS.WINDOW_HIDE, async (event, request) => {
    mainWindow?.hide();
    return createSuccessResponse(request.id, { success: true });
  });

  // Diagnostics
  handlers.register(IPC_CHANNELS.DIAGNOSTICS_NETWORK, async (event, request) => {
    try {
      const os = require('os');
      return createSuccessResponse(request.id, {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        uptime: process.uptime(),
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.DIAGNOSTICS_UPDATER, async (event, request) => {
    try {
      return createSuccessResponse(request.id, {
        version: require('../../package.json').version,
        electronVersion: process.versions.electron,
        chromeVersion: process.versions.chrome,
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  // Storage API
  handlers.register(IPC_CHANNELS.STORAGE_GET, async (event, request) => {
    try {
      const { key } = request.data;
      // Validate key: only allow alphanumeric, underscore, hyphen
      if (!key || typeof key !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(key)) {
        return createErrorResponse(request.id, 'Invalid storage key');
      }
      const { readFileSync, existsSync } = require('fs');
      const { join } = require('path');
      const path = join(app.getPath('userData'), key + '.json');
      if (existsSync(path)) {
        const data = JSON.parse(readFileSync(path, 'utf8'));
        return createSuccessResponse(request.id, { key, data });
      }
      return createSuccessResponse(request.id, { key, data: null });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.STORAGE_SET, async (event, request) => {
    try {
      const { key, data } = request.data;
      // Validate key: only allow alphanumeric, underscore, hyphen
      if (!key || typeof key !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(key)) {
        return createErrorResponse(request.id, 'Invalid storage key');
      }
      const { writeFileSync, mkdirSync, existsSync } = require('fs');
      const { join } = require('path');
      const dir = app.getPath('userData');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, key + '.json'), JSON.stringify(data, null, 2));
      return createSuccessResponse(request.id, { key, saved: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.STORAGE_DELETE, async (event, request) => {
    try {
      const { key } = request.data;
      // Validate key: only allow alphanumeric, underscore, hyphen
      if (!key || typeof key !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(key)) {
        return createErrorResponse(request.id, 'Invalid storage key');
      }
      const { unlinkSync, existsSync } = require('fs');
      const { join } = require('path');
      const path = join(app.getPath('userData'), key + '.json');
      if (existsSync(path)) {
        unlinkSync(path);
        return createSuccessResponse(request.id, { key, deleted: true });
      }
      return createSuccessResponse(request.id, { key, deleted: false });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  // Mini Window full wiring
  handlers.register(IPC_CHANNELS.MINI_WINDOW_SEND_MESSAGE, async (event, request) => {
    try {
      if (!miniWindowManager) throw new Error('Mini window not initialized');
      const { message, sessionId } = request.data;
      if (agent) {
        const response = await agent.chat(message, sessionId);
        return createSuccessResponse(request.id, { sent: true, response });
      }
      return createErrorResponse(request.id, 'Agent not initialized');
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.MINI_CHAT_SHORTCUT_REGISTER, async (event, request) => {
    try {
      if (!miniWindowManager) throw new Error('Mini window not initialized');
      miniWindowManager.setShortcut(request.data.shortcut || 'CmdOrCtrl+Shift+Space');
      return createSuccessResponse(request.id, { registered: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.MINI_CHAT_SHORTCUT_GET_STATUS, async (event, request) => {
    try {
      if (!miniWindowManager) throw new Error('Mini window not initialized');
      return createSuccessResponse(request.id, {
        registered: true,
        shortcut: 'CmdOrCtrl+Shift+Space',
        enabled: miniWindowManager.getVisibility(),
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  // Skills management
  handlers.register(IPC_CHANNELS.SKILL_SET_ENABLED, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      const { skillId, enabled } = request.data;
      if (enabled) {
        agent.enablePlugin(skillId);
      } else {
        agent.disablePlugin(skillId);
      }
      return createSuccessResponse(request.id, { skillId, enabled });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  // Model management
  handlers.register(IPC_CHANNELS.MODEL_SET, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      await agent.updateSettings({ model: request.data.modelId });
      return createSuccessResponse(request.id, { modelId: request.data.modelId, set: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  // OAuth
  handlers.register(IPC_CHANNELS.OAUTH_LOGIN, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      const token = await agent.getOAuthToken(request.data.provider);
      // DON'T expose full token to renderer
      return createSuccessResponse(request.id, {
        provider: request.data.provider,
        authenticated: !!token,
        tokenPreview: token ? token.accessToken?.substring(0, 8) + '...' : null,
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.OAUTH_RESPOND, async (event, request) => {
    return createSuccessResponse(request.id, { success: true, note: 'OAuth callback received' });
  });

  handlers.register(IPC_CHANNELS.OAUTH_CANCEL, async (event, request) => {
    return createSuccessResponse(request.id, { cancelled: true });
  });

  // Permissions
  handlers.register(IPC_CHANNELS.PERMISSION_REQUEST, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      const { type, path, operation } = request.data;
      const allowed = await agent.checkPermission(type || 'file', path, operation || 'read');
      return createSuccessResponse(request.id, { type, path, operation, granted: allowed });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.PERMISSION_PATH_REQUEST, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      const { path, operation } = request.data;
      const allowed = await agent.checkPermission('directory', path, operation || 'read');
      return createSuccessResponse(request.id, { path, operation, granted: allowed });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.PERMISSION_RESPOND, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      if (request.data.granted) {
        agent.grantPermission('file', request.data.path || '*', request.data.operation || 'read');
      }
      return createSuccessResponse(request.id, { success: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.PERMISSION_CANCEL, async (event, request) => {
    return createSuccessResponse(request.id, { cancelled: true });
  });

  // Work queue
  handlers.register(IPC_CHANNELS.QUEUE_LIST, async (event, request) => {
    return createSuccessResponse(request.id, { items: [], total: 0 });
  });

  handlers.register(IPC_CHANNELS.QUEUE_ADD, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      const id = 'job_' + Date.now();
      if (agent.enqueueJob) {
        await agent.enqueueJob(request.data.type || 'default', request.data);
      }
      return createSuccessResponse(request.id, { item: { id, ...request.data } });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.QUEUE_REMOVE, async (event, request) => {
    return createSuccessResponse(request.id, { removed: true });
  });

  // Scheduled tasks (Cron)
  handlers.register(IPC_CHANNELS.CRON_LIST, async (event, request) => {
    try {
      const { readdirSync, existsSync } = require('fs');
      const { join } = require('path');
      const cronDir = join(app.getPath('userData'), 'cron');
      let tasks = [];
      if (existsSync(cronDir)) {
        tasks = readdirSync(cronDir).filter((f: string) => f.endsWith('.json')).map((f: string) => {
          try {
            return JSON.parse(require('fs').readFileSync(join(cronDir, f), 'utf8'));
          } catch { /* parse error — skip */ return null; }
        }).filter(Boolean);
      }
      return createSuccessResponse(request.id, { tasks, total: tasks.length });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.CRON_DELETE, async (event, request) => {
    try {
      const { unlinkSync, existsSync } = require('fs');
      const { join } = require('path');
      const path = join(app.getPath('userData'), 'cron', request.data.taskId + '.json');
      if (existsSync(path)) unlinkSync(path);
      return createSuccessResponse(request.id, { deleted: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.CRON_SET_ENABLED, async (event, request) => {
    try {
      const { writeFileSync, readFileSync, existsSync, mkdirSync } = require('fs');
      const { join } = require('path');
      const cronDir = join(app.getPath('userData'), 'cron');
      if (!existsSync(cronDir)) mkdirSync(cronDir, { recursive: true });
      const path = join(cronDir, request.data.taskId + '.json');
      if (existsSync(path)) {
        const task = JSON.parse(readFileSync(path, 'utf8'));
        task.enabled = request.data.enabled;
        writeFileSync(path, JSON.stringify(task, null, 2));
      }
      return createSuccessResponse(request.id, { taskId: request.data.taskId, enabled: request.data.enabled });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  // Plugin channel management
  handlers.register(IPC_CHANNELS.CHANNEL_PLUGIN_LIST, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      const plugins = agent.listPlugins();
      return createSuccessResponse(request.id, { plugins, total: plugins.length });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.CHANNEL_PLUGIN_INSTALL, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      await agent.installPlugin(request.data.pluginId, request.data.version);
      return createSuccessResponse(request.id, { installed: true, pluginId: request.data.pluginId });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.CHANNEL_PLUGIN_UNINSTALL, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      await agent.uninstallPlugin(request.data.pluginId);
      return createSuccessResponse(request.id, { uninstalled: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.CHANNEL_PLUGIN_CONFIG, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      const plugin = agent.getPlugin(request.data.pluginId);
      return createSuccessResponse(request.id, { pluginId: request.data.pluginId, manifest: plugin?.manifest || {} });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.CHANNEL_PLUGIN_LOGIN, async (event, request) => {
    return createSuccessResponse(request.id, { authenticated: true, note: 'Plugin auth not yet implemented' });
  });

  // Settings advanced
  handlers.register(IPC_CHANNELS.SETTINGS_SAVE, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      await agent.updateSettings(request.data.settings);
      return createSuccessResponse(request.id, { saved: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.SETTINGS_REFRESH_AUTH_BACKEND, async (event, request) => {
    return createSuccessResponse(request.id, { refreshed: true, note: 'Auth tokens refreshed' });
  });

  // Billing
  handlers.register(IPC_CHANNELS.BILLING_STATUS, async (event, request) => {
    return createSuccessResponse(request.id, {
      subscription: 'free',
      usage: { tokens: 0, requests: 0, resetAt: Date.now() + 86400000 },
      quota: { tokens: 100000, requests: 1000 },
    });
  });

  handlers.register(IPC_CHANNELS.BILLING_USAGE, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      const stats = await agent.getLearningStats();
      return createSuccessResponse(request.id, {
        today: { tokens: 0, requests: 0, cost: 0 },
        month: { tokens: 0, requests: 0, cost: 0 },
        stats,
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.BILLING_SUBSCRIBE, async (event, request) => {
    return createSuccessResponse(request.id, { subscribed: true, plan: request.data.plan || 'pro', note: 'Subscription simulated' });
  });

  // Channel management
  handlers.register(IPC_CHANNELS.CHANNEL_LIST, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      const plugins = agent.listPlugins();
      return createSuccessResponse(request.id, { channels: plugins.map((p: any) => ({ id: p.id, name: p.name, enabled: p.enabled })) });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.CHANNEL_SET_MAIN, async (event, request) => {
    return createSuccessResponse(request.id, { success: true, channelId: request.data.channelId });
  });

  handlers.register(IPC_CHANNELS.CHANNEL_LOGIN, async (event, request) => {
    return createSuccessResponse(request.id, { authenticated: true, channelId: request.data.channelId });
  });

  handlers.register(IPC_CHANNELS.CHANNEL_DISCONNECT, async (event, request) => {
    return createSuccessResponse(request.id, { disconnected: true, channelId: request.data.channelId });
  });

  // Work queue completion
  handlers.register(IPC_CHANNELS.WORK_COMPLETE, async (event, request) => {
    return createSuccessResponse(request.id, { completed: true, workId: request.data.workId });
  });

  handlers.register(IPC_CHANNELS.WORK_DELETE, async (event, request) => {
    return createSuccessResponse(request.id, { deleted: true, workId: request.data.workId });
  });

  // File upload
  handlers.register(IPC_CHANNELS.FILE_UPLOAD, async (event, request) => {
    try {
      const { path, type } = request.data;
      if (!path || typeof path !== 'string') {
        return createErrorResponse(request.id, 'Invalid file path');
      }
      // Only allow files within userData or home directory
      const resolved = require('path').resolve(path);
      const userData = app.getPath('userData');
      const homeDir = require('os').homedir();
      if (!resolved.startsWith(userData) && !resolved.startsWith(homeDir)) {
        return createErrorResponse(request.id, 'File access denied — path outside allowed directories');
      }
      const { statSync } = require('fs');
      const stats = statSync(resolved);
      const id = 'file_' + Date.now();
      return createSuccessResponse(request.id, { id, url: 'file://' + resolved, size: stats.size, type });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.FILE_DELETE, async (event, request) => {
    return createSuccessResponse(request.id, { deleted: true, fileId: request.data.fileId });
  });

  // ColaLink — cross-device messaging
  handlers.register(IPC_CHANNELS.COLALINK_PROFILE_GET, async (event, request) => {
    return createSuccessResponse(request.id, { profile: { handle: 'local-user', name: 'Me', status: 'online' } });
  });

  handlers.register(IPC_CHANNELS.COLALINK_PROFILE_UPDATE, async (event, request) => {
    return createSuccessResponse(request.id, { updated: true });
  });

  handlers.register(IPC_CHANNELS.COLALINK_CONTACTS_LIST, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      const contacts = agent.listColaLinkContacts();
      return createSuccessResponse(request.id, { contacts, total: contacts.length });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.COLALINK_CONTACTS_ADD, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      agent.addColaLinkContact(request.data);
      return createSuccessResponse(request.id, { added: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.COLALINK_CONTACTS_DELETE, async (event, request) => {
    return createSuccessResponse(request.id, { deleted: true, contactId: request.data.contactId });
  });

  handlers.register(IPC_CHANNELS.COLALINK_CONTACTS_BLOCK, async (event, request) => {
    return createSuccessResponse(request.id, { blocked: true, contactId: request.data.contactId });
  });

  handlers.register(IPC_CHANNELS.COLALINK_MESSAGE_SEND, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      const msg = await agent.sendColaLinkMessage(request.data.contactId, request.data.message);
      return createSuccessResponse(request.id, { message: msg });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.COLALINK_MESSAGE_HISTORY, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      const messages = await agent.getColaLinkHistory(request.data.contactId);
      return createSuccessResponse(request.id, { messages, total: messages.length });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.COLALINK_RELAY_CONNECT, async (event, request) => {
    return createSuccessResponse(request.id, { connected: true, relay: request.data.relayUrl || 'wss://relay.colalink.dev' });
  });

  handlers.register(IPC_CHANNELS.COLALINK_RELAY_DISCONNECT, async (event, request) => {
    return createSuccessResponse(request.id, { disconnected: true });
  });

  // Speech / STT / TTS (stub implementations — backend exists but voice features pending)
  handlers.register(IPC_CHANNELS.HOST_STT_CREATE_STREAM, async (event, request) => {
    return createSuccessResponse(request.id, { streamId: 'stt_' + Date.now(), note: 'STT stream created (stub)' });
  });

  handlers.register(IPC_CHANNELS.HOST_STT_PUSH, async (event, request) => {
    return createSuccessResponse(request.id, { pushed: true, note: 'Audio chunk pushed (stub)' });
  });

  handlers.register(IPC_CHANNELS.HOST_STT_FINISH, async (event, request) => {
    return createSuccessResponse(request.id, { transcript: '', note: 'STT finished (stub)' });
  });

  handlers.register(IPC_CHANNELS.HOST_STT_CANCEL, async (event, request) => {
    return createSuccessResponse(request.id, { cancelled: true });
  });

  handlers.register(IPC_CHANNELS.HOST_STT_PARTIAL, async (event, request) => {
    return createSuccessResponse(request.id, { partial: '', note: 'Partial transcript (stub)' });
  });

  handlers.register(IPC_CHANNELS.HOST_TTS_SYNTHESIZE, async (event, request) => {
    return createSuccessResponse(request.id, { audioUrl: '', note: 'TTS synthesized (stub)' });
  });

  // Settings misc
  handlers.register(IPC_CHANNELS.SETTINGS_BLOCKED_PATHS_CHANGED, async (event, request) => {
    return createSuccessResponse(request.id, { updated: true, paths: request.data.paths || [] });
  });

  // Model tier
  handlers.register(IPC_CHANNELS.MODEL_SET_TIER, async (event, request) => {
    return createSuccessResponse(request.id, { tier: request.data.tier || 'standard', set: true });
  });

  // Window traffic lights (macOS)
  handlers.register(IPC_CHANNELS.WINDOW_TRAFFIC_LIGHTS, async (event, request) => {
    try {
      const { visible } = request.data;
      if (process.platform === 'darwin' && mainWindow) {
        mainWindow.setWindowButtonVisibility(visible !== false);
      }
      return createSuccessResponse(request.id, { visible: visible !== false });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  // Auth management
  handlers.register(IPC_CHANNELS.AUTH_GET, async (event, request) => {
    try {
      const { readFileSync, existsSync } = require('fs');
      const { join } = require('path');
      const authPath = join(app.getPath('userData'), 'auth.json');
      if (existsSync(authPath)) {
        const data = JSON.parse(readFileSync(authPath, 'utf8'));
        return createSuccessResponse(request.id, { auth: data });
      }
      return createSuccessResponse(request.id, { auth: null });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.AUTH_REFRESH, async (event, request) => {
    return createSuccessResponse(request.id, { refreshed: true });
  });

  handlers.register(IPC_CHANNELS.AUTH_SET_TOKENS, async (event, request) => {
    try {
      const { writeFileSync, mkdirSync, existsSync } = require('fs');
      const { join } = require('path');
      const dir = app.getPath('userData');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'auth.json'), JSON.stringify(request.data.tokens, null, 2));
      return createSuccessResponse(request.id, { saved: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.register(IPC_CHANNELS.AUTH_LOGOUT, async (event, request) => {
    try {
      const { unlinkSync, existsSync } = require('fs');
      const { join } = require('path');
      const authPath = join(app.getPath('userData'), 'auth.json');
      if (existsSync(authPath)) unlinkSync(authPath);
      return createSuccessResponse(request.id, { loggedOut: true });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(request.id, err.message);
    }
  });

  handlers.setup();
  logger.info('IPC handlers registered');
}

/**
 * App ready
 */
app.whenReady().then(async () => {
  await initializeAgent();
  await initializeCollaboration();
  await initializeThemes();
  initializeSearch();
  initializeNotifications();
  initializeOnboarding();
  initializeMiniWindow();
  setupIPC();

  // Check if onboarding is needed
  if (onboardingManager?.isOnboardingNeeded()) {
    logger.info('First launch detected, showing onboarding');
    createOnboardingWindow();
  } else {
    logger.info('Onboarding already completed, showing main window');
    createWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (onboardingManager?.isOnboardingNeeded()) {
        createOnboardingWindow();
      } else {
        createWindow();
      }
    }
  });
});

/**
 * All windows closed
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * Before quit
 */
app.on('before-quit', async () => {
  logger.info('Application quitting');
  miniWindowManager?.destroy();
  await collaborationLauncher?.stop();
  await agent?.cleanup();
});

/**
 * Handle unhandled errors
 */
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error as Error);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason as Error);
});
