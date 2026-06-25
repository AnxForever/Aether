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
contextBridge.exposeInMainWorld('nexus', api);

// Type declarations for renderer
export type NexusAPI = typeof api;

declare global {
  interface Window {
    nexus: NexusAPI;
  }
}
