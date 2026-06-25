/**
 * Gateway Client
 *
 * WebSocket-based gateway client for real-time communication
 * with backend services. Supports automatic reconnection,
 * message queuing, and heartbeat monitoring.
 *
 * @module gateway/gateway-client
 */

import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { createLogger } from '../utils/logger';

const logger = createLogger('GatewayClient');

// ============================================================================
// Type Definitions
// ============================================================================

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'closed';

export interface GatewayConfig {
  url: string;
  apiKey?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  messageTimeout?: number;
  enableCompression?: boolean;
}

export interface GatewayMessage {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
}

export interface MessageResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

// ============================================================================
// GatewayClient Class
// ============================================================================

export class GatewayClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageQueue: GatewayMessage[] = [];
  private pendingMessages = new Map<string, (response: MessageResponse) => void>();

  constructor(private config: GatewayConfig) {
    super();

    // Set defaults
    this.config.reconnect = config.reconnect !== false;
    this.config.reconnectInterval = config.reconnectInterval || 5000;
    this.config.maxReconnectAttempts = config.maxReconnectAttempts || 10;
    this.config.heartbeatInterval = config.heartbeatInterval || 30000;
    this.config.messageTimeout = config.messageTimeout || 30000;
    this.config.enableCompression = config.enableCompression !== false;
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Connect to gateway
   */
  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }

    this.state = 'connecting';
    this.emit('state', this.state);

    return new Promise((resolve, reject) => {
      const wsUrl = this.buildWebSocketUrl();

      this.ws = new WebSocket(wsUrl, {
        headers: this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : undefined,
      });

      this.ws.on('open', () => {
        this.state = 'connected';
        this.reconnectAttempts = 0;
        this.emit('state', this.state);
        this.emit('connected');
        this.startHeartbeat();
        this.flushMessageQueue();
        resolve();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });

      this.ws.on('close', () => {
        this.handleDisconnect();
      });
    });
  }

  /**
   * Disconnect from gateway
   */
  async disconnect(): Promise<void> {
    if (this.state === 'disconnected' || this.state === 'closed') {
      return;
    }

    this.state = 'closed';
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.emit('state', this.state);
    this.emit('disconnected');
  }

  /**
   * Send message to gateway
   */
  async send(type: string, payload: any): Promise<MessageResponse> {
    const message: GatewayMessage = {
      id: this.generateMessageId(),
      type,
      payload,
      timestamp: Date.now(),
    };

    // Queue message if not connected
    if (this.state !== 'connected') {
      this.messageQueue.push(message);
      throw new Error('Gateway not connected, message queued');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(message.id);
        reject(new Error('Message timeout'));
      }, this.config.messageTimeout);

      this.pendingMessages.set(message.id, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      this.ws!.send(JSON.stringify(message));
    });
  }

  /**
   * Build WebSocket URL
   */
  private buildWebSocketUrl(): string {
    return this.config.url;
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Handle response to pending message
      if (message.id && this.pendingMessages.has(message.id)) {
        const callback = this.pendingMessages.get(message.id)!;
        this.pendingMessages.delete(message.id);
        callback(message);
        return;
      }

      // Emit as event
      this.emit('message', message);
    } catch (error) {
      this.emit('error', new Error('Failed to parse message'));
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(): void {
    if (this.state === 'closed') {
      return;
    }

    this.state = 'disconnected';
    this.stopHeartbeat();
    this.emit('state', this.state);
    this.emit('disconnected');

    // Attempt reconnection
    if (this.config.reconnect && this.reconnectAttempts < this.config.maxReconnectAttempts!) {
      this.reconnect();
    }
  }

  /**
   * Reconnect to gateway
   */
  private async reconnect(): Promise<void> {
    this.reconnectAttempts++;
    this.state = 'reconnecting';
    this.emit('state', this.state);
    this.emit('reconnecting', this.reconnectAttempts);

    await new Promise((resolve) => setTimeout(resolve, this.config.reconnectInterval));

    try {
      await this.connect();
    } catch (error) {
      this.handleDisconnect();
    }
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.state === 'connected' && this.ws) {
        this.ws.ping();
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Flush queued messages
   */
  private async flushMessageQueue(): Promise<void> {
    while (this.messageQueue.length > 0 && this.state === 'connected') {
      const message = this.messageQueue.shift()!;
      try {
        await this.send(message.type, message.payload);
      } catch (error) {
        logger.error('Failed to send queued message', error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export function createGatewayClient(config: GatewayConfig): GatewayClient {
  return new GatewayClient(config);
}

export default GatewayClient;
