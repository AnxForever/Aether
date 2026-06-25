/**
 * Nexus Agent - Main Agent Class
 *
 * High-level API for interacting with Nexus
 */

import { Orchestrator } from './core/orchestrator';
import { UserInput, AgentContext, Message, AgentSettings } from './types';
import { connectorRegistry } from './connectors';
import { randomUUID } from 'crypto';
import { PluginLoader } from './plugins/plugin-loader';
import { PluginMarketplace } from './plugins/marketplace';
import { pluginRegistry, Plugin } from './plugins/plugin-registry';
import { pluginValidator } from './plugins/plugin-validator';
import { createLogger } from './utils/logger';
import { join } from 'path';

const logger = createLogger('NexusAgent');

export interface NexusAgentConfig {
  model?: string;
  provider?: string;
  apiKeys?: Record<string, string>;
  dataDir?: string;
  deviceId?: string;
  enableLearning?: boolean;
  pluginsDir?: string;
  marketplaceUrl?: string;
}

export class NexusAgent {
  private orchestrator: Orchestrator;
  private context: AgentContext;
  private config: NexusAgentConfig;
  private pluginLoader: PluginLoader;
  private marketplace: PluginMarketplace;

  constructor(config: NexusAgentConfig) {
    this.config = config;

    // Initialize orchestrator
    this.orchestrator = new Orchestrator({
      defaultModel: config.model || 'claude-sonnet-4-20250514',
      defaultProvider: config.provider || 'claude',
      maxConcurrentCycles: 10,
      dataDir: config.dataDir || './data',
      enableLearning: config.enableLearning !== false
    });

    // Initialize context
    this.context = {
      sessionId: randomUUID(),
      deviceId: config.deviceId || randomUUID(),
      settings: {
        model: config.model || 'claude-sonnet-4-20250514',
        language: 'zh',
        theme: 'dark'
      },
      capabilities: []
    };

    // Initialize plugin system
    const pluginsDir = config.pluginsDir || join(config.dataDir || './data', 'plugins');
    this.pluginLoader = new PluginLoader({ pluginsDir });
    this.marketplace = new PluginMarketplace(pluginsDir, config.marketplaceUrl);

    // Initialize connectors
    this.initializeConnectors();
  }

  /**
   * Initialize AI connectors
   */
  private async initializeConnectors(): Promise<void> {
    if (!this.config.apiKeys) return;

    for (const [provider, apiKey] of Object.entries(this.config.apiKeys)) {
      const connector = connectorRegistry.get(provider as any);
      if (connector) {
        try {
          await connector.initialize({ apiKey });
          console.info(`[Nexus] Initialized connector: ${provider}`);
        } catch (error) {
          console.error(`[Nexus] Failed to initialize ${provider}:`, error);
        }
      }
    }
  }

  /**
   * Initialize agent (async setup)
   */
  async initialize(): Promise<void> {
    await this.initializeConnectors();
    await this.orchestrator.initialize();
    await this.marketplace.initialize();

    // Load plugins
    const plugins = await this.pluginLoader.loadAll();
    for (const plugin of plugins) {
      pluginRegistry.register(plugin);
    }

    logger.info(`Initialized with ${plugins.length} plugins`);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.orchestrator.cleanup();
  }

  // ============================================================================
  // Plugin Management API
  // ============================================================================

  /**
   * Load a plugin by ID
   */
  async loadPlugin(pluginId: string): Promise<Plugin> {
    logger.info(`Loading plugin: ${pluginId}`);

    try {
      // Check if already loaded
      if (this.pluginLoader.isLoaded(pluginId)) {
        logger.warn(`Plugin already loaded: ${pluginId}`);
        return this.pluginLoader.getPlugin(pluginId)!;
      }

      // Load plugin
      const plugin = await this.pluginLoader.loadPlugin(pluginId);

      // Validate plugin
      const pluginPath = join(this.pluginLoader['pluginsDir'], pluginId);
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
    } catch (error) {
      logger.error(`Failed to load plugin ${pluginId}:`, error as Error);
      throw error;
    }
  }

