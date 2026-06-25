/**
 * Plugin System Types
 */

import { Tool } from './index';

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  repository?: string;
  enabled: boolean;
  tools: Tool[];
  dependencies?: string[];
  metadata?: Record<string, any>;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  dependencies?: Record<string, string>;
}

export interface PluginContext {
  pluginId: string;
  dataDir: string;
  configDir: string;
  logger: PluginLogger;
}

export interface PluginLogger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

export interface PluginAPI {
  registerTool(tool: Tool): void;
  unregisterTool(name: string): void;
  getConfig<T = any>(key: string): T | undefined;
  setConfig<T = any>(key: string, value: T): void;
}
