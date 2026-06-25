/**
 * Gateway Server - Unified Express-based API Gateway
 *
 * Provides enterprise-grade HTTP API with:
 * - JWT authentication
 * - Rate limiting
 * - CORS support
 * - Request logging
 * - Health checks
 * - Metrics endpoint
 */

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { Server } from 'http';
import { randomUUID } from 'crypto';
import { AuthMiddleware } from '../gateway/auth-middleware';
import { RateLimiter } from '../gateway/rate-limiter';
import {
  createAuthMiddleware,
  createRateLimitMiddleware,
  errorHandler,
  requestLogger,
  AuthenticatedExpressRequest
} from './express-middleware';
import { createLearningAPI } from '../api/learning-api';
import { Orchestrator } from '../core/orchestrator';
import { Message } from '../types';
import { createLogger } from '../utils/logger';

const logger = createLogger('GatewayServer');

/**
 * Gateway Server Configuration
 */
export interface GatewayServerConfig {
  port: number;
  host?: string;
  auth: {
    jwtSecret: string;
    publicPaths?: string[];
  };
  rateLimit: {
    maxTokens: number;
    refillRate: number;
  };
  cors?: {
    allowedOrigins?: string[];
  };
  timeout?: number;
  orchestrator: Orchestrator;
}

/**
 * Gateway Server Statistics
 */
export interface GatewayServerStats {
  uptime: number;
  totalRequests: number;
  activeConnections: number;
  rateLimiterStats: {
    totalBuckets: number;
    config: {
      maxTokens: number;
      refillRate: number;
    };
  };
}

/**
 * Gateway Server - Main API Gateway
 */
export class GatewayServer {
  private app: Express;
  private server: Server | null = null;
  private config: Required<GatewayServerConfig>;
  private authMiddleware: AuthMiddleware;
  private rateLimiter: RateLimiter;
  private startTime: number = 0;
  private requestCount: number = 0;

  constructor(config: GatewayServerConfig) {
    this.config = {
      host: '0.0.0.0',
      timeout: 30000,
      cors: { allowedOrigins: ['http://localhost:3000', 'http://localhost:5173'] },
      ...config,
      auth: {
        publicPaths: ['/health', '/metrics', '/api/auth/login'],
        ...config.auth
      }
    };

    this.app = express();

    // Initialize middleware components
    this.authMiddleware = new AuthMiddleware({
      jwtSecret: this.config.auth.jwtSecret,
      publicPaths: this.config.auth.publicPaths
    });

    this.rateLimiter = new RateLimiter({
      maxTokens: this.config.rateLimit.maxTokens,
      refillRate: this.config.rateLimit.refillRate
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware stack
   */
  private setupMiddleware(): void {
    // Trust proxy (for X-Forwarded-For headers)
    this.app.set('trust proxy', true);

    // CORS
    this.app.use(cors({
      origin: this.config.cors?.allowedOrigins || [],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use(requestLogger);

    // Request counter
    this.app.use((req, res, next) => {
      this.requestCount++;
      next();
    });

    // Authentication middleware (applies to all routes except public paths)
    this.app.use(createAuthMiddleware(this.authMiddleware));

    // Rate limiting middleware
    this.app.use(createRateLimitMiddleware(this.rateLimiter));
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint (public)
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime
      });
    });

    // Metrics endpoint (public)
    this.app.get('/metrics', (req: Request, res: Response) => {
      const stats = this.getStats();
      res.json({
        success: true,
        data: stats
      });
    });

    // Learning API routes
    const learningAPI = createLearningAPI({
      orchestrator: this.config.orchestrator
    });
    this.app.use('/api/learning', learningAPI);

    // Chat API routes
    this.app.post('/api/chat', async (req: AuthenticatedExpressRequest, res: Response) => {
      try {
        const { message, sessionId } = req.body;

        if (!message) {
          res.status(400).json({
            success: false,
            error: 'Message is required'
          });
          return;
        }

        const messageObj: Message = {
          id: randomUUID(),
          role: 'user',
          content: message,
          timestamp: Date.now()
        };

        const response = await this.config.orchestrator.processMessage(messageObj, sessionId);

        res.json({
          success: true,
          data: {
            message: response.content,
            sessionId: sessionId || 'unknown',
            timestamp: response.timestamp
          }
        });
      } catch (error: any) {
        logger.error('Chat request failed:', error as Error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Skills API routes
    this.app.get('/api/skills', async (req: Request, res: Response) => {
      try {
        const skills = this.config.orchestrator.getAvailableSkills();

        res.json({
          success: true,
          data: {
            skills,
            count: skills.length
          }
        });
      } catch (error: any) {
        logger.error('Failed to get skills:', error as Error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.get('/api/skills/:skillId', async (req: Request, res: Response) => {
      try {
        const skillId = Array.isArray(req.params.skillId) ? req.params.skillId[0] : req.params.skillId;
        const skill = this.config.orchestrator.getSkill(skillId);

        if (!skill) {
          res.status(404).json({
            success: false,
            error: 'Skill not found'
          });
          return;
        }

        res.json({
          success: true,
          data: skill
        });
      } catch (error: any) {
        logger.error('Failed to get skill:', error as Error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Workflow API routes (placeholder for future implementation)
    this.app.get('/api/workflow', async (req: Request, res: Response) => {
      res.status(501).json({
        success: false,
        error: 'Workflow API not yet implemented'
      });
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  /**
   * Start the server
   */
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, this.config.host, () => {
          this.startTime = Date.now();
          logger.info(`Gateway server started on ${this.config.host}:${this.config.port}`);
          resolve();
        });

        this.server.on('error', (error) => {
          logger.error('Server error:', error as Error);
          reject(error);
        });

        // Set server timeout
        this.server.timeout = this.config.timeout;
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the server
   */
  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        // Cleanup
        this.rateLimiter.destroy();
        this.authMiddleware.removeAllListeners();

        logger.info('Gateway server stopped');
        resolve();
      });
    });
  }

  /**
   * Get server statistics
   */
  public getStats(): GatewayServerStats {
    return {
      uptime: Date.now() - this.startTime,
      totalRequests: this.requestCount,
      activeConnections: this.server?.listening ? 1 : 0,
      rateLimiterStats: this.rateLimiter.getStats()
    };
  }

  /**
   * Get Express app (for testing)
   */
  public getApp(): Express {
    return this.app;
  }

  /**
   * Get auth middleware (for testing/admin)
   */
  public getAuthMiddleware(): AuthMiddleware {
    return this.authMiddleware;
  }

  /**
   * Get rate limiter (for testing/admin)
   */
  public getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }
}