  /**
   * Unload a plugin by ID
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    logger.info(`Unloading plugin: ${pluginId}`);

    try {
      // Unload from loader
      await this.pluginLoader.unloadPlugin(pluginId);

      // Unregister from registry
      pluginRegistry.unregister(pluginId);

      logger.info(`Plugin unloaded: ${pluginId}`);
    } catch (error) {
      logger.error(`Failed to unload plugin ${pluginId}:`, error as Error);
      throw error;
    }
  }

  /**
   * Reload a plugin by ID
   */
  async reloadPlugin(pluginId: string): Promise<Plugin> {
    logger.info(`Reloading plugin: ${pluginId}`);
    await this.unloadPlugin(pluginId);
    return await this.loadPlugin(pluginId);
  }

  /**
   * List all loaded plugins
   */
  listPlugins(): Plugin[] {
    return pluginRegistry.listAll();
  }

  /**
   * List enabled plugins
   */
  listEnabledPlugins(): Plugin[] {
    return pluginRegistry.listEnabled();
  }

  /**
   * Enable a plugin
   */
  enablePlugin(pluginId: string): void {
    pluginRegistry.enable(pluginId);
    logger.info(`Plugin enabled: ${pluginId}`);
  }

  /**
   * Disable a plugin
   */
  disablePlugin(pluginId: string): void {
    pluginRegistry.disable(pluginId);
    logger.info(`Plugin disabled: ${pluginId}`);
  }

  /**
   * Get plugin by ID
   */
  getPlugin(pluginId: string): Plugin | undefined {
    return pluginRegistry.get(pluginId);
  }

  /**
   * Search plugins in marketplace
   */
  async searchPlugins(query: string, category?: string) {
    return await this.marketplace.search(query, category);
  }

  /**
   * Get featured plugins from marketplace
   */
  async getFeaturedPlugins() {
    return await this.marketplace.getFeatured();
  }

  /**
   * Install plugin from marketplace
   */
  async installPlugin(pluginId: string, version?: string): Promise<void> {
    logger.info(`Installing plugin: ${pluginId}${version ? `@${version}` : ''}`);

    try {
      // Install from marketplace
      await this.marketplace.install(pluginId, version);

      // Load the installed plugin
      await this.loadPlugin(pluginId);

      logger.info(`Plugin installed: ${pluginId}`);
    } catch (error) {
      logger.error(`Failed to install plugin ${pluginId}:`, error as Error);
      throw error;
    }
  }

  /**
   * Uninstall plugin
   */
  async uninstallPlugin(pluginId: string): Promise<void> {
    logger.info(`Uninstalling plugin: ${pluginId}`);

    try {
      // Unload if loaded
      if (this.pluginLoader.isLoaded(pluginId)) {
        await this.unloadPlugin(pluginId);
      }

      // Uninstall from marketplace
      await this.marketplace.uninstall(pluginId);

      logger.info(`Plugin uninstalled: ${pluginId}`);
    } catch (error) {
      logger.error(`Failed to uninstall plugin ${pluginId}:`, error as Error);
      throw error;
    }
  }

  /**
   * Update plugin to latest or specific version
   */
  async updatePlugin(pluginId: string, version?: string): Promise<void> {
    logger.info(`Updating plugin: ${pluginId}${version ? ` to ${version}` : ''}`);

    try {
      // Unload plugin
      await this.unloadPlugin(pluginId);

      // Update via marketplace
      await this.marketplace.update(pluginId, version);

      // Reload plugin
      await this.loadPlugin(pluginId);

      logger.info(`Plugin updated: ${pluginId}`);
    } catch (error) {
      logger.error(`Failed to update plugin ${pluginId}:`, error as Error);
      throw error;
    }
  }

  /**
   * Check for plugin updates
   */
  async checkPluginUpdates() {
    return await this.marketplace.checkUpdates();
  }

  /**
   * Get plugin statistics
   */
  getPluginStats() {
    return pluginRegistry.getStats();
  }

  /**
   * Record user feedback on a message
   */
  async recordFeedback(
    messageId: string,
    rating: number,
    comment?: string,
    correctedResponse?: string
  ): Promise<string | null> {
    return await this.orchestrator.recordUserFeedback(
      this.context.sessionId,
      messageId,
      rating,
      comment,
      correctedResponse
    );
  }

  /**
   * Get learning statistics
   */
  async getLearningStats(): Promise<any> {
    return await this.orchestrator.getLearningStats();
  }

