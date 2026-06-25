/**
 * Slack Message Handler
 *
 * Handles message events, formatting, and sending
 */

import { EventEmitter } from 'eventemitter3';
import { WebClient } from '@slack/web-api';
import {
  MessageEvent,
  FormattedMessage,
  MessageBlock,
  FileUploadOptions,
} from './types';

/**
 * Message Handler
 *
 * Features:
 * - Receive and parse message events
 * - Send formatted messages (blocks, attachments)
 * - File upload
 * - Thread support
 * - Retry on rate limit
 */
export class MessageHandler extends EventEmitter {
  private client: WebClient;

  constructor(client: WebClient) {
    super();
    this.client = client;
  }

  /**
   * Handle incoming message event
   */
  async handleMessage(event: MessageEvent): Promise<void> {
    try {
      // Ignore bot messages to prevent loops
      if (event.subtype === 'bot_message') {
        return;
      }

      // Ignore message changes/deletions
      if (event.subtype && event.subtype !== 'thread_broadcast') {
        return;
      }

      this.emit('message:received', event);
    } catch (error) {
      this.emit('message:error', error);
      throw error;
    }
  }

  /**
   * Send plain text message
   */
  async sendMessage(channel: string, text: string, threadTs?: string): Promise<string> {
    try {
      const result = await this.client.chat.postMessage({
        channel,
        text,
        thread_ts: threadTs,
      });

      if (!result.ok) {
        throw new Error(`Failed to send message: ${result.error}`);
      }

      return result.ts!;
    } catch (error) {
      this.emit('message:error', error);
      throw error;
    }
  }

  /**
   * Send formatted message with blocks
   */
  async sendFormattedMessage(message: FormattedMessage): Promise<string> {
    try {
      const result = await this.client.chat.postMessage({
        channel: message.channel,
        text: message.text,
        blocks: message.blocks as any,
        attachments: message.attachments as any,
        thread_ts: message.thread_ts,
        reply_broadcast: message.reply_broadcast,
        unfurl_links: message.unfurl_links ?? true,
        unfurl_media: message.unfurl_media ?? true,
      } as any);

      if (!result.ok) {
        throw new Error(`Failed to send message: ${result.error}`);
      }

      return result.ts!;
    } catch (error) {
      this.emit('message:error', error);
      throw error;
    }
  }

  /**
   * Update existing message
   */
  async updateMessage(
    channel: string,
    ts: string,
    text?: string,
    blocks?: MessageBlock[]
  ): Promise<void> {
    try {
      const result = await this.client.chat.update({
        channel,
        ts,
        text: text || 'Message updated',
        blocks,
      });

      if (!result.ok) {
        throw new Error(`Failed to update message: ${result.error}`);
      }
    } catch (error) {
      this.emit('message:error', error);
      throw error;
    }
  }

  /**
   * Delete message
   */
  async deleteMessage(channel: string, ts: string): Promise<void> {
    try {
      const result = await this.client.chat.delete({
        channel,
        ts,
      });

      if (!result.ok) {
        throw new Error(`Failed to delete message: ${result.error}`);
      }
    } catch (error) {
      this.emit('message:error', error);
      throw error;
    }
  }

  /**
   * Add reaction to message
   */
  async addReaction(channel: string, timestamp: string, emoji: string): Promise<void> {
    try {
      const result = await this.client.reactions.add({
        channel,
        timestamp,
        name: emoji.replace(/:/g, ''), // Remove colons if present
      });

      if (!result.ok) {
        throw new Error(`Failed to add reaction: ${result.error}`);
      }
    } catch (error) {
      this.emit('message:error', error);
      throw error;
    }
  }

