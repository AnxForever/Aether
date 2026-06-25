/**
 * ColaLink Contacts - Contact management
 */

import Database from 'better-sqlite3';
import { createLogger } from '../utils/logger';

const logger = createLogger('ColaLink:Contacts');

/**
 * Contact
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
 * Contact request
 */
export interface ContactRequest {
  id: string;
  fromHandle: string;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
}

/**
 * Contacts Manager
 */
export class ContactsManager {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initializeTables();
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
        message TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        createdAt INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
      CREATE INDEX IF NOT EXISTS idx_requests_status ON contact_requests(status);
    `);
  }

  /**
   * List all contacts
   */
  listContacts(status?: Contact['status']): Contact[] {
    const query = status
      ? this.db.prepare('SELECT * FROM contacts WHERE status = ? ORDER BY displayName')
      : this.db.prepare('SELECT * FROM contacts ORDER BY displayName');

    return status ? query.all(status) as Contact[] : query.all() as Contact[];
  }

  /**
   * Add contact
   */
  addContact(contact: Omit<Contact, 'addedAt' | 'updatedAt'>): void {
    const now = Date.now();

    this.db
      .prepare(
        `INSERT INTO contacts (handle, displayName, avatar, publicKey, remark, status, addedAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        contact.handle,
        contact.displayName,
        contact.avatar || null,
        contact.publicKey,
        contact.remark || null,
        contact.status,
        now,
        now
      );

    logger.info(`Contact added: @${contact.handle}`);
  }

  /**
   * Update contact
   */
  updateContact(handle: string, updates: Partial<Contact>): void {
    const fields = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ');

    const values = [...Object.values(updates), Date.now(), handle];

    this.db.prepare(`UPDATE contacts SET ${fields}, updatedAt = ? WHERE handle = ?`).run(...values);

    logger.info(`Contact updated: @${handle}`);
  }

  /**
   * Block contact
   */
  blockContact(handle: string): void {
    this.updateContact(handle, { status: 'blocked' });
    logger.info(`Contact blocked: @${handle}`);
  }

  /**
   * Unblock contact
   */
  unblockContact(handle: string): void {
    this.updateContact(handle, { status: 'friend' });
    logger.info(`Contact unblocked: @${handle}`);
  }

  /**
   * Delete contact
   */
  deleteContact(handle: string): void {
    this.db.prepare('DELETE FROM contacts WHERE handle = ?').run(handle);
    logger.info(`Contact deleted: @${handle}`);
  }

  /**
   * Get contact by handle
   */
  getContact(handle: string): Contact | null {
    return this.db.prepare('SELECT * FROM contacts WHERE handle = ?').get(handle) as Contact | null;
  }

  /**
   * Send contact request
   */
  sendRequest(fromHandle: string, message?: string): ContactRequest {
    const request: ContactRequest = {
      id: `req_${Date.now()}`,
      fromHandle,
      message,
      status: 'pending',
      createdAt: Date.now()
    };

    this.db
      .prepare(
        'INSERT INTO contact_requests (id, fromHandle, message, status, createdAt) VALUES (?, ?, ?, ?, ?)'
      )
      .run(request.id, request.fromHandle, request.message || null, request.status, request.createdAt);

    logger.info(`Contact request sent to: @${fromHandle}`);
    return request;
  }

  /**
   * Accept contact request
   */
  acceptRequest(requestId: string): void {
    this.db.prepare('UPDATE contact_requests SET status = ? WHERE id = ?').run('accepted', requestId);
    logger.info(`Contact request accepted: ${requestId}`);
  }

  /**
   * Reject contact request
   */
  rejectRequest(requestId: string): void {
    this.db.prepare('UPDATE contact_requests SET status = ? WHERE id = ?').run('rejected', requestId);
    logger.info(`Contact request rejected: ${requestId}`);
  }

  /**
   * List pending requests
   */
  listPendingRequests(): ContactRequest[] {
    return this.db
      .prepare('SELECT * FROM contact_requests WHERE status = ? ORDER BY createdAt DESC')
      .all('pending') as ContactRequest[];
  }
}
