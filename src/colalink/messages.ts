/**
 * ColaLink Messages - Peer-to-peer messaging
 */

import Database from 'better-sqlite3';
import { createLogger } from '../utils/logger';
import { encrypt, decrypt } from '../utils/crypto';

const logger = createLogger('ColaLink:Messages');

/**
 * Message
 */
export interface Message {
  id: string;
  fromHandle: string;
  toHandle: string;
  content: string;
  encrypted: boolean;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'withdrawn';
  createdAt: number;
  deliveredAt?: number;
  readAt?: number;
}

/**
 * Messages Manager
 */
export class MessagesManager {
  private db: Database.Database;
  private encryptionKey: string;

  constructor(dbPath: string, encryptionKey: string) {
    this.db = new Database(dbPath);
    this.encryptionKey = encryptionKey;
    this.initializeTables();
  }

  /**
   * Initialize database tables
   */
  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS colalink_messages (
        id TEXT PRIMARY KEY,
        fromHandle TEXT NOT NULL,
        toHandle TEXT NOT NULL,
        content TEXT NOT NULL,
        encrypted INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'pending',
        createdAt INTEGER NOT NULL,
        deliveredAt INTEGER,
        readAt INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_messages_from ON colalink_messages(fromHandle);
      CREATE INDEX IF NOT EXISTS idx_messages_to ON colalink_messages(toHandle);
      CREATE INDEX IF NOT EXISTS idx_messages_status ON colalink_messages(status);
    `);
  }

  /**
   * Send message
   */
  async sendMessage(fromHandle: string, toHandle: string, content: string): Promise<Message> {
    const encryptedContent = await encrypt(content, this.encryptionKey);

    const message: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromHandle,
      toHandle,
      content: encryptedContent,
      encrypted: true,
      status: 'pending',
      createdAt: Date.now()
    };

    this.db
      .prepare(
        `INSERT INTO colalink_messages (id, fromHandle, toHandle, content, encrypted, status, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(message.id, message.fromHandle, message.toHandle, message.content, 1, message.status, message.createdAt);

    logger.info(`Message sent: ${message.id} (@${fromHandle} → @${toHandle})`);
    return message;
  }

  /**
   * Get message history
   */
  async getHistory(handle1: string, handle2: string, limit: number = 50): Promise<Message[]> {
    const messages = this.db
      .prepare(
        `SELECT * FROM colalink_messages
         WHERE (fromHandle = ? AND toHandle = ?) OR (fromHandle = ? AND toHandle = ?)
         ORDER BY createdAt DESC LIMIT ?`
      )
      .all(handle1, handle2, handle2, handle1, limit) as Message[];

    // Decrypt messages
    const decrypted = await Promise.all(
      messages.map(async msg => ({
        ...msg,
        content: msg.encrypted ? await decrypt(msg.content, this.encryptionKey) : msg.content
      }))
    );

    return decrypted.reverse();
  }

  /**
   * Mark message as delivered
   */
  markAsDelivered(messageId: string): void {
    this.db
      .prepare('UPDATE colalink_messages SET status = ?, deliveredAt = ? WHERE id = ?')
      .run('delivered', Date.now(), messageId);
  }

  /**
   * Mark message as read
   */
  markAsRead(messageId: string): void {
    this.db
      .prepare('UPDATE colalink_messages SET status = ?, readAt = ? WHERE id = ?')
      .run('read', Date.now(), messageId);
  }

  /**
   * Withdraw message
   */
  withdrawMessage(messageId: string): void {
    this.db.prepare('UPDATE colalink_messages SET status = ? WHERE id = ?').run('withdrawn', messageId);
    logger.info(`Message withdrawn: ${messageId}`);
  }

  /**
   * Get unread count
   */
  getUnreadCount(handle: string): number {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM colalink_messages WHERE toHandle = ? AND status != ?')
      .get(handle, 'read') as { count: number };

    return result.count;
  }
}
