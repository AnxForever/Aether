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
import { ColaLinkManager } from './colalink/colalink-manager';
import type { ColaLinkConfig } from './colalink/colalink-manager';
import type { Message as ColaLinkMessage } from './colalink/message-manager';
import type { Contact, ContactRequest } from './colalink/contact-manager';
import { AwarenessSystem } from './awareness/awareness-system';
import type { AwarenessConfig, Imprint } from './awareness/awareness-system';
import { SemanticSearch } from './search/semantic-search';
import type { SearchQuery, SearchResult } from './search/semantic-search';
import { RecommendationEngine } from './recommendation/recommendation-engine';
import type { RecommendationItem, UserInteraction } from './recommendation/recommendation-engine';
import { PlaywrightBrowser } from './browser/playwright-browser';
import type { PlaywrightBrowserConfig } from './browser/playwright-browser';
import { VoiceManager } from './voice/voice-manager';
import type { VoiceManagerConfig } from './voice/voice-manager';
import { ChartGenerator } from './visualization/chart-generator';
import type { ChartConfig, ChartOutput } from './visualization/chart-generator';
import { DataTransformer } from './visualization/data-transformer';
import { CodeAnalyzer } from './analysis/code-analyzer';
import { ComplexityAnalyzer } from './analysis/complexity-analyzer';
import { DependencyAnalyzer } from './analysis/dependency-analyzer';
import { MCPServerManager } from './mcp/mcp-server-manager';
import type { MCPServerConfig } from './mcp/mcp-server-manager';
import { SlackManager } from './integrations/slack/slack-manager';
import type { SlackManagerConfig } from './integrations/slack/types';
import { SentryManager } from './monitoring/sentry-manager';
import type { SentryConfig } from './monitoring/types';

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
  /** ColaLink cross-device messaging config */
  colaLink?: Partial<ColaLinkConfig>;
  /** Awareness system config (AI diary/reflection) */
  awareness?: Partial<AwarenessConfig>;
  /** Voice processing config */
  voice?: VoiceManagerConfig;
  /** Browser automation config */
  browser?: PlaywrightBrowserConfig;
  /** MCP server config */
  mcp?: MCPServerConfig;
  /** Slack integration config */
  slack?: {
    enabled?: boolean;
    token?: string;
    signingSecret?: string;
  };
  /** Monitoring config */
  monitoring?: {
    sentryDsn?: string;
    enabled?: boolean;
  };
}

export class NexusAgent {
  private orchestrator: Orchestrator;
  private context: AgentContext;
  private config: NexusAgentConfig;
  private pluginLoader: PluginLoader;
  private marketplace: PluginMarketplace;
  private connectorsInitialized = false;

  // v2.1 New subsystems
  private colaLinkManager?: ColaLinkManager;
  private awarenessSystem?: AwarenessSystem;
  private semanticSearch?: SemanticSearch;
  private recommendationEngine?: RecommendationEngine;
  private playwrightBrowser?: PlaywrightBrowser;
  private voiceManager?: VoiceManager;
  private chartGenerator?: ChartGenerator;
  private dataTransformer?: DataTransformer;
  private codeAnalyzer?: CodeAnalyzer;
  private complexityAnalyzer?: ComplexityAnalyzer;
  private dependencyAnalyzer?: DependencyAnalyzer;
  private mcpServerManager?: MCPServerManager;
  private slackManager?: SlackManager;
  private sentryManager?: SentryManager;

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
    if (this.connectorsInitialized) return;
    this.connectorsInitialized = true;

