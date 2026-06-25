/**
 * Claude Connector - Anthropic API
 */

import Anthropic from '@anthropic-ai/sdk';
import { Connector, ConnectorConfig, ConnectorRequest, ConnectorResponse, StreamChunk, ModelConfig } from '../types/connector';
import { createLogger } from '../utils/logger';

const logger = createLogger('Connector:Claude');

export class ClaudeConnector implements Connector {
  readonly provider = 'claude';
  private client?: Anthropic;

  async initialize(config: ConnectorConfig): Promise<void> {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 3
    });
  }

  async *streamResponse(request: ConnectorRequest): AsyncIterable<StreamChunk> {
    if (!this.client) throw new Error('Connector not initialized');
    logger.info('Sending request to {provider}', { model: request.model, provider: this.provider });

    try {
      const stream = await this.client.messages.stream({
        model: request.model,
        messages: request.messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        })),
        temperature: request.temperature,
        max_tokens: request.maxTokens || 4096,
        stream: true
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          yield {
            type: 'text',
            content: chunk.delta.text
          };
        }
      }

      logger.info('Response received from {provider}', { finishReason: 'streaming', provider: this.provider });
    } catch (error) {
      logger.error('API request failed for {provider}', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async getResponse(request: ConnectorRequest): Promise<ConnectorResponse> {
    if (!this.client) throw new Error('Connector not initialized');
    logger.info('Sending request to {provider}', { model: request.model, provider: this.provider });

    try {
      const response = await this.client.messages.create({
        model: request.model,
        messages: request.messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        })),
        temperature: request.temperature,
        max_tokens: request.maxTokens || 4096
      });

      const content = response.content[0];
      const finishReason = response.stop_reason === 'end_turn' ? 'stop' : 'length';

      logger.info('Response received from {provider}', { finishReason, provider: this.provider });

      return {
        content: content.type === 'text' ? content.text : '',
        finishReason,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens
        }
      };
    } catch (error) {
      logger.error('API request failed for {provider}', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async listModels(): Promise<ModelConfig[]> {
    return [
      {
        id: 'claude-opus-4-20250514',
        name: 'Claude Opus 4',
        provider: 'claude',
        contextWindow: 200000,
        maxOutput: 16384,
        inputPrice: 15,
        outputPrice: 75,
        capabilities: ['text', 'vision', 'function-calling', 'streaming']
      },
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        provider: 'claude',
        contextWindow: 200000,
        maxOutput: 16384,
        inputPrice: 3,
        outputPrice: 15,
        capabilities: ['text', 'vision', 'function-calling', 'streaming']
      }
    ];
  }

  async isAvailable(): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 10
      });
      return true;
    } catch { /* isAvailable check — expected */
      return false;
    }
  }
}
