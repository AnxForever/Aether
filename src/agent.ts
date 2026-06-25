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
import { ImageProcessor } from './media/image';
import type {
  ImageProcessorConfig,
  ImageInput,
  ConvertOptions,
  ResizeOptions,
  CropOptions,
  RotateOptions,
  FlipOptions,
  CompressOptions,
  WatermarkOptions,
  BatchProcessOptions,
  ProcessResult,
  BatchProcessResult,
  ImageMetadata,
  ImageFormat,
} from './media/image/types';
import { OAuthManager } from './oauth/oauth-manager';
import type { OAuthProviderConfig, OAuthToken } from './oauth/oauth-manager';
import { QRLoginManager } from './oauth/qr-login';
import type { QRLoginSession } from './oauth/qr-login';
import { BackupManager } from './backup/backup-manager';
import type { BackupConfig, BackupMetadata } from './backup/backup-manager';
import { LocalServer } from './cli/local-server';
import { PermissionManager } from './permission/manager';
import type { PermissionType, PermissionOperation, PermissionRequest, PermissionDecision } from './permission/manager';
import { TTS } from './speech/tts';
import type { TTSConfig, Voice, SynthesisResult } from './speech/tts';
import { ProcessManager } from './system/process-manager';
import type { ProcessConfig, ManagedProcessInfo } from './system/process-manager';
import { FeedbackExporter } from './feedback/exporter';
import type { ExportOptions } from './feedback/exporter';
import { TelemetrySystem } from './telemetry/telemetry-system';
import type { TelemetryConfig } from './telemetry/telemetry-system';
import { AnalyticsClient } from './analytics/analytics-client';
import type { AnalyticsConfig, UserProperties } from './analytics/analytics-client';
import { I18nManager } from './i18n/i18n-manager';
import type { SupportedLocale, I18nNamespace, TranslationOptions, I18nConfig } from './i18n/types';

// Module 1: Observability (OpenTelemetry)
import { TelemetryManager } from './observability/telemetry-manager';
import type { TelemetryConfig as OTelTelemetryConfig } from './observability/types';

// Module 2: Sandbox
import { SandboxExecutor, ToolSandbox } from './sandbox/sandbox-executor';
import type { SandboxConfig, SandboxResult } from './sandbox/sandbox-executor';

// Module 3: Updater
import { AutoUpdater } from './updater/auto-updater';
import type { AutoUpdaterConfig, UpdateInfo } from './updater/auto-updater';

// Module 4: Gateway
import { GatewayClient } from './gateway/gateway-client';
import type { GatewayConfig, ConnectionState, MessageResponse } from './gateway/gateway-client';

// Module 5: Diagnostics
import { NetworkDiagnostics } from './diagnostics/network';
import type { DiagnosticResult } from './diagnostics/network';
import { SystemDiagnostics } from './diagnostics/system';
import type { SystemInfo, HealthStatus } from './diagnostics/system';

// Module 6: Queue
import { WorkQueueManager } from './queue/manager';
import type { WorkItem, WorkPriority, WorkStatus } from './queue/manager';

