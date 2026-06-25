/**
 * Electron Preload Script
 */

import { contextBridge, ipcRenderer } from 'electron';
import { IPCClient, createPreloadAPI } from './ipc/renderer';

// Create IPC client
const ipcClient = new IPCClient();

// Create preload API
const api = createPreloadAPI(ipcClient);

// Expose API to renderer
contextBridge.exposeInMainWorld('aether', api);
contextBridge.exposeInMainWorld('electronAPI', api); // Alias for compatibility

// Type declarations for renderer
export type AetherAPI = typeof api;

declare global {
  interface Window {
    aether: AetherAPI;
    electronAPI: AetherAPI;
  }
}