  /**
   * Upload file
   */
  async uploadFile(options: FileUploadOptions): Promise<void> {
    try {
      const result = await this.client.files.uploadV2({
        channels: options.channels as string | undefined,
        content: options.content,
        file: options.file as any,
        filename: options.filename,
        filetype: options.filetype,
        initial_comment: options.initial_comment,
        thread_ts: options.thread_ts,
        title: options.title,
      } as any);

      if (!result.ok) {
        throw new Error(`Failed to upload file: ${result.error}`);
      }
    } catch (error) {
      this.emit('message:error', error);
      throw error;
    }
  }

  /**
   * Build message blocks helpers
   */

  /**
   * Create header block
   */
  static createHeaderBlock(text: string): MessageBlock {
    return {
      type: 'header',
      text: {
        type: 'plain_text',
        text,
        emoji: true,
      },
    };
  }

  /**
   * Create section block with markdown
   */
  static createSectionBlock(text: string, accessory?: any): MessageBlock {
    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text,
      },
      accessory,
    };
  }

  /**
   * Create divider block
   */
  static createDividerBlock(): MessageBlock {
    return {
      type: 'divider',
    };
  }

  /**
   * Create context block
   */
  static createContextBlock(elements: string[]): MessageBlock {
    return {
      type: 'context',
      elements: elements.map((text) => ({
        type: 'mrkdwn',
        text,
      })),
    };
  }

  /**
   * Create button accessory
   */
  static createButton(text: string, actionId: string, value?: string, style?: 'primary' | 'danger'): any {
    return {
      type: 'button',
      text: {
        type: 'plain_text',
        text,
        emoji: true,
      },
      action_id: actionId,
      value: value || actionId,
      style,
    };
  }

  /**
   * Create select menu
   */
  static createSelectMenu(
    placeholder: string,
    actionId: string,
    options: Array<{ text: string; value: string }>
  ): any {
    return {
      type: 'static_select',
      placeholder: {
        type: 'plain_text',
        text: placeholder,
        emoji: true,
      },
      action_id: actionId,
      options: options.map((opt) => ({
        text: {
          type: 'plain_text',
          text: opt.text,
          emoji: true,
        },
        value: opt.value,
      })),
    };
  }

  /**
   * Format user mention
   */
  static mentionUser(userId: string): string {
    return `<@${userId}>`;
  }

  /**
   * Format channel mention
   */
  static mentionChannel(channelId: string): string {
    return `<#${channelId}>`;
  }

  /**
   * Format link
   */
  static formatLink(url: string, text?: string): string {
    return text ? `<${url}|${text}>` : `<${url}>`;
  }

  /**
   * Format bold text
   */
  static bold(text: string): string {
    return `*${text}*`;
  }

  /**
   * Format italic text
   */
  static italic(text: string): string {
    return `_${text}_`;
  }

  /**
   * Format strikethrough text
   */
  static strikethrough(text: string): string {
    return `~${text}~`;
  }

  /**
   * Format code block
   */
  static codeBlock(code: string, language?: string): string {
    return language ? `\`\`\`${language}\n${code}\n\`\`\`` : `\`\`\`${code}\`\`\``;
  }

  /**
   * Format inline code
   */
  static code(text: string): string {
    return `\`${text}\``;
  }

  /**
   * Create rich message example
   */
  static createRichMessage(
    title: string,
    description: string,
    fields?: Array<{ title: string; value: string }>,
    buttons?: Array<{ text: string; actionId: string; value?: string }>
  ): MessageBlock[] {
    const blocks: MessageBlock[] = [
      this.createHeaderBlock(title),
      this.createSectionBlock(description),
    ];

    if (fields && fields.length > 0) {
      blocks.push(this.createDividerBlock());
      fields.forEach((field) => {
        blocks.push(
          this.createSectionBlock(`${this.bold(field.title)}\n${field.value}`)
        );
      });
    }

    if (buttons && buttons.length > 0) {
      blocks.push({
        type: 'actions',
        elements: buttons.map((btn) =>
          this.createButton(btn.text, btn.actionId, btn.value)
        ),
      });
    }

    return blocks;
  }
}
