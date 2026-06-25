/**
 * ColaLink Message Manager - EventEmitter-based messaging with E2EE
 */

import Database from 'better-sqlite3';
import { EventEmitter } from 'eventemitter3';
import { randomUUID } from 'crypto';
import { createLogger } from '../utils/logger';
import { E2EECrypto, EncryptedPayload } from './crypto';

const logger = createLogger('ColaLink:MessageManager');

/**
 * Message interface
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
 * Message events
 */
export interface MessageEvents {
  'message:sent': (message: Message) => void;
  'message:received': (message: Message) => void;
  'message:delivered': (message: Message) => void;
  'message:read': (message: Message) => void;
  'message:withdrawn': (message: Message) => void;
  'message:failed': (messageId: string, error: Error) => void;
}

/**
 * Key store for peer public keys
 */
interface PeerKeyEntry {
  handle: string;
  publicKey: string;
}

/**
 * Message Manager with EventEmitter and E2EE
 *
 * Uses ECDH + AES-256-GCM for end-to-end encryption:
 * - Each instance generates its own ECDH key pair
 * - Messages are encrypted with the recipient's public key
 * - Only the recipient can decrypt with their private key
 */
export class MessageManager extends EventEmitter<MessageEvents> {
  private db: Database.Database;
  private e2ee: E2EECrypto;

  constructor(dbPath: string) {
    super();
    this.db = new Database(dbPath);
    this.e2ee = new E2EECrypto();
    this.initializeTables();
    logger.info('MessageManager initialized with E2EE');
  }

  /**
   * Get this instance's ECDH public key
   */
  getPublicKey(): string {
    return this.e2ee.getPublicKey();
  }

