/**
 * Collaboration Server - Real-time collaboration using WebSocket
 */

import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';
import { Server as WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

const logger = createLogger('CollaborationServer');

/**
 * User info
 */
export interface User {
  id: string;
  name: string;
  avatar?: string;
  color: string;
}

/**
 * Cursor position
 */
export interface CursorPosition {
  userId: string;
  x: number;
  y: number;
  file?: string;
  line?: number;
  column?: number;
}

/**
 * Edit operation
 */
export interface EditOperation {
  userId: string;
  sessionId: string;
  type: 'insert' | 'delete' | 'replace';
  file: string;
  position: { line: number; column: number };
  content?: string;
  length?: number;
  timestamp: number;
}

/**
 * Comment
 */
export interface Comment {
  id: string;
  userId: string;
  sessionId: string;
  file: string;
  line: number;
  content: string;
  resolved: boolean;
  timestamp: number;
  replies?: Comment[];
}

/**
 * Collaboration message
 */
export interface CollaborationMessage {
  type: 'join' | 'leave' | 'cursor' | 'edit' | 'comment' | 'sync' | 'presence';
  userId: string;
  sessionId: string;
  data: any;
  timestamp: number;
}

/**
 * Collaboration Server
 */
export class CollaborationServer extends EventEmitter {
  private wss?: WebSocketServer;
  private sessions = new Map<string, Set<string>>(); // sessionId -> userIds
  private users = new Map<string, User>(); // userId -> User
  private connections = new Map<string, WebSocket>(); // userId -> WebSocket
  private cursors = new Map<string, CursorPosition>(); // userId -> position
  private comments = new Map<string, Comment[]>(); // sessionId -> comments
  private editHistory = new Map<string, EditOperation[]>(); // sessionId -> operations
  private authTokens = new Map<string, string>(); // userId -> token
  private maxMessageSize = 1024 * 1024; // 1MB
  private parseErrorCount = new Map<string, number>(); // userId -> error count
  private validateToken?: (token: string) => boolean;

  constructor(private port: number = 8081, validateToken?: (token: string) => boolean) {
    super();
    if (!validateToken) {
      const preSharedKey = process.env.COLLAB_SECRET || crypto.randomBytes(32).toString('hex');
      this.validateToken = (token: string) => token === preSharedKey;
      logger.info('Collaboration server using pre-shared key authentication');
    } else {
      this.validateToken = validateToken;
    }
  }

  /**
   * Start server
   */
  start(): void {
    this.wss = new WebSocketServer({
      port: this.port,
      maxPayload: this.maxMessageSize
    });

    this.wss.on('connection', (ws: WebSocket, req: any) => {
      // Authentication check
      const token = req.headers['authorization']?.replace('Bearer ', '');
      if (this.validateToken && !this.validateToken(token)) {
        logger.warn('Unauthorized connection attempt');
        ws.close(4401, 'Unauthorized');
        return;
      }

      const userId = uuidv4();
      this.connections.set(userId, ws);
      if (token) {
        this.authTokens.set(userId, token);
      }

      logger.info(`User connected: ${userId}`);

      ws.on('message', (data: string) => {
        try {
          // Check message size
          if (data.length > this.maxMessageSize) {
            logger.warn(`Message too large from user ${userId}: ${data.length} bytes`);
            ws.send(JSON.stringify({ error: 'Message too large' }));
            return;
          }

          const message = JSON.parse(data.toString()) as CollaborationMessage;
          this.handleMessage(userId, message, ws);

          // Reset error count on success
          this.parseErrorCount.set(userId, 0);
        } catch (error: any) {
          logger.error('Failed to parse message:', error as Error);

          // Track parse errors
          const errorCount = (this.parseErrorCount.get(userId) || 0) + 1;
          this.parseErrorCount.set(userId, errorCount);

          // Disconnect after 5 consecutive parse errors
          if (errorCount >= 5) {
            logger.warn(`Too many parse errors from user ${userId}, disconnecting`);
            ws.close(4400, 'Too many invalid messages');
            this.handleDisconnect(userId);
          }
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(userId);
      });

      ws.on('error', (error) => {
        logger.error(`WebSocket error for user ${userId}:`, error as Error);
      });
    });

    logger.info(`Collaboration server started on port ${this.port}`);
    this.emit('server-started', { port: this.port });
  }

  /**
   * Stop server
   */
  stop(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = undefined;
      logger.info('Collaboration server stopped');
      this.emit('server-stopped');
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(userId: string, message: CollaborationMessage, ws: WebSocket): void {
    message.userId = userId;
    message.timestamp = Date.now();

    switch (message.type) {
      case 'join':
        this.handleJoin(userId, message, ws);
        break;

      case 'leave':
        this.handleLeave(userId, message);
        break;

      case 'cursor':
        this.handleCursor(userId, message);
        break;

      case 'edit':
        this.handleEdit(userId, message);
        break;

      case 'comment':
        this.handleComment(userId, message);
        break;

      case 'sync':
        this.handleSync(userId, message, ws);
        break;

      case 'presence':
        this.handlePresence(userId, message);
        break;

      default:
        logger.warn(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle user join
   */
  private handleJoin(userId: string, message: CollaborationMessage, ws: WebSocket): void {
    const { sessionId, user } = message.data;

    // Register user
    this.users.set(userId, user);

    // Add to session
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new Set());
      this.comments.set(sessionId, []);
      this.editHistory.set(sessionId, []);
    }

    this.sessions.get(sessionId)!.add(userId);

    logger.info(`User ${user.name} joined session ${sessionId}`);

    // Send current state to new user
    this.sendToUser(userId, {
      type: 'sync',
      userId: 'system',
      sessionId,
      data: {
        users: this.getSessionUsers(sessionId),
        cursors: this.getSessionCursors(sessionId),
        comments: this.comments.get(sessionId) || [],
        editHistory: this.editHistory.get(sessionId) || []
      },
      timestamp: Date.now()
    });

    // Broadcast join to other users
    this.broadcastToSession(sessionId, userId, {
      type: 'join',
      userId,
      sessionId,
      data: { user },
      timestamp: Date.now()
    });

    this.emit('user-joined', { userId, sessionId, user });
  }

  /**
   * Handle user leave
   */
  private handleLeave(userId: string, message: CollaborationMessage): void {
    const { sessionId } = message;

    if (this.sessions.has(sessionId)) {
      this.sessions.get(sessionId)!.delete(userId);

      // Clean up empty session
      if (this.sessions.get(sessionId)!.size === 0) {
        this.sessions.delete(sessionId);
        this.comments.delete(sessionId);
        this.editHistory.delete(sessionId);
      }
    }

    // Broadcast leave
    this.broadcastToSession(sessionId, userId, message);

    logger.info(`User ${userId} left session ${sessionId}`);
    this.emit('user-left', { userId, sessionId });
  }

  /**
   * Handle cursor movement
   */
  private handleCursor(userId: string, message: CollaborationMessage): void {
    const cursor: CursorPosition = {
      userId,
      ...message.data
    };

    this.cursors.set(userId, cursor);

    // Broadcast to session
    this.broadcastToSession(message.sessionId, userId, message);
  }

  /**
   * Handle edit operation
   */
  private handleEdit(userId: string, message: CollaborationMessage): void {
    const operation: EditOperation = {
      userId,
      sessionId: message.sessionId,
      ...message.data,
      timestamp: Date.now()
    };

    // Store operation
    const history = this.editHistory.get(message.sessionId) || [];
    history.push(operation);
    this.editHistory.set(message.sessionId, history);

    // Broadcast to session
    this.broadcastToSession(message.sessionId, userId, message);

    logger.debug(`Edit operation: ${operation.type} in ${operation.file}`);
    this.emit('edit-operation', operation);
  }

  /**
   * Handle comment
   */
  private handleComment(userId: string, message: CollaborationMessage): void {
    const comment: Comment = {
      id: uuidv4(),
      userId,
      sessionId: message.sessionId,
      ...message.data,
      timestamp: Date.now()
    };

    // Store comment
    const comments = this.comments.get(message.sessionId) || [];
    comments.push(comment);
    this.comments.set(message.sessionId, comments);

    // Broadcast to session
    this.broadcastToSession(message.sessionId, userId, {
      ...message,
      data: comment
    });

    logger.debug(`Comment added: ${comment.content}`);
    this.emit('comment-added', comment);
  }

  /**
   * Handle sync request
   */
  private handleSync(userId: string, message: CollaborationMessage, ws: WebSocket): void {
    const { sessionId } = message;

    this.sendToUser(userId, {
      type: 'sync',
      userId: 'system',
      sessionId,
      data: {
        users: this.getSessionUsers(sessionId),
        cursors: this.getSessionCursors(sessionId),
        comments: this.comments.get(sessionId) || [],
        editHistory: this.editHistory.get(sessionId) || []
      },
      timestamp: Date.now()
    });
  }

  /**
   * Handle presence update
   */
  private handlePresence(userId: string, message: CollaborationMessage): void {
    // Broadcast presence to session
    this.broadcastToSession(message.sessionId, userId, message);
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(userId: string): void {
    logger.info(`User disconnected: ${userId}`);

    // Explicitly close WebSocket connection
    const ws = this.connections.get(userId);
    if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
      ws.close(1000, 'User disconnected');
    }

    // Remove from all sessions
    const sessionEntries = Array.from(this.sessions.entries());
    for (const [sessionId, users] of sessionEntries) {
      if (users.has(userId)) {
        users.delete(userId);

        // Broadcast leave
        this.broadcastToSession(sessionId, userId, {
          type: 'leave',
          userId,
          sessionId,
          data: {},
          timestamp: Date.now()
        });

        // Clean up empty session
        if (users.size === 0) {
          this.sessions.delete(sessionId);
          this.comments.delete(sessionId);
          this.editHistory.delete(sessionId);
        }
      }
    }

    // Clean up
    this.users.delete(userId);
    this.connections.delete(userId);
    this.cursors.delete(userId);
    this.authTokens.delete(userId);
    this.parseErrorCount.delete(userId);

    this.emit('user-disconnected', { userId });
  }

  /**
   * Broadcast to session (except sender)
   */
  private broadcastToSession(sessionId: string, excludeUserId: string, message: CollaborationMessage): void {
    const users = this.sessions.get(sessionId);
    if (!users) return;

    const userArray = Array.from(users);
    for (const userId of userArray) {
      if (userId !== excludeUserId) {
        this.sendToUser(userId, message);
      }
    }
  }

  /**
   * Send message to user
   */
  private sendToUser(userId: string, message: CollaborationMessage): void {
    const ws = this.connections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Get session users
   */
  private getSessionUsers(sessionId: string): User[] {
    const userIds = this.sessions.get(sessionId);
    if (!userIds) return [];

    return Array.from(userIds)
      .map(id => this.users.get(id))
      .filter((u): u is User => u !== undefined);
  }

  /**
   * Get session cursors
   */
  private getSessionCursors(sessionId: string): CursorPosition[] {
    const userIds = this.sessions.get(sessionId);
    if (!userIds) return [];

    return Array.from(userIds)
      .map(id => this.cursors.get(id))
      .filter((c): c is CursorPosition => c !== undefined);
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): Array<{ sessionId: string; userCount: number }> {
    return Array.from(this.sessions.entries()).map(([sessionId, users]) => ({
      sessionId,
      userCount: users.size
    }));
  }

  /**
   * Get session info
   */
  getSessionInfo(sessionId: string): {
    users: User[];
    comments: Comment[];
    editCount: number;
  } | null {
    if (!this.sessions.has(sessionId)) return null;

    return {
      users: this.getSessionUsers(sessionId),
      comments: this.comments.get(sessionId) || [],
      editCount: (this.editHistory.get(sessionId) || []).length
    };
  }
}
