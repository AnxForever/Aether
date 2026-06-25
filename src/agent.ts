/**
 * Nexus Agent - Main Agent Class
 *
 * High-level API for interacting with Nexus
 */

import { Orchestrator } from './core/orchestrator';
import { UserInput, AgentContext, Message, AgentSettings } from './types';
import { connectorRegistry } from './connectors';
import { randomUUID } from 'crypto';

export interface NexusAgentConfig {
  model?: string;
  provider?: string;
  apiKeys?: Record<string, string>;
  dataDir?: string;
  deviceId?: string;
}

export class NexusAgent {
  private orchestrator: Orchestrator;
  private context: AgentContext;
  private config: NexusAgentConfig;

  constructor(config: NexusAgentConfig) {
    this.config = config;

    // Initialize orchestrator
    this.orchestrator = new Orchestrator({
      defaultModel: config.model || 'claude-sonnet-4-20250514',
      defaultProvider: config.provider || 'claude',
      maxConcurrentCycles: 10
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
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Cleanup resources if needed
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
   * Get available models
   */
  async getAvailableModels() {
    return await connectorRegistry.getAllModels();
  }
}

/**
 * Create Nexus Agent instance
 */
export function createNexusAgent(config: NexusAgentConfig): NexusAgent {
  return new NexusAgent(config);
}
