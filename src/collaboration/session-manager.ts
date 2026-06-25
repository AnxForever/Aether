/**
 * Session Manager - Manage collaboration sessions
 */

import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { User, Comment, EditOperation } from './collaboration-server';

const logger = createLogger('SessionManager');

/**
 * Session info
 */
export interface Session {
  id: string;
  name: string;
  createdBy: string;
  createdAt: number;
  lastActivity: number;
  participants: string[];
  status: 'active' | 'paused' | 'archived';
  metadata?: Record<string, any>;
}

/**
 * Session statistics
 */
export interface SessionStats {
  sessionId: string;
  totalEdits: number;
  totalComments: number;
  activeUsers: number;
  duration: number;
  mostActiveUser: string;
}

/**
 * Session Manager
 */
export class SessionManager extends EventEmitter {
  private db: Database.Database;
  private activeSessions = new Map<string, Session>();

  constructor(dbPath: string) {
    super();
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  /**
   * Initialize database tables
   */
  private initializeTables(): void {
    // Enable foreign key constraints
    this.db.exec('PRAGMA foreign_keys = ON;');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        createdBy TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        lastActivity INTEGER NOT NULL,
        status TEXT NOT NULL,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS session_participants (
        sessionId TEXT NOT NULL,
        userId TEXT NOT NULL,
        joinedAt INTEGER NOT NULL,
        leftAt INTEGER,
        PRIMARY KEY (sessionId, userId),
        FOREIGN KEY (sessionId) REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS session_edits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT NOT NULL,
        userId TEXT NOT NULL,
        type TEXT NOT NULL,
        file TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (sessionId) REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS session_comments (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        userId TEXT NOT NULL,
        file TEXT NOT NULL,
        line INTEGER NOT NULL,
        content TEXT NOT NULL,
        resolved INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (sessionId) REFERENCES sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_participants_session ON session_participants(sessionId);
      CREATE INDEX IF NOT EXISTS idx_edits_session ON session_edits(sessionId);
      CREATE INDEX IF NOT EXISTS idx_comments_session ON session_comments(sessionId);
    `);

    logger.info('Session manager initialized');
  }

  /**
   * Create session
   */
  createSession(name: string, createdBy: string, metadata?: Record<string, any>): Session {
    const session: Session = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      createdBy,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      participants: [createdBy],
      status: 'active',
      metadata
    };

    // Store in database
    this.db
      .prepare(
        `INSERT INTO sessions (id, name, createdBy, createdAt, lastActivity, status, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        session.id,
        session.name,
        session.createdBy,
        session.createdAt,
        session.lastActivity,
        session.status,
        JSON.stringify(metadata || {})
      );

    // Add creator as participant
    this.db
      .prepare(
        `INSERT INTO session_participants (sessionId, userId, joinedAt)
         VALUES (?, ?, ?)`
      )
      .run(session.id, createdBy, session.createdAt);

    this.activeSessions.set(session.id, session);

    logger.info(`Session created: ${session.name} (${session.id})`);
    this.emit('session-created', session);

    return session;
  }

  /**
   * Join session
   */
  joinSession(sessionId: string, userId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (!session.participants.includes(userId)) {
      session.participants.push(userId);

      this.db
        .prepare(
          `INSERT INTO session_participants (sessionId, userId, joinedAt)
           VALUES (?, ?, ?)`
        )
        .run(sessionId, userId, Date.now());

      logger.info(`User ${userId} joined session ${sessionId}`);
      this.emit('user-joined-session', { sessionId, userId });
    }

    this.updateActivity(sessionId);
  }

  /**
   * Leave session
   */
  leaveSession(sessionId: string, userId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.participants = session.participants.filter(id => id !== userId);

    this.db
      .prepare(
        `UPDATE session_participants
         SET leftAt = ?
         WHERE sessionId = ? AND userId = ? AND leftAt IS NULL`
      )
      .run(Date.now(), sessionId, userId);

    logger.info(`User ${userId} left session ${sessionId}`);
    this.emit('user-left-session', { sessionId, userId });

    this.updateActivity(sessionId);
  }

  /**
   * Record edit
   */
  recordEdit(edit: EditOperation): void {
    // Validate session exists
    const session = this.getSession(edit.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${edit.sessionId}`);
    }

    this.db
      .prepare(
        `INSERT INTO session_edits (sessionId, userId, type, file, timestamp)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(edit.sessionId, edit.userId, edit.type, edit.file, edit.timestamp);

    this.updateActivity(edit.sessionId);
  }

  /**
   * Record comment
   */
  recordComment(comment: Comment): void {
    // Validate session exists
    const session = this.getSession(comment.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${comment.sessionId}`);
    }

    this.db
      .prepare(
        `INSERT INTO session_comments (id, sessionId, userId, file, line, content, resolved, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        comment.id,
        comment.sessionId,
        comment.userId,
        comment.file,
        comment.line,
        comment.content,
        comment.resolved ? 1 : 0,
        comment.timestamp
      );

    this.updateActivity(comment.sessionId);
  }

  /**
   * Update session activity
   */
  private updateActivity(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();

      this.db
        .prepare('UPDATE sessions SET lastActivity = ? WHERE id = ?')
        .run(session.lastActivity, sessionId);
    }
  }

  /**
   * Get session
   */
  getSession(sessionId: string): Session | null {
    let session = this.activeSessions.get(sessionId);

    if (!session) {
      const row = this.db
        .prepare('SELECT * FROM sessions WHERE id = ?')
        .get(sessionId) as any;

      if (row) {
        const participants = this.db
          .prepare(
            `SELECT userId FROM session_participants
             WHERE sessionId = ? AND leftAt IS NULL`
          )
          .all(sessionId) as { userId: string }[];

        session = {
          id: row.id,
          name: row.name,
          createdBy: row.createdBy,
          createdAt: row.createdAt,
          lastActivity: row.lastActivity,
          participants: participants.map(p => p.userId),
          status: row.status,
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined
        };
      }
    }

    return session || null;
  }

  /**
   * List sessions
   */
  listSessions(status?: string): Session[] {
    const query = status
      ? 'SELECT * FROM sessions WHERE status = ? ORDER BY lastActivity DESC'
      : 'SELECT * FROM sessions ORDER BY lastActivity DESC';

    const rows = status
      ? this.db.prepare(query).all(status)
      : this.db.prepare(query).all();

    return (rows as any[]).map(row => {
      const participants = this.db
        .prepare(
          `SELECT userId FROM session_participants
           WHERE sessionId = ? AND leftAt IS NULL`
        )
        .all(row.id) as { userId: string }[];

      return {
        id: row.id,
        name: row.name,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        lastActivity: row.lastActivity,
        participants: participants.map(p => p.userId),
        status: row.status,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
      };
    });
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId: string): SessionStats | null {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const edits = this.db
      .prepare('SELECT COUNT(*) as count FROM session_edits WHERE sessionId = ?')
      .get(sessionId) as { count: number };

    const comments = this.db
      .prepare('SELECT COUNT(*) as count FROM session_comments WHERE sessionId = ?')
      .get(sessionId) as { count: number };

    const mostActive = this.db
      .prepare(
        `SELECT userId, COUNT(*) as count
         FROM session_edits
         WHERE sessionId = ?
         GROUP BY userId
         ORDER BY count DESC
         LIMIT 1`
      )
      .get(sessionId) as { userId: string; count: number } | undefined;

    return {
      sessionId,
      totalEdits: edits.count,
      totalComments: comments.count,
      activeUsers: session.participants.length,
      duration: Date.now() - session.createdAt,
      mostActiveUser: mostActive?.userId || session.createdBy
    };
  }

  /**
   * Pause session
   */
  pauseSession(sessionId: string): void {
    this.updateSessionStatus(sessionId, 'paused');
    logger.info(`Session paused: ${sessionId}`);
  }

  /**
   * Resume session
   */
  resumeSession(sessionId: string): void {
    this.updateSessionStatus(sessionId, 'active');
    logger.info(`Session resumed: ${sessionId}`);
  }

  /**
   * Archive session
   */
  archiveSession(sessionId: string): void {
    this.updateSessionStatus(sessionId, 'archived');
    this.activeSessions.delete(sessionId);
    logger.info(`Session archived: ${sessionId}`);
  }

  /**
   * Update session status
   */
  private updateSessionStatus(sessionId: string, status: Session['status']): void {
    this.db
      .prepare('UPDATE sessions SET status = ? WHERE id = ?')
      .run(status, sessionId);

    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = status;
    }

    this.emit('session-status-changed', { sessionId, status });
  }

  /**
   * Delete session
   */
  deleteSession(sessionId: string): void {
    this.db.prepare('DELETE FROM session_comments WHERE sessionId = ?').run(sessionId);
    this.db.prepare('DELETE FROM session_edits WHERE sessionId = ?').run(sessionId);
    this.db.prepare('DELETE FROM session_participants WHERE sessionId = ?').run(sessionId);
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);

    this.activeSessions.delete(sessionId);

    logger.info(`Session deleted: ${sessionId}`);
    this.emit('session-deleted', { sessionId });
  }

  /**
   * Clean up old sessions
   */
  cleanupOldSessions(olderThan: number): number {
    const result = this.db
      .prepare(
        `DELETE FROM sessions
         WHERE status = 'archived' AND lastActivity < ?`
      )
      .run(olderThan);

    logger.info(`Cleaned up ${result.changes} old sessions`);

    return result.changes;
  }
}
