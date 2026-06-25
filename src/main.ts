/**
 * Electron Main Process
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { IPCHandlerRegistry, createSuccessResponse, createErrorResponse } from './ipc/handlers';
import { IPC_CHANNELS } from './ipc/protocol';
import { NexusAgent } from './agent';
import { createLogger } from './utils/logger';

const logger = createLogger('Main');

let mainWindow: BrowserWindow | null = null;
let agent: NexusAgent | null = null;

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

  handlers.setup();
  logger.info('IPC handlers registered');
}

/**
 * App ready
 */
app.whenReady().then(async () => {
  await initializeAgent();
  setupIPC();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
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
