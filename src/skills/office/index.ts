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

export class OfficeSkill extends BaseSkill {
  constructor() {
    super({
      id: 'office',
      name: 'Office Documents',
      description: 'PDF, Excel, Word, and PowerPoint file operations',
      version: '1.0.0',
      author: 'Nexus Team',
      enabled: true,
      requiresAuth: false,
      dependencies: ['pdf-lib', 'xlsx', 'docx', 'pptxgenjs'],
    });
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

      // Use pdf-lib or pdf-parse to extract text
      // This is a placeholder - actual implementation would use pdf-lib
      const text = 'Extracted PDF text content';
      const pageCount = 10;

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

      // Use pdf-lib to create PDF
      // This is a placeholder - actual implementation would use pdf-lib
      const pdfBuffer = Buffer.from('PDF content');
      writeFileSync(outputPath, pdfBuffer);

      return this.createSuccess(
        { filePath: outputPath, size: pdfBuffer.length },
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

      // Use xlsx to read Excel file
      // This is a placeholder - actual implementation would use xlsx
      const data: any[][] = [
        ['Header 1', 'Header 2', 'Header 3'],
        ['Data 1', 'Data 2', 'Data 3'],
        ['Data 4', 'Data 5', 'Data 6'],
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

      // Use xlsx to write Excel file
      // This is a placeholder - actual implementation would use xlsx
      const excelBuffer = Buffer.from('Excel content');
      writeFileSync(filePath, excelBuffer);

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

      // Use docx or mammoth to read Word file
      // This is a placeholder - actual implementation would use docx
      const text = 'Extracted Word document text';
      const paragraphCount = 5;

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

      // Use docx to create Word document
      // This is a placeholder - actual implementation would use docx
      const docBuffer = Buffer.from('Word document content');
      writeFileSync(outputPath, docBuffer);

      return this.createSuccess(
        { filePath: outputPath, size: docBuffer.length },
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

      // Use pptxgenjs or officegen to read PowerPoint
      // This is a placeholder - actual implementation would use pptxgenjs
      const slides = [
        { title: 'Slide 1', content: 'Content 1' },
        { title: 'Slide 2', content: 'Content 2' },
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

      // Use pptxgenjs to create PowerPoint presentation
      // This is a placeholder - actual implementation would use pptxgenjs
      const pptBuffer = Buffer.from('PowerPoint content');
      writeFileSync(outputPath, pptBuffer);

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
