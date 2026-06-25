/**
 * ColaLink WeChat Plugin - Bridge between WeChat and ColaLink
 */

import { EventEmitter } from 'eventemitter3';
import { createLogger } from '../utils/logger';
import { ContactManager, Contact, ContactRequest } from './contact-manager';
import { MessageManager, Message } from './message-manager';

const logger = createLogger('ColaLink:WeChatPlugin');

/**
 * WeChat message format
 */
export interface WeChatMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: number;
  type: 'text' | 'image' | 'video' | 'file';
}

/**
 * WeChat contact format
 */
export interface WeChatContact {
  wxid: string;
  nickname: string;
  avatar?: string;
  remark?: string;
}

/**
 * Plugin events
 */
export interface WeChatPluginEvents {
  'wechat:message': (message: WeChatMessage) => void;
  'wechat:contact:added': (contact: WeChatContact) => void;
  'colalink:message': (message: Message) => void;
  'colalink:contact:added': (contact: Contact) => void;
  'sync:complete': () => void;
  'sync:error': (error: Error) => void;
}

/**
 * WeChat Plugin Configuration
 */
export interface WeChatPluginConfig {
  myHandle: string;
  autoSync: boolean;
  syncInterval?: number;
  handlePrefix?: string;
}

/**
 * WeChat Plugin - Bridge WeChat and ColaLink
 */
export class WeChatPlugin extends EventEmitter<WeChatPluginEvents> {
  private contactManager: ContactManager;
  private messageManager: MessageManager;
  private config: Required<WeChatPluginConfig>;
  private syncTimer?: NodeJS.Timeout;