// Module 7: Modes
import { ModeManager } from './modes/mode-manager';
import type { Mode, AgentMode } from './modes/mode-manager';

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
  /** Media processing config */
  media?: {
    enabled?: boolean;
    outputDir?: string;
    defaultQuality?: number;
    maxWidth?: number;
    maxHeight?: number;
    keepMetadata?: boolean;
  };
  /** OAuth config */
  oauth?: {
    enabled?: boolean;
    callbackPort?: number;
    baseUrl?: string;
    providers?: Record<string, OAuthProviderConfig>;
  };
  /** Backup & Restore config */
  backup?: {
    enabled?: boolean;
    backupDir?: string;
  };
  /** CLI & Local Server config */
  cli?: {
    enabled?: boolean;
    port?: number;
  };
  /** Permission config */
  permission?: {
    enabled?: boolean;
    dbPath?: string;
  };
  /** Speech/TTS config */
  speech?: TTSConfig;
  /** Process manager config */
  process?: {
    enabled?: boolean;
  };
  /** Feedback export config */
  feedback?: {
    enabled?: boolean;
    dataDir?: string;
    outputDir?: string;
  };
  /** Telemetry config */
  telemetry?: {
    enabled?: boolean;
    serviceName?: string;
    endpoint?: string;
  };
  /** Analytics config */
  analytics?: {
    enabled?: boolean;
    apiKey?: string;
    host?: string;
  };
  /** i18n config */
  i18n?: Partial<I18nConfig>;
  /** Observability (OpenTelemetry) config */
  observability?: {
    enabled?: boolean;
    serviceName?: string;
    serviceVersion?: string;
  };
  /** Sandbox config */
  sandbox?: {
    enabled?: boolean;
    timeout?: number;
    maxMemoryMB?: number;
  };
  /** Auto updater config (electron only) */
  updater?: {
    enabled?: boolean;
    autoCheck?: boolean;
    autoDownload?: boolean;
    updateUrl?: string;
  };
  /** Gateway config */
  gateway?: {
    enabled?: boolean;
    url?: string;
    apiKey?: string;
  };
  /** Diagnostics config */
  diagnostics?: {
    enabled?: boolean;
    apiEndpoints?: { provider: string; endpoint: string }[];
  };
  /** Work queue config */
  queue?: {
    enabled?: boolean;
    dbPath?: string;
    maxConcurrent?: number;
  };
  /** Mode config */
  mode?: {
    enabled?: boolean;
    modsDirectory?: string;
    defaultMode?: AgentMode;
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
  private mediaProcessor?: ImageProcessor;
  private oauthManager?: OAuthManager;
  private qrLogin?: QRLoginManager;
  private backupManager?: BackupManager;
  private localServer?: LocalServer;

  // New 7 modules
  private permissionManager?: PermissionManager;
  private tts?: TTS;
  private processManager?: ProcessManager;
  private feedbackExporter?: FeedbackExporter;
  private telemetrySystem?: TelemetrySystem;
  private analyticsClient?: AnalyticsClient;
  private i18nManager?: I18nManager;

  // 7 activated modules
  private telemetryManager?: TelemetryManager;
  private sandboxExecutor?: SandboxExecutor;
  private toolSandbox?: ToolSandbox;
  private autoUpdater?: AutoUpdater;
  private gatewayClient?: GatewayClient;
  private networkDiagnostics?: NetworkDiagnostics;
  private systemDiagnostics?: SystemDiagnostics;
  private workQueueManager?: WorkQueueManager;
  private modeManager?: ModeManager;

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
      this.sentryManager = new SentryManager({
        dsn: sentryDsn,
        environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'production',
      });
      this.sentryManager.initialize();
      logger.info('Sentry manager initialized');
    }

    // Initialize Media Processor
    const mediaConfig = this.config.media;
    if (mediaConfig?.enabled !== false) {
      this.mediaProcessor = new ImageProcessor({
        defaultQuality: mediaConfig?.defaultQuality ?? 80,
        maxWidth: mediaConfig?.maxWidth ?? 10000,
        maxHeight: mediaConfig?.maxHeight ?? 10000,
        keepMetadata: mediaConfig?.keepMetadata ?? false,
        tempDir: mediaConfig?.outputDir ?? '/tmp',
      });
      logger.info('Media processor initialized');
    }

    // Initialize OAuth Manager
    const oauthConfig = this.config.oauth;
    if (oauthConfig?.enabled !== false) {
      this.oauthManager = new OAuthManager(oauthConfig?.callbackPort);

      // Register configured providers
      if (oauthConfig?.providers) {
        for (const [name, providerConfig] of Object.entries(oauthConfig.providers)) {
          this.oauthManager.registerProvider({
            ...providerConfig,
            name,
          });
        }
      }

      logger.info('OAuth manager initialized');
    }

    // Initialize QR Login Manager
    this.qrLogin = new QRLoginManager(oauthConfig?.baseUrl || 'http://localhost:3000');
    logger.info('QR login manager initialized');

    // Initialize Permission Manager
    const permissionDbPath = this.config.permission?.dbPath || join(agentDataDir, 'permissions.db');
    this.permissionManager = new PermissionManager(permissionDbPath);
    logger.info('Permission manager initialized');

    // Initialize Speech/TTS
    this.tts = new TTS(this.config.speech || {});
    await this.tts.initialize();
    logger.info('TTS initialized');

    // Initialize Process Manager
    if (this.config.process?.enabled !== false) {
      this.processManager = new ProcessManager();
      logger.info('Process manager initialized');
    }

    // Initialize Feedback Exporter
    if (this.config.feedback?.enabled !== false) {
      const feedbackDataDir = this.config.feedback?.dataDir || agentDataDir;
      const feedbackOutputDir = this.config.feedback?.outputDir || join(agentDataDir, 'exports');
      this.feedbackExporter = new FeedbackExporter(feedbackDataDir, feedbackOutputDir);
      logger.info('Feedback exporter initialized');
    }

    // Initialize Telemetry
    if (this.config.telemetry?.enabled !== false) {
      this.telemetrySystem = new TelemetrySystem({
        serviceName: this.config.telemetry?.serviceName || 'nexus-agent',
        endpoint: this.config.telemetry?.endpoint,
        enabled: true,
      });
      await this.telemetrySystem.initialize();
      logger.info('Telemetry system initialized');
    }

    // Initialize Analytics
    const analyticsApiKey = this.config.analytics?.apiKey || process.env.POSTHOG_API_KEY;
    if (analyticsApiKey && this.config.analytics?.enabled !== false) {
      this.analyticsClient = new AnalyticsClient({
        apiKey: analyticsApiKey,
        host: this.config.analytics?.host,
        enabled: true,
      });
      await this.analyticsClient.initialize();
      logger.info('Analytics client initialized');
    }

    // Initialize i18n
    try {
      this.i18nManager = new I18nManager(this.config.i18n);
      await this.i18nManager.initialize();
      logger.info('i18n manager initialized');
    } catch (error) {
      logger.warn(`i18n init failed: ${(error as Error).message}`);
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
    this.oauthManager?.stopCallbackServer();
    this.qrLogin?.cleanup();
    this.backupManager?.close();
    if (this.localServer) {
      await this.localServer.stop();
    }
    await this.telemetrySystem?.destroy();
    await this.analyticsClient?.destroy();
    await this.i18nManager?.cleanup();
    this.processManager?.stopAll();
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
  // Media Processing API (图像处理)
  // ============================================================================

  /** Convert an image to a different format */
  async convertImage(input: ImageInput, options: ConvertOptions): Promise<ProcessResult> {
    if (!this.mediaProcessor) throw new Error('Media processor not initialized');
    return await this.mediaProcessor.convert(input, options);
  }

  /** Resize an image */
  async resizeImage(input: ImageInput, options: ResizeOptions): Promise<ProcessResult> {
    if (!this.mediaProcessor) throw new Error('Media processor not initialized');
    return await this.mediaProcessor.resize(input, options);
  }

  /** Crop an image */
  async cropImage(input: ImageInput, options: CropOptions): Promise<ProcessResult> {
    if (!this.mediaProcessor) throw new Error('Media processor not initialized');
    return await this.mediaProcessor.crop(input, options);
  }

  /** Rotate an image */
  async rotateImage(input: ImageInput, options: RotateOptions): Promise<ProcessResult> {
    if (!this.mediaProcessor) throw new Error('Media processor not initialized');
    return await this.mediaProcessor.rotate(input, options);
  }

  /** Flip an image (horizontal/vertical) */
  async flipImage(input: ImageInput, options: FlipOptions): Promise<ProcessResult> {
    if (!this.mediaProcessor) throw new Error('Media processor not initialized');
    return await this.mediaProcessor.flip(input, options);
  }

  /** Compress an image */
  async compressImage(input: ImageInput, options: CompressOptions): Promise<ProcessResult> {
    if (!this.mediaProcessor) throw new Error('Media processor not initialized');
    return await this.mediaProcessor.compress(input, options);
  }

  /** Add a watermark to an image */
  async watermarkImage(input: ImageInput, options: WatermarkOptions): Promise<ProcessResult> {
    if (!this.mediaProcessor) throw new Error('Media processor not initialized');
    return await this.mediaProcessor.watermark(input, options);
  }

  /** Get image metadata (dimensions, format, exif, etc.) */
  async getImageInfo(path: string): Promise<ImageMetadata> {
    if (!this.mediaProcessor) throw new Error('Media processor not initialized');
    return await this.mediaProcessor.extractMetadata(path);
  }

  /** Batch process multiple images */
  async batchProcessImages(options: BatchProcessOptions): Promise<BatchProcessResult> {
    if (!this.mediaProcessor) throw new Error('Media processor not initialized');
    return await this.mediaProcessor.batchProcess(options);
  }

  /** Check if media processor is active */
  isMediaProcessorActive(): boolean {
    return this.mediaProcessor !== undefined;
  }

  // ============================================================================
  // OAuth & QR Login API (OAuth 认证 & 扫码登录)
  // ============================================================================

  /** Start OAuth flow for a provider */
  async startOAuth(providerConfig: OAuthProviderConfig): Promise<OAuthToken> {
    if (!this.oauthManager) throw new Error('OAuth manager not initialized');
    // Register the provider first, then authorize
    this.oauthManager.registerProvider(providerConfig);
    await this.oauthManager.startCallbackServer();
    return await this.oauthManager.authorize(providerConfig.name);
  }

  /** Get stored OAuth token for a provider */
  async getOAuthToken(provider: string): Promise<OAuthToken | undefined> {
    if (!this.oauthManager) return undefined;
    return this.oauthManager.getToken(provider);
  }

  /** Refresh OAuth token for a provider */
  async refreshOAuthToken(provider: string): Promise<OAuthToken> {
    if (!this.oauthManager) throw new Error('OAuth manager not initialized');
    return await this.oauthManager.refreshToken(provider);
  }

  /** Revoke OAuth token for a provider */
  revokeOAuthToken(provider: string): void {
    if (!this.oauthManager) return;
    this.oauthManager.revokeToken(provider);
  }

  /** Register an OAuth provider */
  registerOAuthProvider(config: OAuthProviderConfig): void {
    if (!this.oauthManager) throw new Error('OAuth manager not initialized');
    this.oauthManager.registerProvider(config);
  }

  /** Generate a QR code login session */
  async generateQRLogin(sessionExpiryMs?: number): Promise<QRLoginSession> {
    if (!this.qrLogin) throw new Error('QR login manager not initialized');
    return await this.qrLogin.createSession(sessionExpiryMs);
  }

  /** Wait for QR code scan to complete (polls until confirmed/expired) */
  async waitForQRScan(
    sessionId: string,
    onStatusChange?: (status: string, user?: any) => void
  ): Promise<void> {
    if (!this.qrLogin) throw new Error('QR login manager not initialized');
    return await this.qrLogin.pollSession(
      sessionId,
      onStatusChange || (() => {})
    );
  }

  /** Check if OAuth manager is active */
  isOAuthActive(): boolean {
    return this.oauthManager !== undefined;
  }

  /** Check if QR login manager is initialized */
  isQRLoginActive(): boolean {
    return this.qrLogin !== undefined;
  }

  // ============================================================================
  // Backup & Restore API
  // ============================================================================

  /**
   * Create a full backup of agent data
   */
  async createBackup(): Promise<BackupMetadata> {
    if (!this.backupManager) throw new Error('Backup manager is not initialized');
    logger.info('Creating backup via agent API');
    return await this.backupManager.createFullBackup();
  }

  /**
   * Restore agent data from a backup
   */
  async restoreBackup(backupId: string): Promise<void> {
    if (!this.backupManager) throw new Error('Backup manager is not initialized');
    logger.info(`Restoring backup: ${backupId}`);
    const metadata = this.backupManager.getBackup(backupId);
    if (!metadata) {
      throw new Error(`Backup not found: ${backupId}`);
    }
    throw new Error(
      'Restore via RestoreManager is a separate process — use the backup files directly'
    );
  }

  /**
   * List all available backups
   */
  listBackups(): BackupMetadata[] {
    if (!this.backupManager) return [];
    return this.backupManager.listBackups();
  }

  /**
   * Get backup statistics
   */
  getBackupStats(): { totalCount: number; totalSize: number; latestTimestamp: number | null } {
    const backups = this.listBackups();
    if (backups.length === 0) {
      return { totalCount: 0, totalSize: 0, latestTimestamp: null };
    }
    return {
      totalCount: backups.length,
      totalSize: backups.reduce((sum, b) => sum + b.size, 0),
      latestTimestamp: backups.reduce((max, b) => Math.max(max, b.timestamp), 0),
    };
  }

  // ============================================================================
  // CLI & Local Server API
  // ============================================================================

  /**
   * Start the local HTTP API server
   */
  async startLocalServer(port?: number): Promise<void> {
    if (!this.localServer) {
      throw new Error('Local server is not configured. Set cli.enabled in config.');
    }
    const actualPort = port || this.config.cli?.port || 3000;
    if (actualPort !== (this.localServer as any)['config'].port) {
      await this.localServer.stop();
      this.localServer = new LocalServer(this, {
        port: actualPort,
        host: 'localhost',
      });
    }
    await this.localServer.start();
    logger.info(`Local server started on port ${actualPort}`);
  }

  /**
   * Stop the local HTTP API server
   */
  async stopLocalServer(): Promise<void> {
    if (!this.localServer) return;
    await this.localServer.stop();
    logger.info('Local server stopped');
  }

  /**
   * Get local server status
   */
  getLocalServerStatus(): { running: boolean; port?: number } {
    if (!this.localServer) return { running: false };
    return { running: true, port: (this.localServer as any)['config'].port };
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
