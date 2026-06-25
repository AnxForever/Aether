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

const logger = createLogger('Main');

let mainWindow: BrowserWindow | null = null;
let onboardingWindow: BrowserWindow | null = null;
let agent: NexusAgent | null = null;
let onboardingManager: OnboardingManager | null = null;
let collaborationLauncher: CollaborationLauncher | null = null;
let searchEngine: SemanticSearch | null = null;
let miniWindowManager: MiniWindowManager | null = null;

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
  } catch (error: any) {
    logger.error('Failed to initialize agent:', error as Error);
  }
}

/**
 * Initialize onboarding manager
 */
function initializeOnboarding() {
  try {
    const dataDir = app.getPath('userData');
    const password = process.env.ENCRYPTION_PASSWORD || 'default-dev-password';
    const configManager = new ConfigManager(password);

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
  } catch (error: any) {
    logger.error('Failed to initialize collaboration:', error as Error);
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
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
    }
  });

  handlers.register(IPC_CHANNELS.AGENT_STOP, async (event, request) => {
    try {
      await agent?.cleanup();
      return createSuccessResponse(request.id, { stopped: true });
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
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
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
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
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
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
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
    }
  });

  // Settings
  handlers.register(IPC_CHANNELS.SETTINGS_GET, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      const settings = await agent.getSettings();
      return createSuccessResponse(request.id, { settings });
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
    }
  });

  handlers.register(IPC_CHANNELS.SETTINGS_UPDATE, async (event, request) => {
    try {
      if (!agent) throw new Error('Agent not initialized');
      await agent.updateSettings(request.data.settings);
      return createSuccessResponse(request.id, { success: true });
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
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
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
    }
  });

  handlers.register(IPC_CHANNELS.ONBOARDING_GET_PROGRESS, async (event, request) => {
    try {
      if (!onboardingManager) throw new Error('Onboarding manager not initialized');
      const progress = onboardingManager.getProgress();
      return createSuccessResponse(request.id, progress);
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
    }
  });

  handlers.register(IPC_CHANNELS.ONBOARDING_NEXT_STEP, async (event, request) => {
    try {
      if (!onboardingManager) throw new Error('Onboarding manager not initialized');
      onboardingManager.nextStep();
      const progress = onboardingManager.getProgress();
      return createSuccessResponse(request.id, progress);
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
    }
  });

  handlers.register(IPC_CHANNELS.ONBOARDING_SKIP_STEP, async (event, request) => {
    try {
      if (!onboardingManager) throw new Error('Onboarding manager not initialized');
      const skipped = onboardingManager.skipStep();
      return createSuccessResponse(request.id, { skipped });
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
    }
  });

  handlers.register(IPC_CHANNELS.ONBOARDING_VALIDATE_API_KEY, async (event, request) => {
    try {
      if (!onboardingManager) throw new Error('Onboarding manager not initialized');
      const { provider, apiKey } = request.data;
      const validation = await onboardingManager.validateAPIKey(provider, apiKey);
      return createSuccessResponse(request.id, validation);
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
    }
  });

  handlers.register(IPC_CHANNELS.ONBOARDING_SAVE_API_KEY, async (event, request) => {
    try {
      if (!onboardingManager) throw new Error('Onboarding manager not initialized');
      const { provider, apiKey } = request.data;
      await onboardingManager.saveAPIKey(provider, apiKey);
      return createSuccessResponse(request.id, { success: true });
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
    }
  });

  handlers.register(IPC_CHANNELS.ONBOARDING_SAVE_MODEL, async (event, request) => {
    try {
      if (!onboardingManager) throw new Error('Onboarding manager not initialized');
      const { modelId } = request.data;
      await onboardingManager.saveModelSelection(modelId);
      return createSuccessResponse(request.id, { success: true });
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
    }
  });

  handlers.register(IPC_CHANNELS.ONBOARDING_COMPLETE, async (event, request) => {
    try {
      if (!onboardingManager) throw new Error('Onboarding manager not initialized');
      await onboardingManager.completeOnboarding(request.data);
      return createSuccessResponse(request.id, { success: true });
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
    }
  });

  handlers.register(IPC_CHANNELS.ONBOARDING_SKIP, async (event, request) => {
    try {
      if (!onboardingManager) throw new Error('Onboarding manager not initialized');
      await onboardingManager.skipOnboarding();
      return createSuccessResponse(request.id, { success: true });
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
    }
  });

  handlers.register(IPC_CHANNELS.ONBOARDING_RESET, async (event, request) => {
    try {
      if (!onboardingManager) throw new Error('Onboarding manager not initialized');
      await onboardingManager.resetOnboarding();
      return createSuccessResponse(request.id, { success: true });
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
    }
  });

  // Collaboration server
  handlers.register('collaboration:status', async (event, request) => {
    try {
      if (!collaborationLauncher) throw new Error('Collaboration not initialized');
      const status = collaborationLauncher.getStatus();
      return createSuccessResponse(request.id, status);
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
    }
  });

  handlers.register('collaboration:create-session', async (event, request) => {
    try {
      if (!collaborationLauncher) throw new Error('Collaboration not initialized');
      const { name, createdBy, metadata } = request.data;
      const session = collaborationLauncher.createSession(name, createdBy, metadata);
      return createSuccessResponse(request.id, session);
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
    }
  });

  handlers.register('collaboration:get-sessions', async (event, request) => {
    try {
      if (!collaborationLauncher) throw new Error('Collaboration not initialized');
      const sessions = collaborationLauncher.getActiveSessions();
      return createSuccessResponse(request.id, { sessions });
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
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
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
    }
  });

  handlers.register(IPC_CHANNELS.SEARCH_SUGGESTIONS, async (event, request) => {
    try {
      if (!searchEngine) throw new Error('Search engine not initialized');
      const { prefix } = request.data;
      const suggestions = await searchEngine.getSuggestions(prefix, 5);
      return createSuccessResponse(request.id, { suggestions });
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
    }
  });

  handlers.register(IPC_CHANNELS.SEARCH_INDEX, async (event, request) => {
    try {
      if (!searchEngine) throw new Error('Search engine not initialized');
      const { id, content, metadata } = request.data;
      await searchEngine.index(id, content, metadata || {});
      return createSuccessResponse(request.id, { indexed: true });
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
    }
  });

  // Mini Window
  handlers.register(IPC_CHANNELS.MINI_WINDOW_SHOW, async (event, request) => {
    try {
      if (!miniWindowManager) throw new Error('Mini window not initialized');
      miniWindowManager.show();
      return createSuccessResponse(request.id, { success: true });
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
    }
  });

  handlers.register(IPC_CHANNELS.MINI_WINDOW_HIDE, async (event, request) => {
    try {
      if (!miniWindowManager) throw new Error('Mini window not initialized');
      miniWindowManager.hide();
      return createSuccessResponse(request.id, { success: true });
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
    }
  });

  handlers.register(IPC_CHANNELS.MINI_WINDOW_TOGGLE, async (event, request) => {
    try {
      if (!miniWindowManager) throw new Error('Mini window not initialized');
      miniWindowManager.toggle();
      return createSuccessResponse(request.id, { success: true });
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
    }
  });

  handlers.register(IPC_CHANNELS.SEARCH_HISTORY, async (event, request) => {
    try {
      if (!searchEngine) throw new Error('Search engine not initialized');
      const history = searchEngine.getSearchHistory(20);
      return createSuccessResponse(request.id, { history });
    } catch (error: any) {
      return createErrorResponse(request.id, error.message);
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
  initializeSearch();
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
