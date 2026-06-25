/**
 * Google Docs Skill
 *
 * Google Docs reading, creation, and editing
 */

import { BaseSkill } from '../base-skill';
import type { Tool, ToolResult } from '../../types';
import type { SkillContext, DocsDocument } from '../types';
import {
  DocsReadSchema,
  DocsCreateSchema,
  DocsUpdateSchema,
} from '../types';

export class DocsSkill extends BaseSkill {
  constructor() {
    super({
      id: 'docs',
      name: 'Google Docs',
      description: 'Google Docs reading, creation, and editing using Docs API',
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
        name: 'docs_read',
        description: 'Read content from a Google Docs document',
        parameters: [
          {
            name: 'documentId',
            type: 'string',
            description: 'The ID of the document',
            required: true,
          },
        ],
        handler: async (params) => this.readDoc(params),
      },
      {
        name: 'docs_create',
        description: 'Create a new Google Docs document',
        parameters: [
          {
            name: 'title',
            type: 'string',
            description: 'The title of the new document',
            required: true,
          },
          {
            name: 'content',
            type: 'string',
            description: 'Initial content for the document',
            required: false,
          },
        ],
        handler: async (params) => this.createDoc(params),
      },
      {
        name: 'docs_update',
        description: 'Update a Google Docs document with batch requests',
        parameters: [
          {
            name: 'documentId',
            type: 'string',
            description: 'The ID of the document',
            required: true,
          },
          {
            name: 'requests',
            type: 'array',
            description: 'Array of update requests (insertText, deleteContentRange, etc.)',
            required: true,
          },
        ],
        handler: async (params) => this.updateDoc(params),
      },
      {
        name: 'docs_append',
        description: 'Append text to the end of a Google Docs document',
        parameters: [
          {
            name: 'documentId',
            type: 'string',
            description: 'The ID of the document',
            required: true,
          },
          {
            name: 'text',
            type: 'string',
            description: 'Text to append',
            required: true,
          },
        ],
        handler: async (params) => this.appendDoc(params),
      },
      {
        name: 'docs_export',
        description: 'Export a Google Docs document to various formats',
        parameters: [
          {
            name: 'documentId',
            type: 'string',
            description: 'The ID of the document',
            required: true,
          },
          {
            name: 'mimeType',
            type: 'string',
            description: 'Export format: text/plain, text/html, application/pdf, etc.',
            required: true,
          },
          {
            name: 'outputPath',
            type: 'string',
            description: 'Local path to save the exported file',
            required: true,
          },
        ],
        handler: async (params) => this.exportDoc(params),
      },
    ];
  }

  async isConfigured(context: SkillContext): Promise<boolean> {
    // Check if Google Docs API credentials are available
    return !!(
      context.env.GOOGLE_CLIENT_ID &&
      context.env.GOOGLE_CLIENT_SECRET &&
      context.env.GOOGLE_REFRESH_TOKEN
    );
  }

  private async readDoc(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof DocsReadSchema._type>(
      DocsReadSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { documentId } = validation.data;

      // Use Google Docs API to read document
      // This is a placeholder - actual implementation would use googleapis
      const document: DocsDocument = {
        documentId,
        title: 'Sample Document',
        body: {
          content: [
            {
              paragraph: {
                elements: [
                  {
                    textRun: {
                      content: 'This is sample document content.\n',
                    },
                  },
                ],
              },
            },
          ],
        },
      };

      // Extract plain text content
      const content = this.extractTextContent(document);

      return this.createSuccess(
        { content, document },
        {
          documentId,
          characterCount: content.length,
        }
      );
    } catch (error) {
      return this.handleError(error, 'Docs read');
    }
  }

  private async createDoc(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof DocsCreateSchema._type>(
      DocsCreateSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { title, content } = validation.data;

      // Use Google Docs API to create document
      // This is a placeholder - actual implementation would use googleapis
      const documentId = `doc_${Date.now()}`;
      const documentUrl = `https://docs.google.com/document/d/${documentId}`;

      return this.createSuccess(
        { documentId, documentUrl },
        {
          title,
          hasContent: !!content,
        }
      );
    } catch (error) {
      return this.handleError(error, 'Docs create');
    }
  }

  private async updateDoc(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof DocsUpdateSchema._type>(
      DocsUpdateSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { documentId, requests } = validation.data;

      // Use Google Docs API to update document
      // This is a placeholder - actual implementation would use googleapis

      return this.createSuccess(
        { documentId, requestCount: requests.length },
        {
          documentId,
          operations: requests.length,
        }
      );
    } catch (error) {
      return this.handleError(error, 'Docs update');
    }
  }

  private async appendDoc(params: unknown): Promise<ToolResult> {
    try {
      const { documentId, text } = params as { documentId: string; text: string };

      if (!documentId || !text) {
        return this.createError('documentId and text are required');
      }

      // Use Google Docs API to append text
      // This is a placeholder - actual implementation would use googleapis

      return this.createSuccess(
        { documentId },
        {
          documentId,
          appendedLength: text.length,
        }
      );
    } catch (error) {
      return this.handleError(error, 'Docs append');
    }
  }

  private async exportDoc(params: unknown): Promise<ToolResult> {
    try {
      const { documentId, mimeType, outputPath } = params as {
        documentId: string;
        mimeType: string;
        outputPath: string;
      };

      if (!documentId || !mimeType || !outputPath) {
        return this.createError('documentId, mimeType, and outputPath are required');
      }

      // Use Google Docs API to export document
      // This is a placeholder - actual implementation would use googleapis
      const size = 1024; // placeholder

      return this.createSuccess(
        { filePath: outputPath, size },
        {
          documentId,
          mimeType,
          format: mimeType.split('/')[1],
        }
      );
    } catch (error) {
      return this.handleError(error, 'Docs export');
    }
  }

  private extractTextContent(document: DocsDocument): string {
    let text = '';
    for (const element of document.body.content) {
      if (element.paragraph) {
        for (const elem of element.paragraph.elements) {
          if (elem.textRun) {
            text += elem.textRun.content;
          }
        }
      }
    }
    return text;
  }
}
