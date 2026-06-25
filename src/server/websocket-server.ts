/**
 * WebSocket Server - Real-time bidirectional communication
 */

import { Server as WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server as HTTPServer } from 'http';
import { createLogger } from '../utils/logger';
import { generateUuid } from '../utils/crypto';

const logger = createLogger('WebSocketServer');

/**
 * WebSocket message
 */
export interface WSMessage {
  id: string;
  type: string;
  data: any;
}

/**
 * WebSocket connection
 */
export class WSConnection {
  readonly id: string;
  private ws: WebSocket;
  private handlers = new Map<string, Set<(data: any) => void>>();

  constructor(ws: WebSocket) {
    this.id = generateUuid();
    this.ws = ws;
    this.setupHandlers();
  }

  /**
   * Setup message handlers
   */
  private setupHandlers(): void {
    this.ws.on('message', (raw: Buffer) => {
      try {
        const message: WSMessage = JSON.parse(raw.toString('utf-8'));
        this.handleMessage(message);
      } catch (error: any) {
        logger.error('Invalid WebSocket message:', error as Error);
      }
    });

    this.ws.on('error', (error) => {
      logger.error(`WebSocket error (${this.id}):`, error as Error);
    });

    this.ws.on('close', () => {
      logger.info(`WebSocket closed: ${this.id}`);
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: WSMessage): void {
    const handlers = this.handlers.get(message.type);
    if (!handlers) return;

    for (const handler of handlers) {
      try {
        handler(message.data);
      } catch (error: any) {
        logger.error('Handler error:', error as Error);
      }
    }
  }

  /**
   * Register message handler
   */
  on(type: string, handler: (data: any) => void): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
  }

  /**
   * Send message
   */
  send(type: string, data: any): void {
    if (this.ws.readyState !== WebSocket.OPEN) return;

    const message: WSMessage = {
      id: generateUuid(),
      type,
      data
    };

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error: any) {
      logger.error('Failed to send message:', error as Error);
    }
  }

  /**
   * Close connection
   */
  close(): void {
    this.ws.close();
  }

  /**
   * Check if connection is open
   */
  isOpen(): boolean {
    return this.ws.readyState === WebSocket.OPEN;
  }
}

/**
 * WebSocket Server Manager
 */
export class WSServer {
  private wss: WebSocketServer | null = null;
  private connections = new Map<string, WSConnection>();

  /**
   * Attach to HTTP server
   */
  attach(httpServer: HTTPServer): void {
    this.wss = new WebSocketServer({ server: httpServer });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    logger.info('WebSocket server attached');
  }

  /**
   * Handle new connection
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const connection = new WSConnection(ws);
    this.connections.set(connection.id, connection);

    logger.info(`New WebSocket connection: ${connection.id} (total: ${this.connections.size})`);

    // Remove on close
    ws.on('close', () => {
      this.connections.delete(connection.id);
      logger.info(`Connection removed: ${connection.id} (remaining: ${this.connections.size})`);
    });

    // Emit connection event
    this.onConnection?.(connection);
  }

  /**
   * Connection handler
   */
  onConnection?: (connection: WSConnection) => void;

  /**
   * Broadcast to all connections
   */
  broadcast(type: string, data: any): void {
    for (const conn of this.connections.values()) {
      if (conn.isOpen()) {
        conn.send(type, data);
      }
    }
  }

  /**
   * Send to specific connection
   */
  sendTo(connectionId: string, type: string, data: any): void {
    const conn = this.connections.get(connectionId);
    if (conn && conn.isOpen()) {
      conn.send(type, data);
    }
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): WSConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * List all connections
   */
  listConnections(): WSConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    for (const conn of this.connections.values()) {
      conn.close();
    }
    this.connections.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }
}
