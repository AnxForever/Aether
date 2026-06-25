import { createLogger } from '../utils/logger';

const logger = createLogger('ConnectorRegistry');

/**
 * Connector Registry
 *
 * Central registry for all AI provider connectors
 */

import { Connector } from '../types/connector';
import { AIProvider } from '../types';
import { ClaudeConnector } from './claude';
import { OpenAIConnector } from './openai';
import { GeminiConnector } from './gemini';
import { MiniMaxConnector } from './minimax';
import { MoonshotConnector } from './moonshot';
import { GLMConnector } from './glm';
import { DeepSeekConnector } from './deepseek';

export class ConnectorRegistry {
  private connectors: Map<AIProvider, Connector> = new Map();

  constructor() {
    // Register all connectors
    this.register('claude', new ClaudeConnector());
    this.register('openai', new OpenAIConnector());
    this.register('gemini', new GeminiConnector());
    this.register('minimax', new MiniMaxConnector());
    this.register('moonshot', new MoonshotConnector());
    this.register('glm', new GLMConnector());
    this.register('deepseek', new DeepSeekConnector());
  }

  private register(provider: AIProvider, connector: Connector): void {
    this.connectors.set(provider, connector);
  }

  get(provider: AIProvider): Connector | undefined {
    return this.connectors.get(provider);
  }

  listProviders(): AIProvider[] {
    return Array.from(this.connectors.keys());
  }

  async getAllModels() {
    const allModels = [];

    for (const [provider, connector] of this.connectors) {
      try {
        const models = await connector.listModels();
        allModels.push(...models);
      } catch (error) {
        logger.error(`Failed to list models for ${provider}:`, error as Error);
      }
    }

    return allModels;
  }
}

// Export singleton instance
export const connectorRegistry = new ConnectorRegistry();

// Export all connectors
export * from './claude';
export * from './openai';
export * from './gemini';
export * from './minimax';
export * from './moonshot';
export * from './glm';
export * from './deepseek';
