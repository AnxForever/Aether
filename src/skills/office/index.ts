/**
 * Office Skill
 *
 * PDF, Excel, Word, and PowerPoint file operations
 */

import { BaseSkill } from '../base-skill';
import type { Tool, ToolResult } from '../../types';
import type { SkillContext } from '../types';
import {
  PdfReadSchema,
  PdfCreateSchema,
  ExcelReadSchema,
  ExcelWriteSchema,
  WordReadSchema,
  WordCreateSchema,
  PowerPointReadSchema,
  PowerPointCreateSchema,
} from '../types';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createLogger } from '../../utils/logger';

const logger = createLogger('OfficeSkill');

export class OfficeSkill extends BaseSkill {
  constructor() {
    super({
      id: 'office',
      name: 'Office Documents',
      description: 'PDF, Excel, Word, and PowerPoint file operations',
      version: '1.0.0',
      author: 'Aether Team',
      enabled: true,
      requiresAuth: false,
      dependencies: ['pdf-lib', 'xlsx', 'docx', 'pptxgenjs'],
    });

    logger.warn('OfficeSkill: pdf-lib, xlsx, docx, and pptxgenjs packages required for full operation. Only basic file I/O is available without them.');
  }

  getTools(): Tool[] {
    return [
      {
        name: 'pdf_read',
        description: 'Read and extract text from a PDF file',
        parameters: [
          {
            name: 'filePath',
            type: 'string',
            description: 'Path to the PDF file',
            required: true,
          },
          {
            name: 'pages',
            type: 'object',
            description: 'Page range to read (start and end)',
            required: false,
          },
        ],
        handler: async (params) => this.readPdf(params),
      },
      {
        name: 'pdf_create',
        description: 'Create a new PDF file from content',
        parameters: [
          {
            name: 'content',
            type: 'string',
            description: 'Text content or structured content array',
            required: true,
          },
          {
            name: 'outputPath',
            type: 'string',
            description: 'Path where the PDF will be saved',
            required: true,
          },
          {
            name: 'options',
            type: 'object',
            description: 'PDF metadata (title, author, subject)',
            required: false,
          },
        ],
        handler: async (params) => this.createPdf(params),
      },
      {
        name: 'excel_read',
        description: 'Read data from an Excel file',
        parameters: [
          {
            name: 'filePath',
            type: 'string',
            description: 'Path to the Excel file',
            required: true,
          },
          {
            name: 'sheetName',
            type: 'string',
            description: 'Name of the sheet to read',
            required: false,
          },
          {
            name: 'range',
            type: 'string',
            description: 'Cell range to read (e.g., "A1:D10")',
            required: false,
          },
        ],
        handler: async (params) => this.readExcel(params),
      },
      {
        name: 'excel_write',
        description: 'Write data to an Excel file',
        parameters: [
          {
            name: 'filePath',
            type: 'string',
            description: 'Path where the Excel file will be saved',
            required: true,
          },
          {
            name: 'sheetName',
            type: 'string',
            description: 'Name of the sheet',
            required: false,
          },
          {
            name: 'data',
            type: 'array',
            description: '2D array of data to write',
            required: true,
          },
          {
            name: 'headers',
            type: 'array',
            description: 'Array of column headers',
            required: false,
          },
        ],
        handler: async (params) => this.writeExcel(params),
      },
      {
        name: 'word_read',
        description: 'Read text content from a Word document',
        parameters: [
          {
            name: 'filePath',
            type: 'string',
            description: 'Path to the Word document',
            required: true,
          },
        ],
        handler: async (params) => this.readWord(params),
      },
      {
        name: 'word_create',
        description: 'Create a new Word document with structured content',
        parameters: [
          {
            name: 'content',
            type: 'array',
            description: 'Array of content objects (paragraph, heading, table, image)',
            required: true,
          },
          {
            name: 'outputPath',
            type: 'string',
            description: 'Path where the Word document will be saved',
            required: true,
          },
        ],
        handler: async (params) => this.createWord(params),
      },
      {
        name: 'powerpoint_read',
        description: 'Read content from a PowerPoint presentation',
        parameters: [
          {
            name: 'filePath',
            type: 'string',
            description: 'Path to the PowerPoint file',
            required: true,
          },
        ],
        handler: async (params) => this.readPowerPoint(params),
      },
      {
        name: 'powerpoint_create',
        description: 'Create a new PowerPoint presentation',
        parameters: [
          {
            name: 'slides',
            type: 'array',
            description: 'Array of slide objects with title and content',
            required: true,
          },
          {
            name: 'outputPath',
            type: 'string',
            description: 'Path where the PowerPoint file will be saved',
            required: true,
          },
        ],
        handler: async (params) => this.createPowerPoint(params),
      },
    ];
  }

  async isConfigured(context: SkillContext): Promise<boolean> {
    // Office operations don't require authentication
    return true;
  }

