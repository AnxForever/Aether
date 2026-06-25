/**
 * Moonshot Connector - Moonshot AI (Kimi)
 */

import { request } from 'undici';
import { Connector, ConnectorConfig, ConnectorRequest, ConnectorResponse, StreamChunk, ModelConfig } from '../types/connector';

export class MoonshotConnector implements Connector {
  readonly provider = 'moonshot';
  private config?: ConnectorConfig;

  async initialize(config: ConnectorConfig): Promise<void> {
    this.config = {
      baseURL: config.baseURL || 'https://api.moonshot.cn/v1',
      ...config
    };
  }

  async *streamResponse(req: ConnectorRequest): AsyncIterable<StreamChunk> {
    if (!this.config) throw new Error('Connector not initialized');

    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        temperature: req.temperature,
        stream: true
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Moonshot API error: ${response.status}`);
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
  }

  async getResponse(req: ConnectorRequest): Promise<ConnectorResponse> {
    if (!this.config) throw new Error('Connector not initialized');

    const response = await request(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        temperature: req.temperature
      })
    });

    const data = await response.body.json() as any;

    return {
      content: data.choices[0].message.content,
      finishReason: 'stop',
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0
      }
    };
  }

  async listModels(): Promise<ModelConfig[]> {
    return [
      {
        id: 'moonshot-v1-128k',
        name: 'Moonshot v1 128K',
        provider: 'moonshot',
        contextWindow: 128000,
        maxOutput: 4096,
        inputPrice: 0.5,
        outputPrice: 0.5,
        capabilities: ['text', 'streaming']
      }
    ];
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config;
  }
}
