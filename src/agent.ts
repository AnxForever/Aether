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

// ============================================================================
// Extracted subsystem modules (reducing God Object size)
// ============================================================================
import * as agentPlugins from './agent/agent-plugins';
import * as agentColaLink from './agent/agent-colalink';

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
        } catch (error: unknown) {
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

    // Initialize ColaLink with E2EE
    if (this.config.colaLink) {
      const colaLinkConfig = {
        dataDir: agentDataDir,
        myHandle: this.config.colaLink?.myHandle || 'aether-user',
        ...this.config.colaLink
      };
      // Remove legacy encryptionKey if present (E2EE is now auto-generated)
      delete (colaLinkConfig as any).encryptionKey;
      this.colaLinkManager = new ColaLinkManager(colaLinkConfig);
      logger.info('ColaLink initialized with E2EE');
    }

    // Initialize Awareness System
    this.awarenessSystem = new AwarenessSystem(this.config.awareness);
    try {
      await this.awarenessSystem.initialize(this);
      logger.info('Awareness system initialized');
    } catch (error: unknown) {
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
      } catch (error: unknown) {
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

    // Initialize Telemetry (OpenTelemetry-backed, backward compat)
    if (this.config.telemetry?.enabled !== false) {
      this.telemetrySystem = new TelemetrySystem({
        serviceName: this.config.telemetry?.serviceName || 'nexus-agent',
        endpoint: this.config.telemetry?.endpoint,
        enabled: true,
      });
      await this.telemetrySystem.initialize();
      logger.info('Telemetry system initialized (OpenTelemetry backend)');
    }

    // Analytics removed: PostHog was replaced by OpenTelemetry + Sentry

    // Initialize i18n
    try {
      this.i18nManager = new I18nManager(this.config.i18n);
      await this.i18nManager.initialize();
      logger.info('i18n manager initialized');
    } catch (error: unknown) {
      logger.warn(`i18n init failed: ${(error as Error).message}`);
    }

    // ============================================================================
    // 7 Activated Modules
    // ============================================================================

    // 1. Observability (OpenTelemetry)
    if (this.config.observability?.enabled !== false) {
      try {
        const otelServiceName = this.config.observability?.serviceName || 'nexus-agent';
        const otelServiceVersion = this.config.observability?.serviceVersion || '1.0.0';
        this.telemetryManager = new TelemetryManager({
          serviceName: otelServiceName,
          serviceVersion: otelServiceVersion,
          environment: process.env.NODE_ENV || 'development',
          tracing: { enabled: true },
          metrics: { enabled: true, interval: 60000 },
          exporter: { type: 'console' },
        });
        await this.telemetryManager.initialize();
        logger.info('TelemetryManager (OpenTelemetry) initialized');
      } catch (error: unknown) {
        logger.warn(`TelemetryManager init skipped: ${(error as Error).message}`);
      }
    }

    // 2. Sandbox
    if (this.config.sandbox?.enabled !== false) {
      this.sandboxExecutor = new SandboxExecutor();
      this.toolSandbox = new ToolSandbox({
        timeout: this.config.sandbox?.timeout || 30000,
        maxMemoryMB: this.config.sandbox?.maxMemoryMB || 512,
      });
      logger.info('Sandbox modules initialized');
    }

    // 3. Updater (electron only — no-op in non-electron env)
    try {
      if (this.config.updater?.enabled !== false && typeof process !== 'undefined' && process.versions?.electron) {
        this.autoUpdater = new AutoUpdater({
          autoCheck: this.config.updater?.autoCheck !== false,
          autoDownload: this.config.updater?.autoDownload !== false,
          updateUrl: this.config.updater?.updateUrl,
        });
        await this.autoUpdater.initialize();
        logger.info('AutoUpdater initialized');
      }
    } catch (error: unknown) {
      logger.warn(`AutoUpdater init skipped (non-electron env): ${(error as Error).message}`);
    }

    // 4. Gateway
    if (this.config.gateway?.enabled && this.config.gateway.url) {
      this.gatewayClient = new GatewayClient({
        url: this.config.gateway.url,
        apiKey: this.config.gateway.apiKey,
      });
      try {
        await this.gatewayClient.connect();
        logger.info('Gateway client connected');
      } catch (error: unknown) {
        logger.warn(`Gateway client connect failed: ${(error as Error).message}`);
      }
    }

    // 5. Diagnostics
    if (this.config.diagnostics?.enabled !== false) {
      this.networkDiagnostics = new NetworkDiagnostics();
      this.systemDiagnostics = new SystemDiagnostics();
      logger.info('Diagnostics modules initialized');
    }

    // 6. Queue
    if (this.config.queue?.enabled !== false) {
      const queueDbPath = this.config.queue?.dbPath || join(agentDataDir, 'work-queue.db');
      const maxConcurrent = this.config.queue?.maxConcurrent || 3;
      this.workQueueManager = new WorkQueueManager(queueDbPath, maxConcurrent);
      logger.info('Work queue manager initialized');
    }

    // 7. Modes
    if (this.config.mode?.enabled !== false) {
      this.modeManager = new ModeManager(this.config.mode?.modsDirectory);
      await this.modeManager.initialize();
      logger.info('Mode manager initialized');
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
    await this.i18nManager?.cleanup();
    this.processManager?.stopAll();

    // 7 activated modules cleanup
    await this.telemetryManager?.shutdown();
    this.gatewayClient?.disconnect();
    this.autoUpdater?.destroy();
    this.workQueueManager?.stop();

    logger.info('Agent cleaned up');
  }

  // ============================================================================
  // Plugin Management API (delegated to agent-plugins.ts)
  // ============================================================================

  async loadPlugin(pluginId: string): Promise<Plugin> {
    return agentPlugins.loadPlugin({ pluginLoader: this.pluginLoader }, pluginId);
  }

  async unloadPlugin(pluginId: string): Promise<void> {
    return agentPlugins.unloadPlugin({ pluginLoader: this.pluginLoader }, pluginId);
  }

  async reloadPlugin(pluginId: string): Promise<Plugin> {
    return agentPlugins.reloadPlugin({ pluginLoader: this.pluginLoader }, pluginId);
  }

  listPlugins(): Plugin[] {
    return agentPlugins.listPlugins();
  }

  listEnabledPlugins(): Plugin[] {
    return agentPlugins.listEnabledPlugins();
  }

  enablePlugin(pluginId: string): void {
    agentPlugins.enablePlugin(pluginId);
  }

  disablePlugin(pluginId: string): void {
    agentPlugins.disablePlugin(pluginId);
  }

  getPlugin(pluginId: string): Plugin | undefined {
    return agentPlugins.getPlugin(pluginId);
  }

  async searchPlugins(query: string, category?: string) {
    return agentPlugins.searchPlugins({ marketplace: this.marketplace }, query, category);
  }

  async getFeaturedPlugins() {
    return agentPlugins.getFeaturedPlugins({ marketplace: this.marketplace });
  }

  async installPlugin(pluginId: string, version?: string): Promise<void> {
    return agentPlugins.installPlugin(
      { marketplace: this.marketplace, loadPlugin: (id) => this.loadPlugin(id) },
      pluginId,
      version,
    );
  }

  async uninstallPlugin(pluginId: string): Promise<void> {
    return agentPlugins.uninstallPlugin(
      { marketplace: this.marketplace, pluginLoader: this.pluginLoader, unloadPlugin: (id) => this.unloadPlugin(id) },
      pluginId,
    );
  }

  async updatePlugin(pluginId: string, version?: string): Promise<void> {
    return agentPlugins.updatePlugin(
      { marketplace: this.marketplace, unloadPlugin: (id) => this.unloadPlugin(id), loadPlugin: (id) => this.loadPlugin(id) },
      pluginId,
      version,
    );
  }

  async checkPluginUpdates() {
    return agentPlugins.checkPluginUpdates({ marketplace: this.marketplace });
  }

  getPluginStats() {
    return agentPlugins.getPluginStats();
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
  // ColaLink API (跨设备消息同步, delegated to agent-colalink.ts)
  // ============================================================================

  async sendColaLinkMessage(toHandle: string, content: string): Promise<ColaLinkMessage> {
    return agentColaLink.sendColaLinkMessage({ colaLinkManager: this.colaLinkManager }, toHandle, content);
  }

  async getColaLinkHistory(handle: string, limit?: number): Promise<ColaLinkMessage[]> {
    return agentColaLink.getColaLinkHistory({ colaLinkManager: this.colaLinkManager }, handle, limit);
  }

  listColaLinkContacts(status?: Contact['status']): Contact[] {
    return agentColaLink.listColaLinkContacts({ colaLinkManager: this.colaLinkManager }, status);
  }

  addColaLinkContact(contact: Omit<Contact, 'addedAt' | 'updatedAt'>): Contact {
    return agentColaLink.addColaLinkContact({ colaLinkManager: this.colaLinkManager }, contact);
  }

  sendColaLinkContactRequest(toHandle: string, message?: string): ContactRequest {
    return agentColaLink.sendColaLinkContactRequest({ colaLinkManager: this.colaLinkManager }, toHandle, message);
  }

  listColaLinkPendingRequests(): ContactRequest[] {
    return agentColaLink.listColaLinkPendingRequests({ colaLinkManager: this.colaLinkManager });
  }

  getColaLinkUnreadCount(): number {
    return agentColaLink.getColaLinkUnreadCount({ colaLinkManager: this.colaLinkManager });
  }

  async getColaLinkRecentConversations(limit?: number) {
    return agentColaLink.getColaLinkRecentConversations({ colaLinkManager: this.colaLinkManager }, limit);
  }

  isColaLinkActive(): boolean {
    return agentColaLink.isColaLinkActive({ colaLinkManager: this.colaLinkManager });
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
    } catch (error: unknown) {
      logger.warn(`Failed to generate diary: ${(error as Error).message}`);
      return null;
    }
  }

  /** Create a draft (conversation highlight) */
  async createAwarenessDraft(content: string, title?: string): Promise<Imprint | null> {
    if (!this.awarenessSystem) return null;
    try {
      return await this.awarenessSystem.createDraft(content, title);
    } catch (error: unknown) {
      logger.warn(`Failed to create draft: ${(error as Error).message}`);
      return null;
    }
  }

  /** Generate daily episode summary */
  async generateAwarenessEpisode(): Promise<Imprint | null> {
    if (!this.awarenessSystem) return null;
    try {
      return await this.awarenessSystem.generateDailyEpisode();
    } catch (error: unknown) {
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

  // ============================================================================
  // Permission Manager API
  // ============================================================================

  /**
   * Check if a specific operation is permitted
   */
  async checkPermission(
    type: PermissionType,
    path: string,
    operation: PermissionOperation,
    reason?: string
  ): Promise<boolean> {
    if (!this.permissionManager) throw new Error('Permission manager not initialized');
    return await this.permissionManager.requestPermission(type, path, operation, reason);
  }

  /**
   * Grant a permission rule
   */
  grantPermission(
    type: PermissionType,
    pattern: string,
    operation: PermissionOperation
  ): void {
    if (!this.permissionManager) throw new Error('Permission manager not initialized');
    this.permissionManager.addRule(type, pattern, operation, 'allow');
  }

  /**
   * Revoke a permission rule by pattern
   */
  revokePermission(pattern: string): void {
    if (!this.permissionManager) throw new Error('Permission manager not initialized');
    this.permissionManager.removeRule(pattern);
  }

  /**
   * List all permission rules
   */
  listPermissions(): any[] {
    if (!this.permissionManager) return [];
    return this.permissionManager.listRules();
  }

  // ============================================================================
  // Speech/TTS API
  // ============================================================================

  /**
   * Convert text to speech
   */
  async textToSpeech(text: string, options?: Partial<TTSConfig>): Promise<SynthesisResult> {
    if (!this.tts) throw new Error('TTS not initialized');
    return await this.tts.synthesize(text, options);
  }

  /**
   * List available TTS voices
   */
  listVoices(): Voice[] {
    if (!this.tts) return [];
    return this.tts.getVoices();
  }

  /**
   * Get TTS engine status
   */
  getSpeechStatus(): { initialized: boolean; voiceCount: number } {
    return {
      initialized: this.tts !== undefined,
      voiceCount: this.tts ? this.tts.getVoices().length : 0,
    };
  }

  // ============================================================================
  // System/Process Manager API
  // ============================================================================

  /**
   * Get system information
   */
  getSystemInfo(): Record<string, any> {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    };
  }

  /**
   * Get list of managed processes
   */
  getProcessList(): ManagedProcessInfo[] {
    if (!this.processManager) return [];
    return this.processManager.getAllProcesses();
  }

  /**
   * Get resource usage info
   */
  getResourceUsage(): Record<string, any> {
    const usage = process.memoryUsage();
    return {
      memory: {
        rss: usage.rss,
        heapTotal: usage.heapTotal,
        heapUsed: usage.heapUsed,
        external: usage.external,
      },
      cpu: process.cpuUsage(),
      uptime: process.uptime(),
    };
  }

  /**
   * Start a managed process
   */
  async startProcess(config: ProcessConfig): Promise<void> {
    if (!this.processManager) throw new Error('Process manager not initialized');
    await this.processManager.start(config);
  }

  /**
   * Stop a managed process
   */
  async stopProcess(id: string): Promise<void> {
    if (!this.processManager) throw new Error('Process manager not initialized');
    await this.processManager.stop(id);
  }

  // ============================================================================
  // Feedback Exporter API
  // ============================================================================

  /**
   * Submit feedback package (export diagnostic data)
   */
  async submitFeedback(options?: ExportOptions): Promise<string> {
    if (!this.feedbackExporter) throw new Error('Feedback exporter not initialized');
    return await this.feedbackExporter.export(options);
  }

  /**
   * Get feedback export stats
   */
  getFeedbackStats(): Record<string, any> {
    return {
      enabled: this.feedbackExporter !== undefined,
    };
  }

  /**
   * List available feedback/export packages
   */
  listFeedback(): string[] {
    if (!this.feedbackExporter) return [];
    return [];
  }

  // ============================================================================
  // Telemetry API (OpenTelemetry backend)
  // ============================================================================

  /**
   * Track a telemetry event — delegates to OpenTelemetry tracer
   */
  trackTelemetryEvent(name: string, attributes?: Record<string, any>): void {
    // Use TelemetryManager (OpenTelemetry) if available, otherwise fall back
    if (this.telemetryManager?.isReady()) {
      const tracer = this.telemetryManager.getTracer();
      tracer.startSpan(name, attributes);
    }
  }

  /**
   * Track a telemetry metric — delegates to OpenTelemetry metrics
   */
  trackTelemetryMetric(name: string, value: number, attributes?: Record<string, any>): void {
    if (this.telemetryManager?.isReady()) {
      const metrics = this.telemetryManager.getMetrics();
      metrics.incrementCounter(name, value, attributes);
    }
  }

  /**
   * Get telemetry system status
   */
  getTelemetryStatus(): { enabled: boolean; active: boolean } {
    return {
      enabled: this.telemetryManager !== undefined,
      active: this.telemetryManager?.isReady() ?? false,
    };
  }

  // ============================================================================
  // Analytics API (removed — PostHog replaced by OpenTelemetry + Sentry)
  // ============================================================================

  /**
   * Track an analytics event — no-op, analytics routed through OpenTelemetry
   */
  trackAnalyticsEvent(_event: string, _properties?: Record<string, any>): void {
    logger.debug('Analytics event suppressed: use OpenTelemetry/Sentry instead');
  }

  /**
   * Identify a user for analytics — no-op
   */
  identifyAnalyticsUser(_userId: string, _properties?: Record<string, any>): void {
    logger.debug('Analytics identify suppressed: use OpenTelemetry/Sentry instead');
  }

  /**
   * Get analytics client status
   */
  getAnalyticsStatus(): { enabled: boolean; active: boolean } {
    return { enabled: false, active: false };
  }

  // ============================================================================
  // i18n API
  // ============================================================================

  /**
   * Set the current language
   */
  async setLanguage(locale: SupportedLocale): Promise<void> {
    if (!this.i18nManager) throw new Error('i18n manager not initialized');
    await this.i18nManager.changeLanguage(locale);
  }

  /**
   * Translate a key
   */
  translate(key: string, options?: TranslationOptions): string {
    if (!this.i18nManager) return key;
    return this.i18nManager.t(key, options);
  }

  /**
   * Get current language
   */
  getCurrentLanguage(): SupportedLocale | null {
    if (!this.i18nManager) return null;
    return this.i18nManager.getCurrentLocale();
  }

  /**
   * List supported languages
   */
  listLanguages(): SupportedLocale[] {
    if (!this.i18nManager) return [];
    return this.i18nManager.getAvailableLocales();
  }

  // ============================================================================
  // 7 Activated Modules API
  // ============================================================================

  // ---------------------------------------------------------------------------
  // 1. Observability (OpenTelemetry)
  // ---------------------------------------------------------------------------

  /** Get current telemetry metrics snapshot */
  async getMetrics(): Promise<Record<string, any>> {
    if (!this.telemetryManager) return {};
    try {
      const metrics = this.telemetryManager.getMetrics();
      return { counters: (metrics as any).counters, histograms: (metrics as any).histograms };
    } catch (error: unknown) {
      logger.warn('Failed to get metrics:', error instanceof Error ? error : new Error(String(error)));
      return {};
    }
  }

  /** Get current trace context */
  getTraces(): Record<string, any> | null {
    if (!this.telemetryManager) return null;
    try {
      const tracer = this.telemetryManager.getTracer();
      const ctx = tracer.getCurrentContext();
      return ctx ? { traceId: ctx.traceId, spanId: ctx.spanId } : null;
    } catch (error: unknown) {
      logger.warn('Failed to get traces:', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /** Check if observability is enabled */
  isObservabilityEnabled(): boolean {
    return this.telemetryManager?.isReady() ?? false;
  }

  // ---------------------------------------------------------------------------
  // 2. Sandbox
  // ---------------------------------------------------------------------------

  /** Execute code in a sandboxed environment */
  async executeInSandbox(code: string, language: string): Promise<SandboxResult> {
    if (!this.sandboxExecutor) throw new Error('Sandbox is not initialized');
    const command = language === 'node' || language === 'javascript' ? 'node' : language;
    return await this.sandboxExecutor.execute(command, ['-e', code]);
  }

  /** Get sandbox system status */
  getSandboxStatus(): { initialized: boolean; platform: string } {
    if (!this.sandboxExecutor) return { initialized: false, platform: '' };
    return { initialized: true, platform: (this.sandboxExecutor as any).platform };
  }

  // ---------------------------------------------------------------------------
  // 3. Auto Updater
  // ---------------------------------------------------------------------------

  /** Check for available updates */
  async checkForUpdates(): Promise<UpdateInfo | null> {
    if (!this.autoUpdater) throw new Error('AutoUpdater is not initialized (non-electron env)');
    return await this.autoUpdater.checkForUpdates();
  }

  /** Get current application version */
  getCurrentVersion(): string {
    if (!this.autoUpdater) return process.env.APP_VERSION || '0.0.0';
    return this.autoUpdater.getCurrentVersion();
  }

  /** Check if an update is available */
  isUpdateAvailable(): boolean {
    if (!this.autoUpdater) return false;
    return this.autoUpdater.getStatus() === 'available';
  }

  // ---------------------------------------------------------------------------
  // 4. Gateway
  // ---------------------------------------------------------------------------

  /** Authenticate and connect to gateway */
  async authenticateGateway(): Promise<void> {
    if (!this.gatewayClient) throw new Error('Gateway is not configured');
    await this.gatewayClient.connect();
  }

  /** Get the current gateway connection state */
  getGatewayToken(): string | null {
    if (!this.gatewayClient) return null;
    return this.gatewayClient.getState() === 'connected' ? 'connected' : null;
  }

  /** Check if gateway is connected */
  isGatewayConnected(): boolean {
    return this.gatewayClient?.getState() === 'connected';
  }

  // ---------------------------------------------------------------------------
  // 5. Diagnostics
  // ---------------------------------------------------------------------------

  /** Run full system diagnostics */
  async runDiagnostics(): Promise<{
    network: DiagnosticResult | null;
    system: SystemInfo | null;
    health: HealthStatus | null;
  }> {
    const endpoints = this.config.diagnostics?.apiEndpoints || [];
    const network = this.networkDiagnostics
      ? await this.networkDiagnostics.runDiagnostics(endpoints)
      : null;
    const system = this.systemDiagnostics ? await this.systemDiagnostics.getSystemInfo() : null;
    const health = this.systemDiagnostics ? await this.systemDiagnostics.checkHealth() : null;
    return { network, system, health };
  }

  /** Get system health status */
  async getSystemHealth(): Promise<HealthStatus | null> {
    if (!this.systemDiagnostics) return null;
    return await this.systemDiagnostics.checkHealth();
  }

  /** Get a full diagnostic report */
  async getDiagnosticReport(): Promise<string | null> {
    if (!this.systemDiagnostics) return null;
    return await this.systemDiagnostics.generateReport();
  }

  // ---------------------------------------------------------------------------
  // 6. Work Queue
  // ---------------------------------------------------------------------------

  /** Enqueue a job into the work queue */
  async enqueueJob(
    type: string,
    data: any,
    priority?: WorkPriority,
    maxRetries?: number
  ): Promise<string> {
    if (!this.workQueueManager) throw new Error('Work queue is not initialized');
    return await this.workQueueManager.addWork(type, data, priority, maxRetries);
  }

  /** Get job status by ID */
  async getJobStatus(jobId: string): Promise<WorkItem | null> {
    if (!this.workQueueManager) return null;
    return this.workQueueManager.getWork(jobId);
  }

  /** List jobs in the queue */
  async listJobs(status?: WorkStatus, limit?: number): Promise<WorkItem[]> {
    if (!this.workQueueManager) return [];
    return await this.workQueueManager.listWork(status, limit);
  }

  // ---------------------------------------------------------------------------
  // 7. Mode Manager
  // ---------------------------------------------------------------------------

  /** Set the agent mode (chat or coding) */
  async setMode(modeName: AgentMode): Promise<void> {
    if (!this.modeManager) throw new Error('Mode manager is not initialized');
    await this.modeManager.switchTo(modeName);
  }

  /** Get the current agent mode */
  getCurrentMode(): AgentMode {
    return this.modeManager?.getCurrentMode() ?? 'chat';
  }

  /** List all available modes */
  listModes(): Mode[] {
    if (!this.modeManager) return [];
    return this.modeManager.listModes();
  }
}

/**
 * Create Nexus Agent instance
 */
export function createNexusAgent(config: NexusAgentConfig): NexusAgent {
  return new NexusAgent(config);
}
