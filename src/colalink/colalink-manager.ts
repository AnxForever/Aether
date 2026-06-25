/**
 * ColaLink Manager - Central orchestrator for ColaLink system
 */

import { EventEmitter } from 'eventemitter3';
import { join } from 'path';
import { createLogger } from '../utils/logger';
import { ContactManager, Contact, ContactRequest } from './contact-manager';
import { MessageManager, Message } from './message-manager';
import { WeChatPlugin, WeChatPluginConfig } from './wechat-plugin';

const logger = createLogger('ColaLink:Manager');

/**
 * ColaLink configuration
 */
export interface ColaLinkConfig {
  dataDir: string;
  encryptionKey: string;
  myHandle: string;
  wechatPlugin?: WeChatPluginConfig;
}

/**
 * ColaLink events
 */
export interface ColaLinkEvents {
  'ready': () => void;
  'contact:added': (contact: Contact) => void;
  'contact:updated': (contact: Contact) => void;
  'message:received': (message: Message) => void;
  'message:sent': (message: Message) => void;
  'request:received': (request: ContactRequest) => void;
  'error': (error: Error) => void;
}

/**
 * ColaLink Manager - Central orchestration
 */
export class ColaLinkManager extends EventEmitter<ColaLinkEvents> {
  private config: ColaLinkConfig;
  private contactManager: ContactManager;
  private messageManager: MessageManager;
  private wechatPlugin?: WeChatPlugin;
  private dbPath: string;

  constructor(config: ColaLinkConfig) {
    super();
    this.config = config;
    this.dbPath = join(config.dataDir, 'colalink.db');

    // Initialize managers
    this.contactManager = new ContactManager(this.dbPath);
    this.messageManager = new MessageManager(this.dbPath, config.encryptionKey);

    // Setup event forwarding
    this.setupEventForwarding();

    // Initialize WeChat plugin if configured
    if (config.wechatPlugin) {
      this.wechatPlugin = new WeChatPlugin(
        this.contactManager,
        this.messageManager,
        config.wechatPlugin
      );
    }

    logger.info('ColaLinkManager initialized');
    this.emit('ready');
  }

  /**
   * Setup event forwarding from managers to main emitter
   */
  private setupEventForwarding(): void {
    // Contact events
    this.contactManager.on('contact:added', contact => {
      this.emit('contact:added', contact);
    });

    this.contactManager.on('contact:updated', contact => {
      this.emit('contact:updated', contact);
    });

    this.contactManager.on('request:received', request => {
      this.emit('request:received', request);
    });

    // Message events
    this.messageManager.on('message:received', message => {
      this.emit('message:received', message);
    });

    this.messageManager.on('message:sent', message => {
      this.emit('message:sent', message);
    });

    this.messageManager.on('message:failed', (messageId, error) => {
      logger.error(`Message failed: ${messageId}`, error as Error);
      this.emit('error', error);
    });
  }

  /**
   * Get contact manager
   */
  getContactManager(): ContactManager {
    return this.contactManager;
  }

  /**
   * Get message manager
   */
  getMessageManager(): MessageManager {
    return this.messageManager;
  }

  /**
   * Get WeChat plugin
   */
  getWeChatPlugin(): WeChatPlugin | undefined {
    return this.wechatPlugin;
  }

  /**
   * Send message
   */
  async sendMessage(toHandle: string, content: string): Promise<Message> {
    // Check if recipient exists
    const contact = this.contactManager.getContact(toHandle);
    if (!contact) {
      throw new Error(`Contact not found: @${toHandle}`);
    }

    if (contact.status === 'blocked') {
      throw new Error(`Contact is blocked: @${toHandle}`);
    }

    const message = await this.messageManager.sendMessage(
      this.config.myHandle,
      toHandle,
      content
    );

    // If WeChat contact, send to WeChat
    if (this.wechatPlugin && this.wechatPlugin.isWeChatHandle(toHandle)) {
      try {
        await this.wechatPlugin.sendToWeChat(message);
      } catch (error) {
        logger.error(`Failed to send to WeChat: ${message.id}`, error as Error);
        this.emit('error', error as Error);
      }
    }

    return message;
  }

  /**
   * Get conversation history
   */
  async getHistory(handle: string, limit?: number): Promise<Message[]> {
    return this.messageManager.getHistory(this.config.myHandle, handle, limit);
  }

  /**
   * List contacts
   */
  listContacts(status?: Contact['status']): Contact[] {
    return this.contactManager.listContacts(status);
  }

  /**
   * Add contact
   */
  addContact(contact: Omit<Contact, 'addedAt' | 'updatedAt'>): Contact {
    return this.contactManager.addContact(contact);
  }

  /**
   * Send contact request
   */
  sendContactRequest(toHandle: string, message?: string): ContactRequest {
    return this.contactManager.sendRequest(this.config.myHandle, toHandle, message);
  }

  /**
   * Accept contact request
   */
  acceptContactRequest(requestId: string): ContactRequest {
    const request = this.contactManager.acceptRequest(requestId);

    // Auto-add contact if not exists
    const existing = this.contactManager.getContact(request.fromHandle);
    if (!existing) {
      this.contactManager.addContact({
        handle: request.fromHandle,
        displayName: request.fromHandle,
        publicKey: 'pending', // Should be exchanged during request
        status: 'friend'
      });
    }

    return request;
  }

  /**
   * Reject contact request
   */
  rejectContactRequest(requestId: string): ContactRequest {
    return this.contactManager.rejectRequest(requestId);
  }

  /**
   * List pending requests
   */
  listPendingRequests(): ContactRequest[] {
    return this.contactManager.listPendingRequests(this.config.myHandle);
  }

  /**
   * Get unread count
   */
  getUnreadCount(): number {
    return this.messageManager.getUnreadCount(this.config.myHandle);
  }

  /**
   * Get recent conversations
   */
  async getRecentConversations(limit?: number): Promise<Array<{
    handle: string;
    lastMessage: Message;
    unreadCount: number;
  }>> {
    return this.messageManager.getRecentConversations(this.config.myHandle, limit);
  }

  /**
   * Mark message as read
   */
  markAsRead(messageId: string): void {
    this.messageManager.markAsRead(messageId);
  }

  /**
   * Withdraw message
   */
  withdrawMessage(messageId: string): void {
    this.messageManager.withdrawMessage(messageId);
  }

  /**
   * Block contact
   */
  blockContact(handle: string): void {
    this.contactManager.blockContact(handle);
  }

  /**
   * Unblock contact
   */
  unblockContact(handle: string): void {
    this.contactManager.unblockContact(handle);
  }

  /**
   * Delete contact
   */
  deleteContact(handle: string): void {
    this.contactManager.deleteContact(handle);
  }

  /**
   * Cleanup and close all resources
   */
  destroy(): void {
    if (this.wechatPlugin) {
      this.wechatPlugin.destroy();
    }

    this.messageManager.close();
    this.contactManager.close();

    this.removeAllListeners();
    logger.info('ColaLinkManager destroyed');
  }
}
