/**
 * ColaLink Contact Manager - EventEmitter-based contact management
 */

import Database from 'better-sqlite3';
import { EventEmitter } from 'eventemitter3';
import { createLogger } from '../utils/logger';

const logger = createLogger('ColaLink:ContactManager');

/**
 * Contact interface
 */
export interface Contact {
  handle: string;
  displayName: string;
  avatar?: string;
  publicKey: string;
  remark?: string;
  status: 'friend' | 'blocked' | 'pending';
  addedAt: number;
  updatedAt: number;
}

/**
 * Contact request interface
 */
export interface ContactRequest {
  id: string;
  fromHandle: string;
  toHandle: string;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
}

/**
 * Contact events
 */
export interface ContactEvents {
  'contact:added': (contact: Contact) => void;
  'contact:updated': (contact: Contact) => void;
  'contact:deleted': (handle: string) => void;
  'contact:blocked': (handle: string) => void;
  'contact:unblocked': (handle: string) => void;
  'request:received': (request: ContactRequest) => void;
  'request:accepted': (request: ContactRequest) => void;
  'request:rejected': (request: ContactRequest) => void;
  'request:sent': (request: ContactRequest) => void;
}

/**
 * Contact Manager with EventEmitter
 */
export class ContactManager extends EventEmitter<ContactEvents> {
  private db: Database.Database;

  constructor(dbPath: string) {
    super();
    this.db = new Database(dbPath);
    this.initializeTables();
    logger.info('ContactManager initialized');
  }

