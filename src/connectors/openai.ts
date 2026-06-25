/**
 * OpenAI Connector - OpenAI/ChatGPT API
 */

import OpenAI from 'openai';
import { Connector, ConnectorConfig, ConnectorRequest, ConnectorResponse, StreamChunk, ModelConfig } from '../types/connector';

export class OpenAIConnector implements Connector {
  readonly provider = 'openai';
  private client?: OpenAI;

  async initialize(config: ConnectorConfig): Promise<void> {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 3
    });
  }

  async *streamResponse(request: ConnectorRequest): AsyncIterable<StreamChunk> {
    if (!this.client) throw new Error('Connector not initialized');

    const stream = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: true
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        yield {
          type: 'text',
          content: delta.content
        };
      }
    }
  }

  async getResponse(request: ConnectorRequest): Promise<ConnectorResponse> {
    if (!this.client) throw new Error('Connector not initialized');

    const response = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      temperature: request.temperature,
      max_tokens: request.maxTokens
    });

    const choice = response.choices[0];

    return {
      content: choice.message.content || '',
      finishReason: choice.finish_reason === 'stop' ? 'stop' : 'length',
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0
      }
    };
  }

  async listModels(): Promise<ModelConfig[]> {
    return [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        contextWindow: 128000,
        maxOutput: 16384,
        inputPrice: 2.5,
        outputPrice: 10,
        capabilities: ['text', 'vision', 'function-calling', 'streaming']
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        contextWindow: 128000,
        maxOutput: 16384,
        inputPrice: 0.15,
        outputPrice: 0.6,
        capabilities: ['text', 'vision', 'function-calling', 'streaming']
      }
    ];
  }

  async isAvailable(): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 10
      });
      return true;
    } catch { /* isAvailable check — expected */
      return false;
    }
  }
}
