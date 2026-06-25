/**
 * SSE Server - Server-Sent Events for streaming
 */

import { ServerResponse } from 'http';
import { createLogger } from '../utils/logger';

const logger = createLogger('SSEServer');

/**
 * SSE connection
 */
export class SSEConnection {
  private res: ServerResponse;
  private closed = false;

  constructor(res: ServerResponse) {
    this.res = res;
    this.setupHeaders();
    this.setupCloseHandlers();
  }

  /**
   * Setup SSE headers
   */
  private setupHeaders(): void {
    this.res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
  }

  /**
   * Setup close handlers
   */
  private setupCloseHandlers(): void {
    this.res.on('close', () => {
      this.closed = true;
      logger.debug('SSE connection closed');
    });
  }

  /**
   * Send event
   */
  send(event: string, data: any): void {
    if (this.closed) return;

    try {
      const payload = JSON.stringify(data);
      this.res.write(`event: ${event}\n`);
      this.res.write(`data: ${payload}\n\n`);
    } catch (error: any) {
      logger.error('Failed to send SSE event:', error as Error);
    }
  }

  /**
   * Send message
   */
  message(data: any): void {
    this.send('message', data);
  }

  /**
   * Send error
   */
  error(message: string): void {
    this.send('error', { message });
  }

  /**
   * Send comment (keepalive)
   */
  comment(text: string = 'keepalive'): void {
    if (this.closed) return;
    this.res.write(`: ${text}\n\n`);
  }

  /**
   * Close connection
   */
  close(): void {
    if (!this.closed) {
      this.closed = true;
      this.res.end();
    }
  }

  /**
   * Check if connection is closed
   */
  isClosed(): boolean {
    return this.closed;
  }
}

/**
 * SSE Server
 */
export class SSEServer {
  private connections = new Set<SSEConnection>();
  private keepaliveInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startKeepalive();
  }

  /**
   * Create SSE connection
   */
  createConnection(res: ServerResponse): SSEConnection {
    const connection = new SSEConnection(res);
    this.connections.add(connection);

    // Remove on close
    res.on('close', () => {
      this.connections.delete(connection);
    });

    logger.info(`SSE connection created (total: ${this.connections.size})`);
    return connection;
  }

  /**
   * Broadcast to all connections
   */
  broadcast(event: string, data: any): void {
    for (const conn of this.connections) {
      if (!conn.isClosed()) {
        conn.send(event, data);
      }
    }
  }

  /**
   * Start keepalive
   */
  private startKeepalive(): void {
    this.keepaliveInterval = setInterval(() => {
      for (const conn of this.connections) {
        if (!conn.isClosed()) {
          conn.comment();
        }
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop keepalive
   */
  private stopKeepalive(): void {
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    for (const conn of this.connections) {
      conn.close();
    }
    this.connections.clear();
    this.stopKeepalive();
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }
}