  /**
   * Initialize database tables
   */
  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contacts (
        handle TEXT PRIMARY KEY,
        displayName TEXT NOT NULL,
        avatar TEXT,
        publicKey TEXT NOT NULL,
        remark TEXT,
        status TEXT NOT NULL DEFAULT 'friend',
        addedAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS contact_requests (
        id TEXT PRIMARY KEY,
        fromHandle TEXT NOT NULL,
        toHandle TEXT NOT NULL,
        message TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        createdAt INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
      CREATE INDEX IF NOT EXISTS idx_requests_status ON contact_requests(status);
      CREATE INDEX IF NOT EXISTS idx_requests_to ON contact_requests(toHandle, status);
    `);
  }

  /**
   * List all contacts
   */
  listContacts(status?: Contact['status']): Contact[] {
    const query = status
      ? this.db.prepare('SELECT * FROM contacts WHERE status = ? ORDER BY displayName')
      : this.db.prepare('SELECT * FROM contacts ORDER BY displayName');

    return status ? (query.all(status) as Contact[]) : (query.all() as Contact[]);
  }

  /**
   * Get contact by handle
   */
  getContact(handle: string): Contact | null {
    return this.db.prepare('SELECT * FROM contacts WHERE handle = ?').get(handle) as Contact | null;
  }

  /**
   * Add contact
   */
  addContact(contact: Omit<Contact, 'addedAt' | 'updatedAt'>): Contact {
    const now = Date.now();

    const newContact: Contact = {
      ...contact,
      addedAt: now,
      updatedAt: now
    };

    this.db
      .prepare(
        `INSERT INTO contacts (handle, displayName, avatar, publicKey, remark, status, addedAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        newContact.handle,
        newContact.displayName,
        newContact.avatar || null,
        newContact.publicKey,
        newContact.remark || null,
        newContact.status,
        newContact.addedAt,
        newContact.updatedAt
      );

    logger.info(`Contact added: @${contact.handle}`);
    this.emit('contact:added', newContact);

    return newContact;
  }

  /**
   * Update contact
   */
  updateContact(handle: string, updates: Partial<Omit<Contact, 'handle' | 'addedAt'>>): Contact {
    const existing = this.getContact(handle);
    if (!existing) {
      throw new Error(`Contact not found: @${handle}`);
    }

    // SECURITY: Whitelist allowed fields to prevent SQL injection
    const ALLOWED_FIELDS = ['displayName', 'avatar', 'publicKey', 'remark', 'status'];
    const validUpdates: Record<string, any> = {};

    for (const [key, value] of Object.entries(updates)) {
      if (ALLOWED_FIELDS.includes(key)) {
        validUpdates[key] = value;
      }
    }

    // If no valid updates, return existing contact
    if (Object.keys(validUpdates).length === 0) {
      logger.warn(`No valid fields to update for contact: @${handle}`);
      return existing;
    }

    const now = Date.now();
    const updated: Contact = {
      ...existing,
      ...validUpdates,
      updatedAt: now
    };

    const fields = Object.keys(validUpdates)
      .map(key => `${key} = ?`)
      .join(', ');

    const values = [...Object.values(validUpdates), now, handle];

    this.db.prepare(`UPDATE contacts SET ${fields}, updatedAt = ? WHERE handle = ?`).run(...values);

    logger.info(`Contact updated: @${handle}`);
    this.emit('contact:updated', updated);

    return updated;
  }

  /**
   * Block contact
   */
  blockContact(handle: string): void {
    this.updateContact(handle, { status: 'blocked' });
    logger.info(`Contact blocked: @${handle}`);
    this.emit('contact:blocked', handle);
  }

  /**
   * Unblock contact
   */
  unblockContact(handle: string): void {
    this.updateContact(handle, { status: 'friend' });
    logger.info(`Contact unblocked: @${handle}`);
    this.emit('contact:unblocked', handle);
  }

  /**
   * Delete contact
   */
  deleteContact(handle: string): void {
    this.db.prepare('DELETE FROM contacts WHERE handle = ?').run(handle);
    logger.info(`Contact deleted: @${handle}`);
    this.emit('contact:deleted', handle);
  }

  /**
   * Send contact request
   */
  sendRequest(fromHandle: string, toHandle: string, message?: string): ContactRequest {
    const request: ContactRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromHandle,
      toHandle,
      message,
      status: 'pending',
      createdAt: Date.now()
    };

    this.db
      .prepare(
        'INSERT INTO contact_requests (id, fromHandle, toHandle, message, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(request.id, request.fromHandle, request.toHandle, request.message || null, request.status, request.createdAt);

    logger.info(`Contact request sent: @${fromHandle} → @${toHandle}`);
    this.emit('request:sent', request);

    return request;
  }

  /**
   * Receive contact request (from remote)
   */
  receiveRequest(request: ContactRequest): void {
    // Check if already exists
    const existing = this.db
      .prepare('SELECT id FROM contact_requests WHERE id = ?')
      .get(request.id) as { id: string } | undefined;

    if (existing) {
      logger.warn(`Duplicate request received: ${request.id}`);
      return;
    }

    this.db
      .prepare(
        'INSERT INTO contact_requests (id, fromHandle, toHandle, message, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(request.id, request.fromHandle, request.toHandle, request.message || null, request.status, request.createdAt);

    logger.info(`Contact request received: @${request.fromHandle} → @${request.toHandle}`);
    this.emit('request:received', request);
  }

  /**
   * Accept contact request
   */
  acceptRequest(requestId: string): ContactRequest {
    const request = this.db
      .prepare('SELECT * FROM contact_requests WHERE id = ?')
      .get(requestId) as ContactRequest | undefined;

    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    if (request.status !== 'pending') {
      throw new Error(`Request already processed: ${requestId}`);
    }

    this.db.prepare('UPDATE contact_requests SET status = ? WHERE id = ?').run('accepted', requestId);

    const accepted: ContactRequest = { ...request, status: 'accepted' };

    logger.info(`Contact request accepted: ${requestId}`);
    this.emit('request:accepted', accepted);

    return accepted;
  }

  /**
   * Reject contact request
   */
  rejectRequest(requestId: string): ContactRequest {
    const request = this.db
      .prepare('SELECT * FROM contact_requests WHERE id = ?')
      .get(requestId) as ContactRequest | undefined;

    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    if (request.status !== 'pending') {
      throw new Error(`Request already processed: ${requestId}`);
    }

    this.db.prepare('UPDATE contact_requests SET status = ? WHERE id = ?').run('rejected', requestId);

    const rejected: ContactRequest = { ...request, status: 'rejected' };

    logger.info(`Contact request rejected: ${requestId}`);
    this.emit('request:rejected', rejected);

    return rejected;
  }

  /**
   * List pending requests
   */
  listPendingRequests(toHandle?: string): ContactRequest[] {
    if (toHandle) {
      return this.db
        .prepare('SELECT * FROM contact_requests WHERE toHandle = ? AND status = ? ORDER BY createdAt DESC')
        .all(toHandle, 'pending') as ContactRequest[];
    }

    return this.db
      .prepare('SELECT * FROM contact_requests WHERE status = ? ORDER BY createdAt DESC')
      .all('pending') as ContactRequest[];
  }

  /**
   * Get request by ID
   */
  getRequest(requestId: string): ContactRequest | null {
    return this.db
      .prepare('SELECT * FROM contact_requests WHERE id = ?')
      .get(requestId) as ContactRequest | null;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
    logger.info('ContactManager closed');
  }
}
