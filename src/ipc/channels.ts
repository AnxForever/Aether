/**
 * IPC Channels - Channel definitions and validators
 */

import { IPC_CHANNELS } from './protocol';

/**
 * Main process channels (renderer -> main)
 */
export const MAIN_CHANNELS = [
  IPC_CHANNELS.AGENT_START,
  IPC_CHANNELS.AGENT_STOP,
  IPC_CHANNELS.AGENT_STATUS,
  IPC_CHANNELS.CHAT_SEND,
  IPC_CHANNELS.CHAT_STREAM,
  IPC_CHANNELS.CHAT_STOP,
  IPC_CHANNELS.CHAT_CLEAR,
  IPC_CHANNELS.SESSION_NEW,
  IPC_CHANNELS.SESSION_LIST,
  IPC_CHANNELS.SESSION_GET,
  IPC_CHANNELS.SESSION_DELETE,
  IPC_CHANNELS.SESSION_RENAME,
  IPC_CHANNELS.SETTINGS_GET,
  IPC_CHANNELS.SETTINGS_UPDATE,
  IPC_CHANNELS.SETTINGS_RESET,
  IPC_CHANNELS.MODELS_LIST,
  IPC_CHANNELS.MODELS_SWITCH,
  IPC_CHANNELS.SKILLS_LIST,
  IPC_CHANNELS.SKILLS_ENABLE,
  IPC_CHANNELS.SKILLS_DISABLE,
  IPC_CHANNELS.FILE_UPLOAD,
  IPC_CHANNELS.FILE_DELETE
] as const;

/**
 * Renderer channels (main -> renderer)
 */
export const RENDERER_CHANNELS = [
  IPC_CHANNELS.EVENT_MESSAGE,
  IPC_CHANNELS.EVENT_STREAM_CHUNK,
  IPC_CHANNELS.EVENT_STREAM_END,
  IPC_CHANNELS.EVENT_ERROR,
  IPC_CHANNELS.EVENT_STATUS_CHANGE
] as const;

/**
 * Check if channel is valid main channel
 */
export function isValidMainChannel(channel: string): boolean {
  return MAIN_CHANNELS.includes(channel as any);
}

/**
 * Check if channel is valid renderer channel
 */
export function isValidRendererChannel(channel: string): boolean {
  return RENDERER_CHANNELS.includes(channel as any);
}

/**
 * Get channel category
 */
export function getChannelCategory(channel: string): string {
  const parts = channel.split(':');
  return parts[0] || 'unknown';
}

/**
 * Check if channel requires authentication
 */
export function requiresAuth(channel: string): boolean {
  // All channels except status check require authentication
  return channel !== IPC_CHANNELS.AGENT_STATUS;
}
