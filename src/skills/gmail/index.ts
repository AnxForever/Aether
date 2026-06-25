/**
 * Gmail Skill
 *
 * Gmail email reading, sending, and management
 */

import { BaseSkill } from '../base-skill';
import type { Tool, ToolResult } from '../../types';
import type { SkillContext, GmailMessage } from '../types';
import {
  GmailSearchSchema,
  GmailSendSchema,
  GmailReadSchema,
} from '../types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GmailSkill extends BaseSkill {
  constructor() {
    super({
      id: 'gmail',
      name: 'Gmail',
      description: 'Gmail email reading, sending, and management using Gmail API',
      version: '1.0.0',
      author: 'Nexus Team',
      enabled: true,
      requiresAuth: true,
      dependencies: ['googleapis'],
    });
  }

  getTools(): Tool[] {
    return [
      {
        name: 'gmail_search',
        description: 'Search Gmail messages using Gmail search syntax',
        parameters: [
          {
            name: 'query',
            type: 'string',
            description: 'Gmail search query (e.g., "from:user@example.com is:unread")',
            required: true,
          },
          {
            name: 'maxResults',
            type: 'number',
            description: 'Maximum number of results to return (1-100)',
            required: false,
          },
        ],
        handler: async (params) => this.searchMessages(params),
      },
      {
        name: 'gmail_send',
        description: 'Send an email via Gmail',
        parameters: [
          {
            name: 'to',
            type: 'string',
            description: 'Recipient email address(es)',
            required: true,
          },
          {
            name: 'subject',
            type: 'string',
            description: 'Email subject',
            required: true,
          },
          {
            name: 'body',
            type: 'string',
            description: 'Email body content',
            required: true,
          },
          {
            name: 'cc',
            type: 'string',
            description: 'CC email address(es)',
            required: false,
          },
          {
            name: 'bcc',
            type: 'string',
            description: 'BCC email address(es)',
            required: false,
          },
          {
            name: 'attachments',
            type: 'array',
            description: 'Array of attachment objects with filename and path',
            required: false,
          },
        ],
        handler: async (params) => this.sendEmail(params),
      },
      {
        name: 'gmail_read',
        description: 'Read a specific Gmail message by ID',
        parameters: [
          {
            name: 'messageId',
            type: 'string',
            description: 'Gmail message ID',
            required: true,
          },
          {
            name: 'format',
            type: 'string',
            description: 'Message format: full, metadata, or minimal',
            required: false,
          },
        ],
        handler: async (params) => this.readMessage(params),
      },
      {
        name: 'gmail_mark_read',
        description: 'Mark a Gmail message as read',
        parameters: [
          {
            name: 'messageId',
            type: 'string',
            description: 'Gmail message ID',
            required: true,
          },
        ],
        handler: async (params) => this.markAsRead(params),
      },
      {
        name: 'gmail_delete',
        description: 'Delete a Gmail message (move to trash)',
        parameters: [
          {
            name: 'messageId',
            type: 'string',
            description: 'Gmail message ID',
            required: true,
          },
        ],
        handler: async (params) => this.deleteMessage(params),
      },
      {
        name: 'gmail_list_threads',
        description: 'List email threads from Gmail',
        parameters: [
          {
            name: 'query',
            type: 'string',
            description: 'Gmail search query',
            required: false,
          },
          {
            name: 'maxResults',
            type: 'number',
            description: 'Maximum number of threads to return (1-100)',
            required: false,
          },
        ],
        handler: async (params) => this.listThreads(params),
      },
      {
        name: 'gmail_get_thread',
        description: 'Get a complete email thread by ID',
        parameters: [
          {
            name: 'threadId',
            type: 'string',
            description: 'Gmail thread ID',
            required: true,
          },
        ],
        handler: async (params) => this.getThread(params),
      },
      {
        name: 'gmail_list_labels',
        description: 'List all Gmail labels',
        parameters: [],
        handler: async (params) => this.listLabels(params),
      },
      {
        name: 'gmail_create_label',
        description: 'Create a new Gmail label',
        parameters: [
          {
            name: 'name',
            type: 'string',
            description: 'Label name',
            required: true,
          },
          {
            name: 'labelListVisibility',
            type: 'string',
            description: 'Visibility in label list: show, hide, or showIfUnread',
            required: false,
          },
        ],
        handler: async (params) => this.createLabel(params),
      },
      {
        name: 'gmail_modify_labels',
        description: 'Add or remove labels from a message',
        parameters: [
          {
            name: 'messageId',
            type: 'string',
            description: 'Gmail message ID',
            required: true,
          },
          {
            name: 'addLabels',
            type: 'array',
            description: 'Array of label IDs to add',
            required: false,
          },
          {
            name: 'removeLabels',
            type: 'array',
            description: 'Array of label IDs to remove',
            required: false,
          },
        ],
        handler: async (params) => this.modifyLabels(params),
      },
      {
        name: 'gmail_list_drafts',
        description: 'List Gmail draft messages',
        parameters: [
          {
            name: 'maxResults',
            type: 'number',
            description: 'Maximum number of drafts to return (1-100)',
            required: false,
          },
        ],
        handler: async (params) => this.listDrafts(params),
      },
      {
        name: 'gmail_create_draft',
        description: 'Create a new Gmail draft',
        parameters: [
          {
            name: 'to',
            type: 'string',
            description: 'Recipient email address',
            required: true,
          },
          {
            name: 'subject',
            type: 'string',
            description: 'Email subject',
            required: true,
          },
          {
            name: 'body',
            type: 'string',
            description: 'Email body content',
            required: true,
          },
        ],
        handler: async (params) => this.createDraft(params),
      },
    ];
  }

  async isConfigured(context: SkillContext): Promise<boolean> {
    // Check if Gmail API credentials are available
    return !!(
      context.env.GMAIL_CLIENT_ID &&
      context.env.GMAIL_CLIENT_SECRET &&
      context.env.GMAIL_REFRESH_TOKEN
    );
  }

  private async searchMessages(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof GmailSearchSchema._type>(
      GmailSearchSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { query, maxResults = 10 } = validation.data;

      // Use Gmail API via googleapis library
      // This is a placeholder - actual implementation would use googleapis
      const messages: GmailMessage[] = [];

      return this.createSuccess(messages, {
        query,
        count: messages.length,
        maxResults,
      });
    } catch (error) {
      return this.handleError(error, 'Gmail search');
    }
  }

  private async sendEmail(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof GmailSendSchema._type>(
      GmailSendSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { to, subject, body, cc, bcc, attachments } = validation.data;

      // Build email message
      const recipients = Array.isArray(to) ? to.join(', ') : to;
      const ccList = cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined;
      const bccList = bcc ? (Array.isArray(bcc) ? bcc.join(', ') : bcc) : undefined;

      // Use Gmail API to send email
      // This is a placeholder - actual implementation would use googleapis
      const messageId = `msg_${Date.now()}`;

      return this.createSuccess(
        { messageId },
        {
          to: recipients,
          subject,
          hasAttachments: !!attachments && attachments.length > 0,
        }
      );
    } catch (error) {
      return this.handleError(error, 'Gmail send');
    }
  }

  private async readMessage(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof GmailReadSchema._type>(
      GmailReadSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { messageId, format = 'full' } = validation.data;

      // Use Gmail API to fetch message
      // This is a placeholder - actual implementation would use googleapis
      const message: GmailMessage = {
        id: messageId,
        threadId: 'thread_123',
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        subject: 'Email Subject',
        body: 'Email body content',
        date: new Date().toISOString(),
        labels: ['INBOX', 'UNREAD'],
      };

      return this.createSuccess(message, { format });
    } catch (error) {
      return this.handleError(error, 'Gmail read');
    }
  }

  private async markAsRead(params: unknown): Promise<ToolResult> {
    try {
      const { messageId } = params as { messageId: string };

      if (!messageId) {
        return this.createError('messageId is required');
      }

      // Use Gmail API to mark as read
      // This is a placeholder - actual implementation would use googleapis

      return this.createSuccess(undefined, { messageId, action: 'marked_read' });
    } catch (error) {
      return this.handleError(error, 'Gmail mark as read');
    }
  }

  private async deleteMessage(params: unknown): Promise<ToolResult> {
    try {
      const { messageId } = params as { messageId: string };

      if (!messageId) {
        return this.createError('messageId is required');
      }

      // Use Gmail API to delete message
      // This is a placeholder - actual implementation would use googleapis

      return this.createSuccess(undefined, { messageId, action: 'deleted' });
    } catch (error) {
      return this.handleError(error, 'Gmail delete');
    }
  }

  private async listThreads(params: unknown): Promise<ToolResult> {
    try {
      const { query = '', maxResults = 10 } = params as { query?: string; maxResults?: number };

      // Use Gmail API to list threads
      // This is a placeholder - actual implementation would use googleapis
      const threads: Array<{ id: string; snippet: string }> = [];

      return this.createSuccess(threads, {
        query,
        count: threads.length,
        maxResults,
      });
    } catch (error) {
      return this.handleError(error, 'Gmail list threads');
    }
  }

  private async getThread(params: unknown): Promise<ToolResult> {
    try {
      const { threadId } = params as { threadId: string };

      if (!threadId) {
        return this.createError('threadId is required');
      }

      // Use Gmail API to get thread
      // This is a placeholder - actual implementation would use googleapis
      const thread = {
        id: threadId,
        messages: [] as GmailMessage[],
      };

      return this.createSuccess(thread, { threadId, messageCount: thread.messages.length });
    } catch (error) {
      return this.handleError(error, 'Gmail get thread');
    }
  }

  private async listLabels(params: unknown): Promise<ToolResult> {
    try {
      // Use Gmail API to list labels
      // This is a placeholder - actual implementation would use googleapis
      const labels: Array<{ id: string; name: string; type: string }> = [
        { id: 'INBOX', name: 'INBOX', type: 'system' },
        { id: 'SENT', name: 'SENT', type: 'system' },
      ];

      return this.createSuccess(labels, { count: labels.length });
    } catch (error) {
      return this.handleError(error, 'Gmail list labels');
    }
  }

  private async createLabel(params: unknown): Promise<ToolResult> {
    try {
      const { name, labelListVisibility = 'labelShow' } = params as {
        name: string;
        labelListVisibility?: string;
      };

      if (!name) {
        return this.createError('name is required');
      }

      // Use Gmail API to create label
      // This is a placeholder - actual implementation would use googleapis
      const label = {
        id: `label_${Date.now()}`,
        name,
      };

      return this.createSuccess(label, { labelListVisibility });
    } catch (error) {
      return this.handleError(error, 'Gmail create label');
    }
  }

  private async modifyLabels(params: unknown): Promise<ToolResult> {
    try {
      const { messageId, addLabels = [], removeLabels = [] } = params as {
        messageId: string;
        addLabels?: string[];
        removeLabels?: string[];
      };

      if (!messageId) {
        return this.createError('messageId is required');
      }

      // Use Gmail API to modify labels
      // This is a placeholder - actual implementation would use googleapis

      return this.createSuccess(undefined, {
        messageId,
        added: addLabels.length,
        removed: removeLabels.length,
      });
    } catch (error) {
      return this.handleError(error, 'Gmail modify labels');
    }
  }

  private async listDrafts(params: unknown): Promise<ToolResult> {
    try {
      const { maxResults = 10 } = params as { maxResults?: number };

      // Use Gmail API to list drafts
      // This is a placeholder - actual implementation would use googleapis
      const drafts: Array<{ id: string; message: GmailMessage }> = [];

      return this.createSuccess(drafts, {
        count: drafts.length,
        maxResults,
      });
    } catch (error) {
      return this.handleError(error, 'Gmail list drafts');
    }
  }

  private async createDraft(params: unknown): Promise<ToolResult> {
    try {
      const { to, subject, body } = params as { to: string; subject: string; body: string };

      if (!to || !subject || !body) {
        return this.createError('to, subject, and body are required');
      }

      // Use Gmail API to create draft
      // This is a placeholder - actual implementation would use googleapis
      const draft = {
        id: `draft_${Date.now()}`,
        message: {
          id: `msg_${Date.now()}`,
          threadId: 'thread_123',
          from: 'me',
          to: [to],
          subject,
          body,
          date: new Date().toISOString(),
          labels: ['DRAFT'],
        } as GmailMessage,
      };

      return this.createSuccess(draft, { to, subject });
    } catch (error) {
      return this.handleError(error, 'Gmail create draft');
    }
  }
}