  /**
   * Generate learning report
   */
  async generateLearningReport(days: number = 7): Promise<string | null> {
    const end = Date.now();
    const start = end - (days * 24 * 60 * 60 * 1000);
    return await this.orchestrator.generateLearningReport({ start, end });
  }

  /**
   * Send message and get response
   */
  async chat(message: string, sessionId?: string): Promise<string> {
    if (sessionId) {
      this.context.sessionId = sessionId;
    }

    const input: UserInput = {
      transcript: message
    };

    const response = await this.orchestrator.processInput(input, this.context);
    return response.content;
  }

  /**
   * Stream response
   */
  async *streamChat(message: string, sessionId?: string): AsyncIterable<string> {
    if (sessionId) {
      this.context.sessionId = sessionId;
    }

    const input: UserInput = {
      transcript: message
    };

    yield* this.orchestrator.streamResponse(input, this.context);
  }

  /**
   * Create new session
   */
  newSession(): void {
    this.context.sessionId = randomUUID();
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.context.sessionId;
  }

  /**
   * Update settings
   */
  updateSettings(settings: Partial<AgentSettings>): void {
    this.context.settings = {
      ...this.context.settings,
      ...settings
    };
  }

  /**
   * Get current settings
   */
  getSettings(): AgentSettings {
    return { ...this.context.settings };
  }

  /**
   * Check if processing
   */
  isProcessing(): boolean {
    return this.orchestrator.isProcessing();
  }

  /**
   * Create skill from description
   */
  async createSkill(description: string): Promise<{
    success: boolean;
    skillId?: string;
    error?: string;
  }> {
    return await this.orchestrator.createSkill(description);
  }

  /**
   * List dynamically created skills
   */
  listDynamicSkills(): any[] {
    const integration = this.orchestrator.getSkillCreatorIntegration();
    if (!integration) {
      return [];
    }
    return integration.listDynamicSkills();
  }

  /**
   * Get skill creator statistics
   */
  getSkillCreatorStats(): any {
    const integration = this.orchestrator.getSkillCreatorIntegration();
    if (!integration) {
      return null;
    }
    return integration.getStats();
  }

  /**
   * Get available models
   */
  async getAvailableModels() {
    return await connectorRegistry.getAllModels();
  }

  // ============================================================================
  // Workflow API
  // ============================================================================

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflowId: string, inputs: Record<string, any> = {}): Promise<any> {
    const workflowIntegration = this.orchestrator.getWorkflowIntegration();
    if (!workflowIntegration) {
      throw new Error('Workflow integration is not enabled');
    }

    return await workflowIntegration.executeWorkflow(workflowId, inputs);
  }

  /**
   * List available workflows
   */
  listWorkflows(): any[] {
    const workflowIntegration = this.orchestrator.getWorkflowIntegration();
    if (!workflowIntegration) {
      return [];
    }

    return workflowIntegration.listWorkflows();
  }

  /**
   * Get workflow details
   */
  getWorkflow(workflowId: string): any | undefined {
    const workflowIntegration = this.orchestrator.getWorkflowIntegration();
    if (!workflowIntegration) {
      return undefined;
    }

    return workflowIntegration.getWorkflow(workflowId);
  }

  /**
   * Get workflow execution status
   */
  getWorkflowStatus(executionId: string): any | undefined {
    const workflowIntegration = this.orchestrator.getWorkflowIntegration();
    if (!workflowIntegration) {
      return undefined;
    }

    return workflowIntegration.getExecutionStatus(executionId);
  }

  /**
   * Get workflow execution history
   */
  getWorkflowHistory(workflowId: string, limit: number = 50): any[] {
    const workflowIntegration = this.orchestrator.getWorkflowIntegration();
    if (!workflowIntegration) {
      return [];
    }

    return workflowIntegration.getExecutionHistory(workflowId, limit);
  }

  /**
   * Cancel workflow execution
   */
  async cancelWorkflow(executionId: string): Promise<void> {
    const workflowIntegration = this.orchestrator.getWorkflowIntegration();
    if (!workflowIntegration) {
      throw new Error('Workflow integration is not enabled');
    }

    await workflowIntegration.cancelExecution(executionId);
  }
}

/**
 * Create Nexus Agent instance
 */
export function createNexusAgent(config: NexusAgentConfig): NexusAgent {
  return new NexusAgent(config);
}
