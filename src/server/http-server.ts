/**
 * HTTP Server - REST API server
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import { createLogger } from '../utils/logger';
import { Router, Route } from './routes';

const logger = createLogger('HTTPServer');

export interface HTTPServerConfig {
  port: number;
  host?: string;
  cors?: boolean;
  maxBodySize?: number;
}

export class HTTPServer {
  private server: ReturnType<typeof createServer> | null = null;
  private router: Router;
  private config: Required<HTTPServerConfig>;

  constructor(config: HTTPServerConfig) {
    this.config = {
      host: '127.0.0.1',
      cors: true,
      maxBodySize: 10 * 1024 * 1024, // 10MB
      ...config
    };

    this.router = new Router();
  }

  /**
   * Start server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => this.handleRequest(req, res));

      this.server.on('error', (error) => {
        logger.error('Server error:', error as Error);
        reject(error);
      });

      this.server.listen(this.config.port, this.config.host, () => {
        logger.info(`Server listening on ${this.config.host}:${this.config.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Register route
   */
  route(method: string, path: string, handler: Route['handler']): void {
    this.router.add(method, path, handler);
  }

  /**
   * Get router
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * Handle incoming request
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      // CORS headers
      if (this.config.cors) {
        this.setCORSHeaders(res);

        // Handle preflight
        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }
      }

      // Parse URL
      const url = parse(req.url || '/', true);
      const pathname = url.pathname || '/';

      // Find route
      const route = this.router.match(req.method || 'GET', pathname);

      if (!route) {
        this.sendError(res, 404, 'Not Found');
        return;
      }

      // Parse body
      const body = await this.parseBody(req);

      // Execute handler
      const result = await route.handler({
        method: req.method || 'GET',
        path: pathname,
        query: url.query as Record<string, string>,
        headers: req.headers as Record<string, string>,
        body,
        params: route.params
      });

      // Send response
      this.sendJSON(res, 200, result);
    } catch (error: any) {
      logger.error('Request error:', error as Error);
      this.sendError(res, 500, error.message);
    }
  }

  /**
   * Parse request body
   */
  private parseBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;

      req.on('data', (chunk: Buffer) => {
        size += chunk.length;

        if (size > this.config.maxBodySize) {
          reject(new Error('Request body too large'));
          return;
        }

        chunks.push(chunk);
      });

      req.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          const contentType = req.headers['content-type'] || '';

          if (contentType.includes('application/json')) {
            resolve(JSON.parse(buffer.toString('utf-8')));
          } else {
            resolve(buffer.toString('utf-8'));
          }
        } catch (error) {
          reject(error);
        }
      });

      req.on('error', reject);
    });
  }

  /**
   * Set CORS headers
   */
  private setCORSHeaders(res: ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  /**
   * Send JSON response
   */
  private sendJSON(res: ServerResponse, status: number, data: any): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  /**
   * Send error response
   */
  private sendError(res: ServerResponse, status: number, message: string): void {
    this.sendJSON(res, status, { error: message });
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server !== null && this.server.listening;
  }
}
