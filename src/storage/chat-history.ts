/**
 * Chat History Storage
 *
 * SQLite3-based chat history with WAL mode for concurrent access.
 * Compatible with Cola's chat-history.db format.
 */

import Database from 'better-sqlite3';
import { Message, Session } from '../types';

export interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  timestamp: number;
  metadata: string | null;
}

export interface SessionRow {
  id: string;
  title: string;
  type: string;
  created_at: number;
  updated_at: number;
}

export class ChatHistory {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -64000'); // 64MB cache
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'chat',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session
        ON messages(session_id, timestamp);

      CREATE INDEX IF NOT EXISTS idx_messages_timestamp
        ON messages(timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_sessions_updated
        ON sessions(updated_at DESC);
    `);
  }

  // ============================================================================
  // Session Operations
  // ============================================================================

  createSession(session: Omit<Session, 'messages'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, title, type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.id,
      session.title,
      session.type,
      session.createdAt,
      session.updatedAt
    );
  }

  getSession(sessionId: string): Session | null {
    const sessionRow = this.db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .get(sessionId) as SessionRow | undefined;

    if (!sessionRow) return null;

    const messages = this.getMessages(sessionId);

    return {
      id: sessionRow.id,
      title: sessionRow.title,
      type: sessionRow.type as 'chat' | 'coding',
      createdAt: sessionRow.created_at,
      updatedAt: sessionRow.updated_at,
      messages,
    };
  }

  listSessions(limit = 50, offset = 0): Session[] {
    const sessionRows = this.db
      .prepare(`
        SELECT * FROM sessions
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
      `)
      .all(limit, offset) as SessionRow[];

    return sessionRows.map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type as 'chat' | 'coding',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messages: [], // Lazy load messages
    }));
  }

  updateSession(sessionId: string, updates: Partial<Pick<Session, 'title' | 'updatedAt'>>): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }

    if (updates.updatedAt !== undefined) {
      fields.push('updated_at = ?');
      values.push(updates.updatedAt);
    }

    if (fields.length === 0) return;

    values.push(sessionId);

    const stmt = this.db.prepare(`
      UPDATE sessions
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
  }

  deleteSession(sessionId: string): void {
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  }

  // ============================================================================
  // Message Operations
  // ============================================================================

  saveMessage(message: Message & { sessionId: string }): void {
    const stmt = this.db.prepare(`
      INSERT INTO messages (id, session_id, role, content, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      message.id,
      message.sessionId,
      message.role,
      message.content,
      message.timestamp,
      message.metadata ? JSON.stringify(message.metadata) : null
    );

    // Update session's updated_at
    this.updateSession(message.sessionId, { updatedAt: message.timestamp });
  }

  getMessage(messageId: string): (Message & { sessionId: string }) | null {
    const row = this.db
      .prepare('SELECT * FROM messages WHERE id = ?')
      .get(messageId) as MessageRow | undefined;

    if (!row) return null;

    return this.rowToMessage(row);
  }

  getMessages(sessionId: string, limit?: number, offset?: number): Message[] {
    let query = 'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC';
    const params: any[] = [sessionId];

    if (limit !== undefined) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    if (offset !== undefined) {
      query += ' OFFSET ?';
      params.push(offset);
    }

    const rows = this.db.prepare(query).all(...params) as MessageRow[];

    return rows.map((row) => ({
      id: row.id,
      role: row.role as 'user' | 'assistant' | 'system',
      content: row.content,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  deleteMessage(messageId: string): void {
    this.db.prepare('DELETE FROM messages WHERE id = ?').run(messageId);
  }

  deleteMessages(sessionId: string): void {
    this.db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
  }

  // ============================================================================
  // Search & Query
  // ============================================================================

  searchMessages(query: string, limit = 50): (Message & { sessionId: string })[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM messages
        WHERE content LIKE ?
        ORDER BY timestamp DESC
        LIMIT ?
      `)
      .all(`%${query}%`, limit) as MessageRow[];

    return rows.map(this.rowToMessage);
  }

  getRecentMessages(limit = 100): (Message & { sessionId: string })[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM messages
        ORDER BY timestamp DESC
        LIMIT ?
      `)
      .all(limit) as MessageRow[];

    return rows.map(this.rowToMessage);
  }

  getMessageCount(sessionId?: string): number {
    if (sessionId) {
      const result = this.db
        .prepare('SELECT COUNT(*) as count FROM messages WHERE session_id = ?')
        .get(sessionId) as { count: number };
      return result.count;
    }

    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM messages')
      .get() as { count: number };
    return result.count;
  }

  // ============================================================================
  // Maintenance
  // ============================================================================

  vacuum(): void {
    this.db.exec('VACUUM');
  }

  checkpoint(): void {
    this.db.pragma('wal_checkpoint(TRUNCATE)');
  }

  close(): void {
    this.db.close();
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private rowToMessage(row: MessageRow): Message & { sessionId: string } {
    return {
      id: row.id,
      sessionId: row.session_id,
      role: row.role as 'user' | 'assistant' | 'system',
      content: row.content,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }
}