    for (const [provider, apiKey] of Object.entries(this.config.apiKeys)) {
      const connector = connectorRegistry.get(provider as any);
      if (connector) {
        try {
          await connector.initialize({ apiKey });
          logger.info(`Initialized connector: ${provider}`);
        } catch (error) {
          logger.error(`Failed to initialize ${provider}:`, error as Error);
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

    const agentDataDir = this.config.dataDir || './data';

    // Initialize ColaLink
    if (this.config.colaLink) {
      this.colaLinkManager = new ColaLinkManager({
        dataDir: agentDataDir,
        encryptionKey: this.config.colaLink?.encryptionKey || process.env.COLALINK_ENCRYPTION_KEY || '',
        myHandle: this.config.colaLink?.myHandle || 'aether-user',
        ...this.config.colaLink
      });
      logger.info('ColaLink initialized');
    }

    // Initialize Awareness System
    this.awarenessSystem = new AwarenessSystem(this.config.awareness);
    try {
      await this.awarenessSystem.initialize(this);
      logger.info('Awareness system initialized');
    } catch (error) {
      logger.warn('Awareness system init skipped (no API key)');
    }

    // Initialize Semantic Search
    const searchDbPath = join(agentDataDir, 'semantic-search.db');
    this.semanticSearch = new SemanticSearch(searchDbPath);
    logger.info('Semantic search initialized');

    // Initialize Recommendation Engine
    const recDbPath = join(agentDataDir, 'recommendation.db');
    this.recommendationEngine = new RecommendationEngine(recDbPath);
    logger.info('Recommendation engine initialized');

    // Initialize Voice Manager
    this.voiceManager = new VoiceManager(this.config.voice || {});
    logger.info('Voice manager initialized');

    // Initialize Browser (lazy — only if configured)
    if (this.config.browser) {
      this.playwrightBrowser = new PlaywrightBrowser(this.config.browser);
      logger.info('Browser automation initialized');
    }

    // Initialize MCP Server Manager
    this.mcpServerManager = new MCPServerManager();
    logger.info('MCP server manager initialized');

    // Auto-start MCP servers from config
    if (this.config.mcp) {
      try {
        await this.mcpServerManager.startServer(this.config.mcp);
        logger.info(`MCP server started: ${this.config.mcp.name}`);
      } catch (error) {
        logger.warn(`MCP server start failed: ${(error as Error).message}`);
      }
    }

    // Initialize Slack Manager
    if (this.config.slack?.enabled && this.config.slack.token) {
      const slackConfig: SlackManagerConfig = {
        botToken: this.config.slack.token,
        signingSecret: this.config.slack.signingSecret || '',
        socketMode: false,
      };
      this.slackManager = new SlackManager(slackConfig);
      await this.slackManager.initialize();
      logger.info('Slack manager initialized');
    }

    // Initialize Sentry Manager
    const sentryDsn = this.config.monitoring?.sentryDsn || process.env.SENTRY_DSN;
    if (sentryDsn && this.config.monitoring?.enabled !== false) {
      this.sentryManager = new SentryManager({ dsn: sentryDsn });
      this.sentryManager.initialize();
      logger.info('Sentry manager initialized');
    }

    // Lazy-init tools
    this.chartGenerator = new ChartGenerator();
    this.dataTransformer = new DataTransformer();
    this.codeAnalyzer = new CodeAnalyzer();
    this.complexityAnalyzer = new ComplexityAnalyzer();
    this.dependencyAnalyzer = new DependencyAnalyzer();
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.orchestrator.cleanup();
    this.colaLinkManager?.destroy();
    this.playwrightBrowser?.close();
    this.voiceManager?.close();
    this.mcpServerManager?.stopAll();
    this.slackManager?.destroy();
    await this.sentryManager?.close();
    logger.info('Agent cleaned up');
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

  // ============================================================================
  // ColaLink API (跨设备消息同步)
  // ============================================================================

  /** Send a message via ColaLink */
  async sendColaLinkMessage(toHandle: string, content: string): Promise<ColaLinkMessage> {
    if (!this.colaLinkManager) throw new Error('ColaLink is not initialized');
    return await this.colaLinkManager.sendMessage(toHandle, content);
  }

  /** Get conversation history with a contact */
  async getColaLinkHistory(handle: string, limit?: number): Promise<ColaLinkMessage[]> {
    if (!this.colaLinkManager) throw new Error('ColaLink is not initialized');
    return await this.colaLinkManager.getHistory(handle, limit);
  }

  /** List all contacts */
  listColaLinkContacts(status?: Contact['status']): Contact[] {
    if (!this.colaLinkManager) return [];
    return this.colaLinkManager.listContacts(status);
  }

  /** Add a contact */
  addColaLinkContact(contact: Omit<Contact, 'addedAt' | 'updatedAt'>): Contact {
    if (!this.colaLinkManager) throw new Error('ColaLink is not initialized');
    return this.colaLinkManager.addContact(contact);
  }

  /** Send a contact request */
  sendColaLinkContactRequest(toHandle: string, message?: string): ContactRequest {
    if (!this.colaLinkManager) throw new Error('ColaLink is not initialized');
    return this.colaLinkManager.sendContactRequest(toHandle, message);
  }

  /** List pending contact requests */
  listColaLinkPendingRequests(): ContactRequest[] {
    if (!this.colaLinkManager) return [];
    return this.colaLinkManager.listPendingRequests();
  }

  /** Get unread message count */
  getColaLinkUnreadCount(): number {
    if (!this.colaLinkManager) return 0;
    return this.colaLinkManager.getUnreadCount();
  }

  /** Get recent conversations */
  async getColaLinkRecentConversations(limit?: number) {
    if (!this.colaLinkManager) return [];
    return await this.colaLinkManager.getRecentConversations(limit);
  }

  /** Get ColaLink system health */
  isColaLinkActive(): boolean {
    return this.colaLinkManager !== undefined;
  }

  // ============================================================================
  // Slack Integration API
  // ============================================================================

  /**
   * Connect to Slack with a bot token
   */
  async connectSlack(token: string): Promise<void> {
    if (this.slackManager) {
      await this.slackManager.stop();
      this.slackManager.destroy();
    }
    const slackConfig: SlackManagerConfig = {
      botToken: token,
      signingSecret: '',
      socketMode: false,
    };
    this.slackManager = new SlackManager(slackConfig);
    await this.slackManager.initialize();
    logger.info('Slack connected');
  }

  /**
   * Disconnect from Slack
   */
  async disconnectSlack(): Promise<void> {
    if (!this.slackManager) return;
    await this.slackManager.stop();
    this.slackManager.destroy();
    this.slackManager = undefined;
    logger.info('Slack disconnected');
  }

  /**
   * Send a message to a Slack channel
   */
  async sendSlackMessage(channel: string, text: string): Promise<void> {
    if (!this.slackManager) throw new Error('Slack is not connected');
    await this.slackManager.getClient().chat.postMessage({ channel, text });
  }

  /**
   * List available Slack channels
   */
  async listSlackChannels(): Promise<any[]> {
    if (!this.slackManager) return [];
    const result = await this.slackManager.getClient().conversations.list();
    return (result.channels || []) as any[];
  }

  /**
   * Check if Slack is connected
   */
  isSlackConnected(): boolean {
    return this.slackManager?.isReady() ?? false;
  }

  // ============================================================================
  // Monitoring API (Sentry)
  // ============================================================================

  /**
   * Capture an error to Sentry
   */
  captureError(error: Error, context?: Record<string, any>): void {
    if (!this.sentryManager) return;
    this.sentryManager.captureException(error, { context });
  }

  /**
   * Capture a message to Sentry
   */
  captureMessage(message: string, level?: string): void {
    if (!this.sentryManager) return;
    this.sentryManager.captureMessage(message, { severity: level as any });
  }

  /**
   * Set Sentry user context
   */
  setSentryUser(user: { id: string; email?: string }): void {
    if (!this.sentryManager) return;
    this.sentryManager.setUser(user);
  }

  /**
   * Get performance metrics from Sentry
   */
  getPerformanceMetrics(): Record<string, any> | null {
    if (!this.sentryManager) return null;
    return this.sentryManager.getPerformanceMetrics();
  }

  // ============================================================================
  // Awareness System API (AI 日记 & 反思)
  // ============================================================================

  /** Generate today's diary entry */
  async generateAwarenessDiary(): Promise<Imprint | null> {
    if (!this.awarenessSystem) return null;
    try {
      return await this.awarenessSystem.generateDailyDiary();
    } catch (error) {
      logger.warn(`Failed to generate diary: ${(error as Error).message}`);
      return null;
    }
  }

  /** Create a draft (conversation highlight) */
  async createAwarenessDraft(content: string, title?: string): Promise<Imprint | null> {
    if (!this.awarenessSystem) return null;
    try {
      return await this.awarenessSystem.createDraft(content, title);
    } catch (error) {
      logger.warn(`Failed to create draft: ${(error as Error).message}`);
      return null;
    }
  }

  /** Generate daily episode summary */
  async generateAwarenessEpisode(): Promise<Imprint | null> {
    if (!this.awarenessSystem) return null;
    try {
      return await this.awarenessSystem.generateDailyEpisode();
    } catch (error) {
      logger.warn(`Failed to generate episode: ${(error as Error).message}`);
      return null;
    }
  }

  /** List all imprints (diaries + drafts + episodes) */
  async listAwarenessImprints(type?: Imprint['type']): Promise<Imprint[]> {
    if (!this.awarenessSystem) return [];
    return await this.awarenessSystem.listImprints(type);
  }

  /** Check if awareness system is active */
  isAwarenessActive(): boolean {
    return this.awarenessSystem !== undefined;
  }

  // ============================================================================
  // Semantic Search API (向量搜索)
  // ============================================================================

  /** Index content for semantic search */
  async searchIndex(
    id: string,
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    if (!this.semanticSearch) throw new Error('Semantic search is not initialized');
    return await this.semanticSearch.index(id, content, metadata);
  }

  /** Search indexed content */
  async searchSemantic(query: SearchQuery): Promise<SearchResult[]> {
    if (!this.semanticSearch) return [];
    return await this.semanticSearch.search(query);
  }

  /** Get search history */
  getSearchHistory(limit?: number) {
    if (!this.semanticSearch) return [];
    return this.semanticSearch.getSearchHistory(limit);
  }

  /** Remove item from search index */
  removeFromSearchIndex(id: string): void {
    if (!this.semanticSearch) return;
    this.semanticSearch.remove(id);
  }

  // ============================================================================
  // Recommendation Engine API (智能推荐)
  // ============================================================================

  /** Record a user interaction for learning */
  async recordRecommendationInteraction(interaction: UserInteraction): Promise<void> {
    if (!this.recommendationEngine) throw new Error('Recommendation engine is not initialized');
    await this.recommendationEngine.recordInteraction(interaction);
  }

  /** Get personalized recommendations */
  async getRecommendations(
    userId: string,
    type?: RecommendationItem['type'],
    limit?: number
  ): Promise<RecommendationItem[]> {
    if (!this.recommendationEngine) return [];
    return await this.recommendationEngine.getRecommendations(userId, type, limit);
  }

  /** Get recommendation engine info */
  getRecommendationEngineInfo() {
    if (!this.recommendationEngine) return null;
    return { initialized: true };
  }

  // ============================================================================
  // Browser Automation API (浏览器自动化)
  // ============================================================================

  /** Launch browser */
  async launchBrowser(): Promise<void> {
    if (!this.playwrightBrowser) {
      this.playwrightBrowser = new PlaywrightBrowser(this.config.browser);
    }
    await this.playwrightBrowser.launch();
  }

  /** Navigate to URL */
  async browserNavigate(url: string): Promise<any> {
    if (!this.playwrightBrowser) throw new Error('Browser not initialized. Call launchBrowser() first.');
    return await this.playwrightBrowser.navigate(url);
  }

  /** Take screenshot of a page */
  async browserScreenshot(page: any, options?: { fullPage?: boolean; path?: string }): Promise<Buffer> {
    if (!this.playwrightBrowser) throw new Error('Browser not initialized');
    return await this.playwrightBrowser.screenshot(page, options);
  }

  /** Close browser */
  async closeBrowser(): Promise<void> {
    await this.playwrightBrowser?.close();
  }

  /** Check if browser is active */
  isBrowserActive(): boolean {
    return this.playwrightBrowser !== undefined;
  }

  // ============================================================================
  // Voice Processing API (语音处理)
  // ============================================================================

  /** Recognize speech from audio */
  async recognizeVoice(
    audio: Buffer | string,
    options?: { language?: string; useVAD?: boolean }
  ) {
    if (!this.voiceManager) throw new Error('Voice manager not initialized');
    return await this.voiceManager.recognize({
      audio,
      language: options?.language,
      useVAD: options?.useVAD
    });
  }

  /** Synthesize speech from text */
  async synthesizeVoice(
    text: string,
    options?: { voice?: string; speed?: number }
  ) {
    if (!this.voiceManager) throw new Error('Voice manager not initialized');
    return await this.voiceManager.synthesize(text, options);
  }

  /** Detect voice activity */
  async detectVoiceActivity(audio: Buffer) {
    if (!this.voiceManager) throw new Error('Voice manager not initialized');
    return await this.voiceManager.detectVoiceActivity(audio);
  }

  /** Check if voice is configured */
  isVoiceActive(): boolean {
    return this.voiceManager !== undefined;
  }

  // ============================================================================
  // Visualization API (图表生成)
  // ============================================================================

  /** Generate a chart */
  async generateChart(config: ChartConfig): Promise<ChartOutput> {
    if (!this.chartGenerator) throw new Error('Chart generator not initialized');
    return await this.chartGenerator.generate(config);
  }

  /** Transform data for visualization */
  transformChartData(
    data: any[],
    options?: Record<string, any>
  ): any[] {
    if (!this.dataTransformer) return data;
    return this.dataTransformer.transform(data, options as any);
  }

  // ============================================================================
  // Code Analysis API (代码分析)
  // ============================================================================

  /** Analyze code quality for a file */
  async analyzeCodeFile(filePath: string) {
    if (!this.codeAnalyzer) throw new Error('Code analyzer not initialized');
    return await this.codeAnalyzer.analyzeFile(filePath);
  }

  /** Analyze multiple files */
  async analyzeCodeFiles(filePaths: string[]) {
    if (!this.codeAnalyzer) throw new Error('Code analyzer not initialized');
    return await this.codeAnalyzer.analyzeFiles(filePaths);
  }

  /** Get code complexity for a file */
  async getCodeComplexity(filePath: string, content: string) {
    if (!this.complexityAnalyzer) throw new Error('Complexity analyzer not initialized');
    return await this.complexityAnalyzer.analyzeFile(filePath, content);
  }

  /** Get dependency info for a file */
  async getCodeDependencyInfo(filePath: string) {
    if (!this.dependencyAnalyzer) throw new Error('Dependency analyzer not initialized');
    return await this.dependencyAnalyzer.analyzeFile(filePath);
  }

  /** Get full dependency graph for multiple files */
  async getCodeDependencyGraph(filePaths: string[]) {
    if (!this.dependencyAnalyzer) throw new Error('Dependency analyzer not initialized');
    return await this.dependencyAnalyzer.analyzeFiles(filePaths);
  }

  // ============================================================================
  // MCP Server API (Model Context Protocol)
  // ============================================================================

  /** Start an MCP server */
  async startMcpServer(config: MCPServerConfig): Promise<void> {
    if (!this.mcpServerManager) {
      this.mcpServerManager = new MCPServerManager();
    }
    await this.mcpServerManager.startServer(config);
  }

  /** Stop an MCP server by name */
  async stopMcpServer(name: string): Promise<void> {
    if (!this.mcpServerManager) return;
    await this.mcpServerManager.stopServer(name);
  }

  /** List all MCP tools across all servers */
  async discoverMcpTools() {
    if (!this.mcpServerManager) return [];
    return await this.mcpServerManager.discoverTools();
  }

  /** Convert MCP tools to agent tools */
  async getMcpAgentTools() {
    if (!this.mcpServerManager) return [];
    return await this.mcpServerManager.toAgentTools();
  }

  /** List running MCP server names */
  listMcpServers(): string[] {
    if (!this.mcpServerManager) return [];
    return this.mcpServerManager.listServers();
  }

  /** Get MCP server manager instance */
  getMcpServerManager() {
    return this.mcpServerManager;
  }
}

/**
 * Create Nexus Agent instance
 */
export function createNexusAgent(config: NexusAgentConfig): NexusAgent {
  return new NexusAgent(config);
}
