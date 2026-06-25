/**
 * IPC Handlers - Main process IPC handlers
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS, IPCRequest, IPCResponse } from './protocol';
import { isValidMainChannel } from './channels';
import { createLogger } from '../utils/logger';

const logger = createLogger('IPC');

export interface IPCHandler<Req = any, Res = any> {
  (event: IpcMainInvokeEvent, request: IPCRequest<Req>): Promise<IPCResponse<Res>>;
}

export class IPCHandlerRegistry {
  private handlers = new Map<string, IPCHandler>();

  /**
   * Register handler for channel
   */
  register(channel: string, handler: IPCHandler): void {
    if (!isValidMainChannel(channel)) {
      throw new Error(`Invalid channel: ${channel}`);
    }

    this.handlers.set(channel, handler);
    logger.debug(`Registered handler for: ${channel}`);
  }

  /**
   * Unregister handler
   */
  unregister(channel: string): void {
    this.handlers.delete(channel);
    logger.debug(`Unregistered handler for: ${channel}`);
  }

  /**
   * Setup all IPC handlers
   */
  setup(): void {
    for (const [channel, handler] of this.handlers.entries()) {
      ipcMain.handle(channel, async (event, request: IPCRequest) => {
        try {
          logger.debug(`Handling: ${channel}`, { id: request.id });

          const response = await handler(event, request);

          logger.debug(`Response: ${channel}`, {
            id: request.id,
            success: response.success
          });

          return response;
        } catch (error: any) {
          logger.error(`Handler error: ${channel}`, error as Error);

          return {
            id: request.id,
            success: false,
            error: error.message
          };
        }
      });
    }

    logger.info(`Registered ${this.handlers.size} IPC handlers`);
  }

  /**
   * Cleanup all handlers
   */
  cleanup(): void {
    for (const channel of this.handlers.keys()) {
      ipcMain.removeHandler(channel);
    }
    this.handlers.clear();
    logger.info('Cleaned up all IPC handlers');
  }
}

/**
 * Create success response
 */
export function createSuccessResponse<T>(id: string, data: T): IPCResponse<T> {
  return {
    id,
    success: true,
    data
  };
}

/**
 * Create error response
 */
export function createErrorResponse(id: string, error: string): IPCResponse {
  return {
    id,
    success: false,
    error
  };
}

/**
 * Send event to renderer
 */
export function sendToRenderer(window: Electron.BrowserWindow, channel: string, data: any): void {
  if (window && !window.isDestroyed()) {
    window.webContents.send(channel, data);
  }
}

/**
 * Broadcast event to all windows
 */
export function broadcastToAll(channel: string, data: any): void {
  const { BrowserWindow } = require('electron');
  const windows = BrowserWindow.getAllWindows();

  for (const window of windows) {
    sendToRenderer(window, channel, data);
  }
}