  /**
   * Store a peer's public key for encryption
   *
   * Must be called before sending messages to this handle.
   * Typically called when a contact is added or during key exchange.
   */
  setPeerPublicKey(handle: string, publicKey: string): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO colalink_peer_keys (handle, publicKey)
         VALUES (?, ?)`
      )
      .run(handle, publicKey);

    logger.info(`Peer public key stored for @${handle}`);
  }

  /**
   * Get a peer's stored public key
   */
  getPeerPublicKey(handle: string): string | null {
    const entry = this.db
      .prepare('SELECT publicKey FROM colalink_peer_keys WHERE handle = ?')
      .get(handle) as PeerKeyEntry | undefined;

    return entry?.publicKey ?? null;
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
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON colalink_messages(fromHandle, toHandle, createdAt);
      CREATE INDEX IF NOT EXISTS idx_messages_status ON colalink_messages(status);

      CREATE TABLE IF NOT EXISTS colalink_peer_keys (
        handle TEXT PRIMARY KEY,
        publicKey TEXT NOT NULL
      );
    `);
  }

  /**
   * Send message with E2EE
   *
   * Encrypts content using recipient's public key (ECDH + AES-256-GCM).
   * The recipient's public key must have been stored via setPeerPublicKey().
   */
  async sendMessage(
    fromHandle: string,
    toHandle: string,
    content: string
  ): Promise<Message> {
    // Get recipient's public key
    const peerPublicKey = this.getPeerPublicKey(toHandle);
    if (!peerPublicKey) {
      throw new Error(
        `Cannot encrypt message to @${toHandle}: peer public key not found. ` +
          `Call setPeerPublicKey('${toHandle}', '<publicKey>') first.`
      );
    }

    // E2EE encrypt
    const payload = this.e2ee.encrypt(content, peerPublicKey);
    const encryptedContent = E2EECrypto.serialize(payload);

    const message: Message = {
      id: randomUUID(),
      fromHandle,
      toHandle,
      content: encryptedContent,
      encrypted: true,
      status: 'pending',
      createdAt: Date.now(),
    };

    this.db
      .prepare(
        `INSERT INTO colalink_messages (id, fromHandle, toHandle, content, encrypted, status, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        message.id,
        message.fromHandle,
        message.toHandle,
        message.content,
        1,
        message.status,
        message.createdAt
      );

    logger.info(
      `Message sent (E2EE): ${message.id} (@${fromHandle} → @${toHandle})`
    );
    this.emit('message:sent', message);

    return message;
  }

  /**
   * Receive message (from remote)
   *
   * The message is stored in encrypted form. Decryption happens on read
   * via getMessage() / getHistory().
   */
  async receiveMessage(message: Message): Promise<void> {
    // Check if message already exists
    const existing = this.db
      .prepare('SELECT id FROM colalink_messages WHERE id = ?')
      .get(message.id) as { id: string } | undefined;

    if (existing) {
      logger.warn(`Duplicate message received: ${message.id}`);
      return;
    }

    this.db
      .prepare(
        `INSERT INTO colalink_messages (id, fromHandle, toHandle, content, encrypted, status, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        message.id,
        message.fromHandle,
        message.toHandle,
        message.content,
        message.encrypted ? 1 : 0,
        message.status,
        message.createdAt
      );

    logger.info(
      `Message received: ${message.id} (@${message.fromHandle} → @${message.toHandle})`
    );
    this.emit('message:received', message);
  }

  /**
   * Decrypt a message's content in place
   *
   * Uses the sender's public key to derive the shared secret
   * and decrypt the message.
   */
  private decryptMessage(msg: Message): Message {
    if (!msg.encrypted) {
      return msg;
    }

    const peerPublicKey = this.getPeerPublicKey(msg.fromHandle);
    if (!peerPublicKey) {
      throw new Error(
        `Cannot decrypt message ${msg.id} from @${msg.fromHandle}: ` +
          `sender's public key not found.`
      );
    }

    const payload = E2EECrypto.deserialize(msg.content);
    const decrypted = this.e2ee.decrypt(payload, peerPublicKey);
    return { ...msg, content: decrypted };
  }

  /**
   * Get message by ID (decrypted)
   */
  async getMessage(messageId: string): Promise<Message | null> {
    const message = this.db
      .prepare('SELECT * FROM colalink_messages WHERE id = ?')
      .get(messageId) as Message | null;

    if (!message) {
      return null;
    }

    try {
      return this.decryptMessage(message);
    } catch (error) {
      logger.error(`Failed to decrypt message ${messageId}`, error as Error);
      throw error;
    }
  }

  /**
   * Get conversation history (decrypted)
   */
  async getHistory(
    handle1: string,
    handle2: string,
    limit: number = 50
  ): Promise<Message[]> {
    const messages = this.db
      .prepare(
        `SELECT * FROM colalink_messages
         WHERE (fromHandle = ? AND toHandle = ?) OR (fromHandle = ? AND toHandle = ?)
         ORDER BY createdAt DESC LIMIT ?`
      )
      .all(handle1, handle2, handle2, handle1, limit) as Message[];

    // Decrypt messages
    const decrypted = await Promise.all(
      messages.map(async (msg) => {
        if (!msg.encrypted) return msg;

        try {
          return this.decryptMessage(msg);
        } catch (error) {
          logger.error(
            `Failed to decrypt message ${msg.id}`,
            error as Error
          );
          throw new Error(
            `Decryption failed for message ${msg.id}: ${(error as Error).message}`
          );
        }
      })
    );

    return decrypted.reverse();
  }

  /**
   * Mark message as sent
   */
  markAsSent(messageId: string): void {
    const message = this.db
      .prepare('SELECT * FROM colalink_messages WHERE id = ?')
      .get(messageId) as Message | undefined;

    if (!message) {
      logger.warn(`Message not found: ${messageId}`);
      return;
    }

    this.db
      .prepare('UPDATE colalink_messages SET status = ? WHERE id = ?')
      .run('sent', messageId);

    const updated: Message = { ...message, status: 'sent' };
    logger.info(`Message marked as sent: ${messageId}`);
  }

  /**
   * Mark message as delivered
   */
  markAsDelivered(messageId: string): void {
    const message = this.db
      .prepare('SELECT * FROM colalink_messages WHERE id = ?')
      .get(messageId) as Message | undefined;

    if (!message) {
      logger.warn(`Message not found: ${messageId}`);
      return;
    }

    const deliveredAt = Date.now();
    this.db
      .prepare(
        'UPDATE colalink_messages SET status = ?, deliveredAt = ? WHERE id = ?'
      )
      .run('delivered', deliveredAt, messageId);

    const updated: Message = {
      ...message,
      status: 'delivered',
      deliveredAt,
    };
    logger.info(`Message marked as delivered: ${messageId}`);
    this.emit('message:delivered', updated);
  }

  /**
   * Mark message as read
   */
  markAsRead(messageId: string): void {
    const message = this.db
      .prepare('SELECT * FROM colalink_messages WHERE id = ?')
      .get(messageId) as Message | undefined;

    if (!message) {
      logger.warn(`Message not found: ${messageId}`);
      return;
    }

    const readAt = Date.now();
    this.db
      .prepare(
        'UPDATE colalink_messages SET status = ?, readAt = ? WHERE id = ?'
      )
      .run('read', readAt, messageId);

    const updated: Message = { ...message, status: 'read', readAt };
    logger.info(`Message marked as read: ${messageId}`);
    this.emit('message:read', updated);
  }

  /**
   * Withdraw message
   */
  withdrawMessage(messageId: string): void {
    const message = this.db
      .prepare('SELECT * FROM colalink_messages WHERE id = ?')
      .get(messageId) as Message | undefined;

    if (!message) {
      throw new Error(`Message not found: ${messageId}`);
    }

    this.db
      .prepare('UPDATE colalink_messages SET status = ? WHERE id = ?')
      .run('withdrawn', messageId);

    const updated: Message = { ...message, status: 'withdrawn' };
    logger.info(`Message withdrawn: ${messageId}`);
    this.emit('message:withdrawn', updated);
  }

  /**
   * Get unread count for a handle
   */
  getUnreadCount(handle: string): number {
    const result = this.db
      .prepare(
        'SELECT COUNT(*) as count FROM colalink_messages WHERE toHandle = ? AND status NOT IN (?, ?)'
      )
      .get(handle, 'read', 'withdrawn') as { count: number };

    return result.count;
  }

  /**
   * Get recent conversations
   */
  async getRecentConversations(
    myHandle: string,
    limit: number = 20
  ): Promise<
    Array<{
      handle: string;
      lastMessage: Message;
      unreadCount: number;
    }>
  > {
    const conversations = this.db
      .prepare(
        `SELECT
          CASE
            WHEN fromHandle = ? THEN toHandle
            ELSE fromHandle
          END as handle,
          id,
          MAX(createdAt) as lastTime
         FROM colalink_messages
         WHERE fromHandle = ? OR toHandle = ?
         GROUP BY handle
         ORDER BY lastTime DESC
         LIMIT ?`
      )
      .all(myHandle, myHandle, myHandle, limit) as Array<{
      handle: string;
      id: string;
    }>;

    const result = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await this.getMessage(conv.id);
        const unreadCount = this.db
          .prepare(
            'SELECT COUNT(*) as count FROM colalink_messages WHERE fromHandle = ? AND toHandle = ? AND status NOT IN (?, ?)'
          )
          .get(conv.handle, myHandle, 'read', 'withdrawn') as {
          count: number;
        };

        return {
          handle: conv.handle,
          lastMessage: lastMessage!,
          unreadCount: unreadCount.count,
        };
      })
    );

    return result;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
    logger.info('MessageManager closed');
  }
}
