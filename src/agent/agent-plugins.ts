/**
 * Agent Plugins API
 *
 * Extracted from AetherAgent to reduce the God Object.
 * Functions accept a AetherAgent-like host object for access to internal state.
 */

import type { Plugin } from '../plugins/plugin-registry';
import { pluginValidator } from '../plugins/plugin-validator';
import { pluginRegistry } from '../plugins/plugin-registry';
import { createLogger } from '../utils/logger';
import { join } from 'path';

const logger = createLogger('AgentPlugins');

/**
 * Minimal interface that a host must expose for plugin API functions.
 */
export interface PluginHost {
  pluginLoader: {
    isLoaded(pluginId: string): boolean;
    getPlugin(pluginId: string): Plugin | undefined;
    loadPlugin(pluginId: string): Promise<Plugin>;
    unloadPlugin(pluginId: string): Promise<void>;
    loadAll(): Promise<Plugin[]>;
  };
  marketplace: {
    search(query: string, category?: string): Promise<any>;
    getFeatured(): Promise<any>;
    install(pluginId: string, version?: string): Promise<void>;
    uninstall(pluginId: string): Promise<void>;
    update(pluginId: string, version?: string): Promise<void>;
    checkUpdates(): Promise<any>;
    initialize(): Promise<void>;
  };
  loadPlugin(pluginId: string): Promise<Plugin>;
  unloadPlugin(pluginId: string): Promise<void>;
  reloadPlugin(pluginId: string): Promise<Plugin>;
  listPlugins(): Plugin[];
  listEnabledPlugins(): Plugin[];
  enablePlugin(pluginId: string): void;
  disablePlugin(pluginId: string): void;
  getPlugin(pluginId: string): Plugin | undefined;
  searchPlugins(query: string, category?: string): Promise<any>;
  getFeaturedPlugins(): Promise<any>;
  installPlugin(pluginId: string, version?: string): Promise<void>;
  uninstallPlugin(pluginId: string): Promise<void>;
  updatePlugin(pluginId: string, version?: string): Promise<void>;
  checkPluginUpdates(): Promise<any>;
  getPluginStats(): any;
}

// ============================================================================
// Plugin Management API
// ============================================================================

export async function loadPlugin(
  host: { pluginLoader: PluginHost['pluginLoader'] },
  pluginId: string
): Promise<Plugin> {
  logger.info(`Loading plugin: ${pluginId}`);

  try {
    // Check if already loaded
    if (host.pluginLoader.isLoaded(pluginId)) {
      logger.warn(`Plugin already loaded: ${pluginId}`);
      return host.pluginLoader.getPlugin(pluginId)!;
    }

    // Load plugin
    const plugin = await host.pluginLoader.loadPlugin(pluginId);

    // Validate plugin
    const pluginPath = join((host.pluginLoader as any)['pluginsDir'] || '', pluginId);
    const { validation, security } = await pluginValidator.validatePlugin(
      pluginPath,
      plugin.manifest
    );

    // Log validation results
    if (!validation.valid) {
      throw new Error(`Plugin validation failed: ${validation.errors.join(', ')}`);
    }

    if (!security.safe) {
      const report = pluginValidator.generateReport(validation, security);
      logger.warn(`Security risks detected in plugin ${pluginId}:\n${report}`);
    }

    // Register plugin
    pluginRegistry.register(plugin);

    logger.info(`Plugin loaded successfully: ${plugin.name} v${plugin.version}`);
    return plugin;
  } catch (error: unknown) {
    logger.error(`Failed to load plugin ${pluginId}:`, error as Error);
    throw error;
  }
}

export async function unloadPlugin(
  host: { pluginLoader: PluginHost['pluginLoader'] },
  pluginId: string
): Promise<void> {
  logger.info(`Unloading plugin: ${pluginId}`);

  try {
    // Unload from loader
    await host.pluginLoader.unloadPlugin(pluginId);

    // Unregister from registry
    pluginRegistry.unregister(pluginId);

    logger.info(`Plugin unloaded: ${pluginId}`);
  } catch (error: unknown) {
    logger.error(`Failed to unload plugin ${pluginId}:`, error as Error);
    throw error;
  }
}

