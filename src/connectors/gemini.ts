/**
 * Gemini Connector - Google Generative AI
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Connector, ConnectorConfig, ConnectorRequest, ConnectorResponse, StreamChunk, ModelConfig } from '../types/connector';
import { createLogger } from '../utils/logger';

const logger = createLogger('Connector:Gemini');

export class GeminiConnector implements Connector {
  readonly provider = 'gemini';
  private client?: GoogleGenerativeAI;

  async initialize(config: ConnectorConfig): Promise<void> {
    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  async *streamResponse(request: ConnectorRequest): AsyncIterable<StreamChunk> {
    if (!this.client) throw new Error('Connector not initialized');
    logger.info('Sending request to {provider}', { model: request.model, provider: this.provider });

    try {
      const model = this.client.getGenerativeModel({ model: request.model });

      const chat = model.startChat({
        history: request.messages.slice(0, -1).map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        }))
      });

      const lastMessage = request.messages[request.messages.length - 1];
      const result = await chat.sendMessageStream(lastMessage.content);

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield {
            type: 'text',
            content: text
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
      const model = this.client.getGenerativeModel({ model: request.model });

      const chat = model.startChat({
        history: request.messages.slice(0, -1).map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        }))
      });

      const lastMessage = request.messages[request.messages.length - 1];
      const result = await chat.sendMessage(lastMessage.content);
      const response = result.response;

      logger.info('Response received from {provider}', { finishReason: 'stop', provider: this.provider });

      return {
        content: response.text(),
        finishReason: 'stop',
        usage: {
          inputTokens: 0, // Gemini doesn't provide token usage
          outputTokens: 0
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
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash',
        provider: 'gemini',
        contextWindow: 1000000,
        maxOutput: 8192,
        inputPrice: 0,
        outputPrice: 0,
        capabilities: ['text', 'vision', 'streaming']
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'gemini',
        contextWindow: 2000000,
        maxOutput: 8192,
        inputPrice: 1.25,
        outputPrice: 5,
        capabilities: ['text', 'vision', 'streaming']
      }
    ];
  }

  async isAvailable(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const model = this.client.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      await model.generateContent('test');
      return true;
    } catch { /* isAvailable check — expected */
      return false;
    }
  }
}
