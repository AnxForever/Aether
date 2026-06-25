/**
 * MiniMax Connector - MiniMax AI
 */

import { request as undiciRequest } from 'undici';
import { Connector, ConnectorConfig, ConnectorRequest, ConnectorResponse, StreamChunk, ModelConfig } from '../types/connector';
import { createLogger } from '../utils/logger';

const logger = createLogger('Connector:MiniMax');

export class MiniMaxConnector implements Connector {
  readonly provider = 'minimax';
  private config?: ConnectorConfig;

  async initialize(config: ConnectorConfig): Promise<void> {
    this.config = {
      baseURL: config.baseURL || 'https://api.minimax.chat/v1',
      ...config
    };
  }

  async *streamResponse(request: ConnectorRequest): AsyncIterable<StreamChunk> {
    if (!this.config) throw new Error('Connector not initialized');
    logger.info('Sending request to {provider}', { model: request.model, provider: this.provider });

    try {
      const response = await fetch(`${this.config.baseURL}/text/chatcompletion_v2`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          temperature: request.temperature,
          stream: true
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok || !response.body) {
        throw new Error(`MiniMax API error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.choices?.[0]?.delta?.content) {
                yield {
                  type: 'text',
                  content: parsed.choices[0].delta.content
                };
              }
            } catch { /* isAvailable check — expected */ }
          }
        }
      }

      logger.info('Response received from {provider}', { finishReason: 'streaming', provider: this.provider });
    } catch (error) {
      logger.error('API request failed for {provider}', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async getResponse(request: ConnectorRequest): Promise<ConnectorResponse> {
    if (!this.config) throw new Error('Connector not initialized');
    logger.info('Sending request to {provider}', { model: request.model, provider: this.provider });

    try {
      const response = await undiciRequest(`${this.config.baseURL}/text/chatcompletion_v2`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          temperature: request.temperature
        })
      });

      const data = await response.body.json() as any;

      logger.info('Response received from {provider}', { finishReason: 'stop', provider: this.provider });

      return {
        content: data.choices[0].message.content,
        finishReason: 'stop',
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0
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
        id: 'abab6.5s-chat',
        name: 'MiniMax abab6.5s',
        provider: 'minimax',
        contextWindow: 245760,
        maxOutput: 8192,
        inputPrice: 0.1,
        outputPrice: 0.1,
        capabilities: ['text', 'streaming']
      }
    ];
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config;
  }
}