export async function reloadPlugin(
  host: { pluginLoader: PluginHost['pluginLoader'] },
  pluginId: string
): Promise<Plugin> {
  logger.info(`Reloading plugin: ${pluginId}`);
  await unloadPlugin(host, pluginId);
  return await loadPlugin(host, pluginId);
}

export function listPlugins(): Plugin[] {
  return pluginRegistry.listAll();
}

export function listEnabledPlugins(): Plugin[] {
  return pluginRegistry.listEnabled();
}

export function enablePlugin(pluginId: string): void {
  pluginRegistry.enable(pluginId);
  logger.info(`Plugin enabled: ${pluginId}`);
}

export function disablePlugin(pluginId: string): void {
  pluginRegistry.disable(pluginId);
  logger.info(`Plugin disabled: ${pluginId}`);
}

export function getPlugin(pluginId: string): Plugin | undefined {
  return pluginRegistry.get(pluginId);
}

export async function searchPlugins(
  host: { marketplace: PluginHost['marketplace'] },
  query: string,
  category?: string
) {
  return await host.marketplace.search(query, category);
}

export async function getFeaturedPlugins(
  host: { marketplace: PluginHost['marketplace'] }
) {
  return await host.marketplace.getFeatured();
}

export async function installPlugin(
  host: { marketplace: PluginHost['marketplace']; loadPlugin: (pluginId: string) => Promise<Plugin> },
  pluginId: string,
  version?: string
): Promise<void> {
  logger.info(`Installing plugin: ${pluginId}${version ? `@${version}` : ''}`);

  try {
    // Install from marketplace
    await host.marketplace.install(pluginId, version);

    // Load the installed plugin
    await host.loadPlugin(pluginId);

    logger.info(`Plugin installed: ${pluginId}`);
  } catch (error: unknown) {
    logger.error(`Failed to install plugin ${pluginId}:`, error as Error);
    throw error;
  }
}

export async function uninstallPlugin(
  host: { marketplace: PluginHost['marketplace']; pluginLoader: PluginHost['pluginLoader']; unloadPlugin: (pluginId: string) => Promise<void> },
  pluginId: string
): Promise<void> {
  logger.info(`Uninstalling plugin: ${pluginId}`);

  try {
    // Unload if loaded
    if (host.pluginLoader.isLoaded(pluginId)) {
      await host.unloadPlugin(pluginId);
    }

    // Uninstall from marketplace
    await host.marketplace.uninstall(pluginId);

    logger.info(`Plugin uninstalled: ${pluginId}`);
  } catch (error: unknown) {
    logger.error(`Failed to uninstall plugin ${pluginId}:`, error as Error);
    throw error;
  }
}

export async function updatePlugin(
  host: { marketplace: PluginHost['marketplace']; unloadPlugin: (pluginId: string) => Promise<void>; loadPlugin: (pluginId: string) => Promise<Plugin> },
  pluginId: string,
  version?: string
): Promise<void> {
  logger.info(`Updating plugin: ${pluginId}${version ? ` to ${version}` : ''}`);

  try {
    // Unload plugin
    await host.unloadPlugin(pluginId);

    // Update via marketplace
    await host.marketplace.update(pluginId, version);

    // Reload plugin
    await host.loadPlugin(pluginId);

    logger.info(`Plugin updated: ${pluginId}`);
  } catch (error: unknown) {
    logger.error(`Failed to update plugin ${pluginId}:`, error as Error);
    throw error;
  }
}

export async function checkPluginUpdates(
  host: { marketplace: PluginHost['marketplace'] }
) {
  return await host.marketplace.checkUpdates();
}

export function getPluginStats() {
  return pluginRegistry.getStats();
}
