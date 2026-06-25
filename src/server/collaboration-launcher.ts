/**
 * Collaboration Launcher - Initialize and manage collaboration server
 */

import { CollaborationServer } from '../collaboration/collaboration-server';
import { SessionManager } from '../collaboration/session-manager';
import { createLogger } from '../utils/logger';
import { join } from 'path';
import { EventEmitter } from 'events';

const logger = createLogger('CollaborationLauncher');

/**
 * Collaboration launcher configuration
 */
export interface CollaborationLauncherConfig {
  port?: number;
  dataDir: string;
  enableAuth?: boolean;
  validateToken?: (token: string) => boolean;
}

/**
 * Internal resolved configuration (all fields resolved to concrete values)
 */
interface ResolvedConfig {
  port: number;
  dataDir: string;
  enableAuth: boolean;
  validateToken?: (token: string) => boolean;
}

/**
 * Collaboration launcher status
 */
export interface CollaborationStatus {
  isRunning: boolean;
  port: number;
  activeSessions: number;
  totalUsers: number;
  uptime: number;
}

/**
 * Collaboration Launcher - Manages collaboration server lifecycle
 */
export class CollaborationLauncher extends EventEmitter {
  private server?: CollaborationServer;
  private sessionManager?: SessionManager;
  private config: ResolvedConfig;
  private startTime: number = 0;
  private isRunning: boolean = false;

  constructor(config: CollaborationLauncherConfig) {
    super();

    this.config = {
      port: config.port || 8081,
      dataDir: config.dataDir,
      enableAuth: config.enableAuth || false,
      validateToken: config.validateToken
    };

    logger.info('Collaboration launcher initialized', {
      port: this.config.port,
      dataDir: this.config.dataDir,
      enableAuth: this.config.enableAuth
    });
  }

  /**
   * Start collaboration services
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Collaboration server already running');
      return;
    }

    try {
      logger.info('Starting collaboration services...');

      // Initialize session manager
      const dbPath = join(this.config.dataDir, 'collaboration.db');
      this.sessionManager = new SessionManager(dbPath);

      // Initialize collaboration server
      this.server = new CollaborationServer(
        this.config.port,
        this.config.enableAuth ? this.config.validateToken : undefined
      );
      logger.info(this.config.enableAuth
        ? 'Collaboration server authentication is ENABLED'
        : 'Collaboration server authentication is DISABLED');

      // Setup event forwarding
      this.setupEventHandlers();

      // Start WebSocket server
      this.server.start();

      this.startTime = Date.now();
      this.isRunning = true;

      logger.info(`Collaboration server started on port ${this.config.port}`);
      this.emit('started', { port: this.config.port });

    } catch (error: any) {
      logger.error('Failed to start collaboration server:', error as Error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop collaboration services
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Collaboration server not running');
      return;
    }

    try {
      logger.info('Stopping collaboration services...');

      // Stop server
      if (this.server) {
        this.server.stop();
        this.server.removeAllListeners();
        this.server = undefined;
      }

      // Clean up session manager
      if (this.sessionManager) {
        this.sessionManager.removeAllListeners();
        this.sessionManager = undefined;
      }

      this.isRunning = false;
      this.startTime = 0;

      logger.info('Collaboration server stopped');
      this.emit('stopped');

    } catch (error: any) {
      logger.error('Failed to stop collaboration server:', error as Error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Restart collaboration services
   */
  async restart(): Promise<void> {
    logger.info('Restarting collaboration services...');
    await this.stop();
    await this.start();
  }

  /**
   * Get server status
   */
  getStatus(): CollaborationStatus {
    if (!this.isRunning || !this.server) {
      return {
        isRunning: false,
        port: this.config.port,
        activeSessions: 0,
        totalUsers: 0,
        uptime: 0
      };
    }

    const sessions = this.server.getActiveSessions();
    const totalUsers = sessions.reduce((sum, s) => sum + s.userCount, 0);

    return {
      isRunning: true,
      port: this.config.port,
      activeSessions: sessions.length,
      totalUsers,
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Get session manager
   */
  getSessionManager(): SessionManager | undefined {
    return this.sessionManager;
  }

  /**
   * Get collaboration server
   */
  getServer(): CollaborationServer | undefined {
    return this.server;
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    if (!this.server || !this.sessionManager) return;

    // Forward server events
    this.server.on('server-started', (data) => {
      this.emit('server-started', data);
    });

    this.server.on('server-stopped', () => {
      this.emit('server-stopped');
    });

    this.server.on('user-joined', (data) => {
      logger.info(`User joined: ${data.user.name} in session ${data.sessionId}`);
      this.emit('user-joined', data);

      // Register with session manager
      try {
        this.sessionManager!.joinSession(data.sessionId, data.userId);
      } catch (error: any) {
        // Session might not exist yet, create it
        if (error.message.includes('not found')) {
          this.sessionManager!.createSession(
            `Session ${data.sessionId}`,
            data.userId
          );
        }
      }
    });

    this.server.on('user-left', (data) => {
      logger.info(`User left: ${data.userId} from session ${data.sessionId}`);
      this.emit('user-left', data);

      // Update session manager
      this.sessionManager!.leaveSession(data.sessionId, data.userId);
    });

    this.server.on('user-disconnected', (data) => {
      logger.info(`User disconnected: ${data.userId}`);
      this.emit('user-disconnected', data);
    });

    this.server.on('edit-operation', (operation) => {
      logger.debug(`Edit operation: ${operation.type} by ${operation.userId}`);
      this.emit('edit-operation', operation);

      // Record in session manager
      this.sessionManager!.recordEdit(operation);
    });

    this.server.on('comment-added', (comment) => {
      logger.debug(`Comment added by ${comment.userId}: ${comment.content}`);
      this.emit('comment-added', comment);

      // Record in session manager
      this.sessionManager!.recordComment(comment);
    });

    // Forward session manager events
    this.sessionManager.on('session-created', (session) => {
      logger.info(`Session created: ${session.name} (${session.id})`);
      this.emit('session-created', session);
    });

    this.sessionManager.on('session-deleted', (data) => {
      logger.info(`Session deleted: ${data.sessionId}`);
      this.emit('session-deleted', data);
    });
  }

  /**
   * Create a new session
   */
  createSession(name: string, createdBy: string, metadata?: Record<string, any>) {
    if (!this.sessionManager) {
      throw new Error('Session manager not initialized');
    }

    return this.sessionManager.createSession(name, createdBy, metadata);
  }

  /**
   * Get session info
   */
  getSessionInfo(sessionId: string) {
    if (!this.server) {
      throw new Error('Collaboration server not running');
    }

    return this.server.getSessionInfo(sessionId);
  }

  /**
   * Get active sessions
   */
  getActiveSessions() {
    if (!this.server) {
      return [];
    }

    return this.server.getActiveSessions();
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId: string) {
    if (!this.sessionManager) {
      throw new Error('Session manager not initialized');
    }

    return this.sessionManager.getSessionStats(sessionId);
  }
}
