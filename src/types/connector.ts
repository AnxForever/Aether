/**
 * AI Connector Interface
 *
 * Unified interface for all AI providers
 */

import { StreamChunk, ModelConfig, Message } from './index';

// Re-export types needed by connectors
export type { StreamChunk, ModelConfig, Message };

export interface ConnectorConfig {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface ConnectorRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tools?: any[];
  toolChoice?: 'auto' | 'required' | 'none';
}

export interface ConnectorResponse {
  content: string;
  finishReason: 'stop' | 'length' | 'tool-calls' | 'error';
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

/**
 * Base Connector Interface
 * All AI providers must implement this
 */
export interface Connector {
  /** Provider name */
  readonly provider: string;

  /** Initialize connection */
  initialize(config: ConnectorConfig): Promise<void>;

  /** Stream response */
  streamResponse(request: ConnectorRequest): AsyncIterable<StreamChunk>;

  /** Get complete response (non-streaming) */
  getResponse(request: ConnectorRequest): Promise<ConnectorResponse>;

  /** List available models */
  listModels(): Promise<ModelConfig[]>;

  /** Check if provider is available */
  isAvailable(): Promise<boolean>;
}