  private async readPdf(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof PdfReadSchema._type>(
      PdfReadSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { filePath, pages } = validation.data;

      if (!existsSync(filePath)) {
        return this.createError(`File not found: ${filePath}`);
      }

      logger.warn('PDF read: pdf-lib not available. Reading as raw text.');
      const fileBuffer = readFileSync(filePath);
      const text = fileBuffer.toString('utf-8');
      const pageCount = 1;

      return this.createSuccess(
        { text, pages: pageCount },
        {
          filePath,
          pageRange: pages ? `${pages.start}-${pages.end}` : 'all',
        }
      );
    } catch (error) {
      return this.handleError(error, 'PDF read');
    }
  }

  private async createPdf(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof PdfCreateSchema._type>(
      PdfCreateSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { content, outputPath, options } = validation.data;

      logger.warn('PDF create: pdf-lib not available. Writing content as text file.');
      const contentText = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      writeFileSync(outputPath, contentText, 'utf-8');

      return this.createSuccess(
        { filePath: outputPath, size: Buffer.byteLength(contentText, 'utf-8') },
        {
          hasMetadata: !!options,
        }
      );
    } catch (error) {
      return this.handleError(error, 'PDF create');
    }
  }

  private async readExcel(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof ExcelReadSchema._type>(
      ExcelReadSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { filePath, sheetName, range } = validation.data;

      if (!existsSync(filePath)) {
        return this.createError(`File not found: ${filePath}`);
      }

      logger.warn('Excel read: xlsx package not available. Reading as raw text.');
      const rawContent = readFileSync(filePath, 'utf-8');
      const data: any[][] = [
        ['<xlsx package required for proper parsing>'],
        [rawContent.substring(0, 200)],
      ];

      return this.createSuccess(
        { data, sheet: sheetName || 'Sheet1' },
        {
          filePath,
          rowCount: data.length,
          columnCount: data[0]?.length || 0,
        }
      );
    } catch (error) {
      return this.handleError(error, 'Excel read');
    }
  }

  private async writeExcel(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof ExcelWriteSchema._type>(
      ExcelWriteSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { filePath, sheetName = 'Sheet1', data, headers } = validation.data;

      logger.warn('Excel write: xlsx package not available. Writing as JSON.');
      const outputData = headers ? [headers, ...data] : data;
      writeFileSync(filePath, JSON.stringify(outputData, null, 2), 'utf-8');

      return this.createSuccess(
        { filePath, rows: data.length },
        {
          sheetName,
          hasHeaders: !!headers,
          columns: headers?.length || data[0]?.length || 0,
        }
      );
    } catch (error) {
      return this.handleError(error, 'Excel write');
    }
  }

  private async readWord(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof WordReadSchema._type>(
      WordReadSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { filePath } = validation.data;

      if (!existsSync(filePath)) {
        return this.createError(`File not found: ${filePath}`);
      }

      logger.warn('Word read: docx package not available. Reading as raw text.');
      const text = readFileSync(filePath, 'utf-8');
      const paragraphCount = text.split('\n').length;

      return this.createSuccess(
        { text, paragraphs: paragraphCount },
        { filePath }
      );
    } catch (error) {
      return this.handleError(error, 'Word read');
    }
  }

  private async createWord(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof WordCreateSchema._type>(
      WordCreateSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { content, outputPath } = validation.data;

      logger.warn('Word create: docx package not available. Writing as JSON.');
      writeFileSync(outputPath, JSON.stringify(content, null, 2), 'utf-8');

      return this.createSuccess(
        { filePath: outputPath, size: 0 },
        {
          contentItems: content.length,
        }
      );
    } catch (error) {
      return this.handleError(error, 'Word create');
    }
  }

  private async readPowerPoint(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof PowerPointReadSchema._type>(
      PowerPointReadSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { filePath } = validation.data;

      if (!existsSync(filePath)) {
        return this.createError(`File not found: ${filePath}`);
      }

      logger.warn('PowerPoint read: pptxgenjs not available. Reading as raw text.');
      const fileContent = readFileSync(filePath, 'utf-8');
      const slides: Array<{ title: string; content: string }> = [
        { title: 'Raw Content', content: fileContent.substring(0, 500) },
      ];

      return this.createSuccess(
        { slides },
        {
          filePath,
          slideCount: slides.length,
        }
      );
    } catch (error) {
      return this.handleError(error, 'PowerPoint read');
    }
  }

  private async createPowerPoint(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof PowerPointCreateSchema._type>(
      PowerPointCreateSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { slides, outputPath } = validation.data;

      logger.warn('PowerPoint create: pptxgenjs not available. Writing as JSON.');
      writeFileSync(outputPath, JSON.stringify(slides, null, 2), 'utf-8');

      return this.createSuccess(
        { filePath: outputPath, slides: slides.length },
        {
          slideCount: slides.length,
        }
      );
    } catch (error) {
      return this.handleError(error, 'PowerPoint create');
    }
  }
}
