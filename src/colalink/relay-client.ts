/**
 * ColaLink Relay Client - WebSocket connection to relay server
 */

import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';

const logger = createLogger('ColaLink:Relay');

/**
 * Relay message
 */
interface RelayMessage {
  type: 'auth' | 'message' | 'receipt' | 'presence';
  data: any;
}

/**
 * Relay Client
 */
export class RelayClient extends EventEmitter {
  private ws?: WebSocket;
  private relayUrl: string;
  private handle: string;
  private token: string;
  private connected = false;
  private reconnectTimer?: NodeJS.Timeout;

  constructor(relayUrl: string, handle: string, token: string) {
    super();
    this.relayUrl = relayUrl;
    this.handle = handle;
    this.token = token;
  }

  /**
   * Connect to relay server
   */
  connect(): void {
    if (this.ws && this.connected) return;

    logger.info(`Connecting to relay: ${this.relayUrl}`);

    this.ws = new WebSocket(this.relayUrl);

    this.ws.on('open', () => {
      this.connected = true;
      logger.info('Connected to relay server');

      // Authenticate
      this.send({
        type: 'auth',
        data: {
          handle: this.handle,
          token: this.token
        }
      });

      this.emit('connected');
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const message: RelayMessage = JSON.parse(data.toString('utf-8'));
        this.handleMessage(message);
      } catch (error: any) {
        logger.error('Failed to parse relay message:', error as Error);
      }
    });

    this.ws.on('close', () => {
      this.connected = false;
      logger.warn('Disconnected from relay server');
      this.emit('disconnected');

      // Auto-reconnect after 5 seconds
      this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    });

    this.ws.on('error', (error) => {
      logger.error('Relay connection error:', error as Error);
      this.emit('error', error);
    });
  }

  /**
   * Disconnect from relay
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }

    this.connected = false;
    logger.info('Disconnected from relay');
  }

  /**
   * Send message through relay
   */
  sendMessage(toHandle: string, content: string): void {
    this.send({
      type: 'message',
      data: {
        to: toHandle,
        content
      }
    });
  }

  /**
   * Send receipt
   */
  sendReceipt(messageId: string, status: 'delivered' | 'read'): void {
    this.send({
      type: 'receipt',
      data: {
        messageId,
        status
      }
    });
  }

  /**
   * Handle incoming relay message
   */
  private handleMessage(message: RelayMessage): void {
    switch (message.type) {
      case 'message':
        this.emit('message-received', message.data);
        break;

      case 'receipt':
        this.emit('message-receipt', message.data);
        break;

      case 'presence':
        this.emit('presence', message.data);
        break;

      default:
        logger.warn('Unknown relay message type:', { type: message.type });
    }
  }

  /**
   * Send message to relay
   */
  private send(message: RelayMessage): void {
    if (!this.ws || !this.connected) {
      logger.warn('Cannot send message: not connected');
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}
