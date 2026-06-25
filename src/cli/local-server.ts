/**
 * Local HTTP Server - REST API for Aether Agent
 */

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { createServer, Server } from 'http';
import { NexusAgent } from '../agent';
import { createLogger } from '../utils/logger';
import { ChatHistory } from '../storage/chat-history';
import { ConfigManager } from '../storage/config-manager';

const logger = createLogger('LocalServer');

/**
 * Local Server Configuration
 */
export interface ServerConfig {
  port: number;
  host: string;
  cors?: boolean;
  dbPath?: string;
  configPassword?: string;
}

/**
 * Local HTTP Server
 */
export class LocalServer {
  private app: Express;
  private server?: Server;
  private agent: NexusAgent;
  private config: ServerConfig;
  private chatHistory?: ChatHistory;
  private configManager?: ConfigManager;

  constructor(agent: NexusAgent, config: ServerConfig = { port: 3000, host: 'localhost' }) {
    this.agent = agent;
    this.config = config;
    this.app = express();

    // Initialize storage if paths provided
    if (config.dbPath) {
      this.chatHistory = new ChatHistory(config.dbPath);
    }
    if (config.configPassword) {
      this.configManager = new ConfigManager(config.configPassword);
    }

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // CORS
    if (this.config.cors !== false) {
      this.app.use(cors());
    }

    // JSON parser
    this.app.use(express.json({ limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    // Chat endpoint
    this.app.post('/api/chat', async (req, res) => {
      try {
        const { message, sessionId } = req.body;

        if (!message) {
          res.status(400).json({ error: 'Message is required' });
          return;
        }

        const response = await this.agent.chat(message) as any;

        res.json({
          success: true,
          data: {
            content: response.content || response,
            sessionId: response.sessionId || sessionId,
            timestamp: Date.now()
          }
        });
      } catch (error: any) {
        logger.error('Chat error:', error as Error);
        res.status(500).json({ error: error.message });
      }
    });

    // Stream chat endpoint
    this.app.post('/api/chat/stream', async (req, res) => {
      try {
        const { message, sessionId } = req.body;

        if (!message) {
          res.status(400).json({ error: 'Message is required' });
          return;
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const stream = this.agent.streamChat(message) as any;

        for await (const chunk of stream) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }

        res.write('data: [DONE]\n\n');
        res.end();
      } catch (error: any) {
        logger.error('Stream error:', error as Error);
        res.status(500).json({ error: error.message });
      }
    });

    // Sessions
    this.app.get('/api/sessions', async (req, res) => {
      try {
        if (!this.chatHistory) {
          res.status(503).json({
            success: false,
            error: 'Chat history not configured'
          });
          return;
        }

        const sessions = this.chatHistory.listSessions();
        res.json({
          success: true,
          data: {
            sessions,
            count: sessions.length
          }
        });
      } catch (error: any) {
        logger.error('Sessions error:', error as Error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get session
    this.app.get('/api/sessions/:id', async (req, res) => {
      try {
        const { id } = req.params;

        if (!this.chatHistory) {
          res.status(503).json({
            success: false,
            error: 'Chat history not configured'
          });
          return;
        }

        const session = this.chatHistory.getSession(id);

        if (!session) {
          res.status(404).json({
            success: false,
            error: 'Session not found'
          });
          return;
        }

        res.json({ success: true, data: { session } });
      } catch (error: any) {
        logger.error('Get session error:', error as Error);
        res.status(500).json({ error: error.message });
      }
    });

    // Delete session
    this.app.delete('/api/sessions/:id', async (req, res) => {
      try {
        const { id } = req.params;

        if (!this.chatHistory) {
          res.status(503).json({
            success: false,
            error: 'Chat history not configured'
          });
          return;
        }

        this.chatHistory.deleteSession(id);
        res.json({ success: true, message: 'Session deleted' });
      } catch (error: any) {
        logger.error('Delete session error:', error as Error);
        res.status(500).json({ error: error.message });
      }
    });

    // Configuration
    this.app.get('/api/config', async (req, res) => {
      try {
        if (!this.configManager) {
          res.status(503).json({
            success: false,
            error: 'Config manager not configured'
          });
          return;
        }

        // Return basic config info (avoid exposing sensitive data)
        const config = {
          version: '1.0.0',
          configured: true
        };

        res.json({ success: true, data: { config } });
      } catch (error: any) {
        logger.error('Config error:', error as Error);
        res.status(500).json({ error: error.message });
      }
    });

    // Update configuration
    this.app.patch('/api/config', async (req, res) => {
      try {
        const updates = req.body;

        if (!this.configManager) {
          res.status(503).json({
            success: false,
            error: 'Config manager not configured'
          });
          return;
        }

        // Note: Config updates would need specific methods
        // For now, acknowledge the request
        res.json({ success: true, message: 'Config update acknowledged' });
      } catch (error: any) {
        logger.error('Update config error:', error as Error);
        res.status(500).json({ error: error.message });
      }
    });

    // Status
    this.app.get('/api/status', async (req, res) => {
      try {
        res.json({
          success: true,
          data: {
            status: 'running',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: '1.0.0'
          }
        });
      } catch (error: any) {
        logger.error('Status error:', error as Error);
        res.status(500).json({ error: error.message });
      }
    });

    // Error handler
    this.app.use((err: any, req: Request, res: Response, next: any) => {
      logger.error('Unhandled error:', err as Error);
      res.status(500).json({ error: 'Internal server error' });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  /**
   * Start server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, this.config.host, () => {
          logger.info(`Server listening on http://${this.config.host}:${this.config.port}`);
          resolve();
        });

        this.server.on('error', (error) => {
          logger.error('Server error:', error as Error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error) => {
        if (error) {
          logger.error('Error stopping server:', error as Error);
          reject(error);
        } else {
          logger.info('Server stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Get Express app
   */
  getApp(): Express {
    return this.app;
  }
}