  constructor(
    contactManager: ContactManager,
    messageManager: MessageManager,
    config: WeChatPluginConfig
  ) {
    super();
    this.contactManager = contactManager;
    this.messageManager = messageManager;
    this.config = {
      ...config,
      syncInterval: config.syncInterval || 60000, // 1 minute
      handlePrefix: config.handlePrefix || 'wx_'
    };

    this.setupEventHandlers();
    logger.info('WeChatPlugin initialized');

    if (this.config.autoSync) {
      this.startAutoSync();
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Forward ColaLink events
    this.contactManager.on('contact:added', contact => {
      this.emit('colalink:contact:added', contact);
    });

    this.messageManager.on('message:received', message => {
      this.emit('colalink:message', message);
    });
  }

  /**
   * Convert WeChat wxid to ColaLink handle
   */
  private wechatToHandle(wxid: string): string {
    return `${this.config.handlePrefix}${wxid}`;
  }

  /**
   * Convert ColaLink handle to WeChat wxid
   */
  private handleToWechat(handle: string): string | null {
    if (!handle.startsWith(this.config.handlePrefix)) {
      return null;
    }
    return handle.substring(this.config.handlePrefix.length);
  }

  /**
   * Sanitize input to prevent XSS
   */
  private sanitizeInput(input: string): string {
    return input
      .replace(/[<>'"]/g, '')
      .trim()
      .slice(0, 1000); // Max length
  }

  /**
   * Validate WeChat contact input
   */
  private validateWeChatContact(wechatContact: WeChatContact): void {
    if (!wechatContact.wxid || typeof wechatContact.wxid !== 'string') {
      throw new Error('Invalid wxid');
    }
    if (!wechatContact.nickname || typeof wechatContact.nickname !== 'string') {
      throw new Error('Invalid nickname');
    }
    if (wechatContact.wxid.length > 100) {
      throw new Error('wxid too long');
    }
    if (wechatContact.nickname.length > 100) {
      throw new Error('nickname too long');
    }
  }

  /**
   * Sync WeChat contact to ColaLink
   */
  async syncWeChatContact(wechatContact: WeChatContact): Promise<Contact> {
    // SECURITY: Validate and sanitize input
    this.validateWeChatContact(wechatContact);

    const handle = this.wechatToHandle(this.sanitizeInput(wechatContact.wxid));

    // Check if contact exists
    let contact = this.contactManager.getContact(handle);

    if (contact) {
      // Update existing contact
      contact = this.contactManager.updateContact(handle, {
        displayName: this.sanitizeInput(wechatContact.nickname),
        avatar: wechatContact.avatar ? this.sanitizeInput(wechatContact.avatar) : undefined,
        remark: wechatContact.remark ? this.sanitizeInput(wechatContact.remark) : undefined
      });
      logger.info(`WeChat contact updated: ${wechatContact.wxid} → @${handle}`);
    } else {
      // Add new contact
      contact = this.contactManager.addContact({
        handle,
        displayName: this.sanitizeInput(wechatContact.nickname),
        avatar: wechatContact.avatar ? this.sanitizeInput(wechatContact.avatar) : undefined,
        publicKey: 'wechat_bridge', // Placeholder for WeChat bridge
        remark: wechatContact.remark ? this.sanitizeInput(wechatContact.remark) : undefined,
        status: 'friend'
      });
      logger.info(`WeChat contact synced: ${wechatContact.wxid} → @${handle}`);
      this.emit('wechat:contact:added', wechatContact);
    }

    return contact;
  }

  /**
   * Validate WeChat message input
   */
  private validateWeChatMessage(wechatMessage: WeChatMessage): void {
    if (!wechatMessage.id || typeof wechatMessage.id !== 'string') {
      throw new Error('Invalid message id');
    }
    if (!wechatMessage.from || typeof wechatMessage.from !== 'string') {
      throw new Error('Invalid from field');
    }
    if (!wechatMessage.to || typeof wechatMessage.to !== 'string') {
      throw new Error('Invalid to field');
    }
    if (!wechatMessage.content || typeof wechatMessage.content !== 'string') {
      throw new Error('Invalid content');
    }
    if (wechatMessage.content.length > 10000) {
      throw new Error('Message content too long');
    }
  }

  /**
   * Sync WeChat message to ColaLink
   */
  async syncWeChatMessage(wechatMessage: WeChatMessage): Promise<Message> {
    // SECURITY: Validate and sanitize input
    this.validateWeChatMessage(wechatMessage);

    const fromHandle = this.wechatToHandle(this.sanitizeInput(wechatMessage.from));
    const toHandle = this.wechatToHandle(this.sanitizeInput(wechatMessage.to));

    // Check if message already exists
    const existing = await this.messageManager.getMessage(wechatMessage.id);
    if (existing) {
      logger.warn(`Duplicate WeChat message: ${wechatMessage.id}`);
      return existing;
    }

    // Receive message to ColaLink
    const message: Message = {
      id: this.sanitizeInput(wechatMessage.id),
      fromHandle,
      toHandle,
      content: this.sanitizeInput(wechatMessage.content),
      encrypted: false,
      status: 'delivered',
      createdAt: wechatMessage.timestamp
    };

    await this.messageManager.receiveMessage(message);
    logger.info(`WeChat message synced: ${wechatMessage.id}`);
    this.emit('wechat:message', wechatMessage);

    return message;
  }

  /**
   * Send ColaLink message to WeChat
   */
  async sendToWeChat(message: Message): Promise<WeChatMessage> {
    const wxidFrom = this.handleToWechat(message.fromHandle);
    const wxidTo = this.handleToWechat(message.toHandle);

    if (!wxidFrom || !wxidTo) {
      throw new Error('Invalid WeChat handle');
    }

    const wechatMessage: WeChatMessage = {
      id: message.id,
      from: wxidFrom,
      to: wxidTo,
      content: message.content,
      timestamp: message.createdAt,
      type: 'text'
    };

    // In production, send to WeChat API/hook
    logger.info(`Message sent to WeChat: ${message.id} (${wxidFrom} → ${wxidTo})`);

    // Mark as sent
    this.messageManager.markAsSent(message.id);

    return wechatMessage;
  }

  /**
   * Sync all WeChat contacts
   */
  async syncAllContacts(wechatContacts: WeChatContact[]): Promise<Contact[]> {
    logger.info(`Syncing ${wechatContacts.length} WeChat contacts...`);

    const BATCH_SIZE = 10; // Concurrent batch size
    const synced: Contact[] = [];

    // Process contacts in batches with concurrency control
    for (let i = 0; i < wechatContacts.length; i += BATCH_SIZE) {
      const batch = wechatContacts.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(wc => this.syncWeChatContact(wc))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          synced.push(result.value);
        } else {
          logger.error('Failed to sync contact', result.reason instanceof Error ? result.reason : new Error(String(result.reason)));
          this.emit('sync:error', result.reason instanceof Error ? result.reason : new Error(String(result.reason)));
        }
      }
    }

    this.emit('sync:complete');
    logger.info(`Synced ${synced.length}/${wechatContacts.length} contacts`);

    return synced;
  }

  /**
   * Sync all WeChat messages
   */
  async syncAllMessages(wechatMessages: WeChatMessage[]): Promise<Message[]> {
    logger.info(`Syncing ${wechatMessages.length} WeChat messages...`);

    const BATCH_SIZE = 10; // Concurrent batch size
    const synced: Message[] = [];

    // Process messages in batches with concurrency control
    for (let i = 0; i < wechatMessages.length; i += BATCH_SIZE) {
      const batch = wechatMessages.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(wm => this.syncWeChatMessage(wm))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          synced.push(result.value);
        } else {
          logger.error('Failed to sync message', result.reason instanceof Error ? result.reason : new Error(String(result.reason)));
          this.emit('sync:error', result.reason instanceof Error ? result.reason : new Error(String(result.reason)));
        }
      }
    }

    this.emit('sync:complete');
    logger.info(`Synced ${synced.length}/${wechatMessages.length} messages`);

    return synced;
  }

  /**
   * Start auto-sync
   */
  startAutoSync(): void {
    if (this.syncTimer) {
      logger.warn('Auto-sync already running');
      return;
    }

    this.syncTimer = setInterval(() => {
      logger.debug('Auto-sync triggered');
      // In production, fetch from WeChat API and sync
      // this.syncAllContacts(...);
      // this.syncAllMessages(...);
    }, this.config.syncInterval);

    // Prevent blocking process exit
    this.syncTimer.unref();

    logger.info(`Auto-sync started (interval: ${this.config.syncInterval}ms)`);
  }

  /**
   * Stop auto-sync
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
      logger.info('Auto-sync stopped');
    }
  }

  /**
   * Check if handle is WeChat bridge
   */
  isWeChatHandle(handle: string): boolean {
    return handle.startsWith(this.config.handlePrefix);
  }

  /**
   * Get WeChat contacts
   */
  getWeChatContacts(): Contact[] {
    const allContacts = this.contactManager.listContacts('friend');
    return allContacts.filter(contact => this.isWeChatHandle(contact.handle));
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopAutoSync();
    this.removeAllListeners();
    logger.info('WeChatPlugin destroyed');
  }
}
