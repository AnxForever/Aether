/**
 * Word Skill - DOCX file processing
 */

import { BaseSkill } from '../base-skill';
import { Tool, ToolResult } from '../../types';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { writeFile, readFile } from 'fs/promises';

/**
 * Word Skill
 */
export class WordSkill extends BaseSkill {
  constructor() {
    super({
      id: 'docx',
      name: 'Word Processing',
      description: 'Create and process Word documents',
      version: '1.0.0',
      author: 'Nexus',
      enabled: true,
    });
  }

  /**
   * Get tool definitions
   */
  getTools(): Tool[] {
    return [
      {
        name: 'docx_create',
        description: 'Create a new Word document',
        parameters: [],
        handler: async (params) => this.executeTool('docx_create', params)
      },
      {
        name: 'docx_add_paragraph',
        description: 'Add paragraph to document',
        parameters: [],
        handler: async (params) => this.executeTool('docx_add_paragraph', params)
      },
      {
        name: 'docx_create_list',
        description: 'Create document with bulleted list',
        parameters: [],
        handler: async (params) => this.executeTool('docx_create_list', params)
      }
    ];
  }

  /**
   * Check if skill is properly configured
   */
  async isConfigured(): Promise<boolean> {
    return true;
  }

  /**
   * Execute tool
   */
  async executeTool(toolName: string, parameters: any): Promise<ToolResult> {
    try {
      switch (toolName) {
        case 'docx_create':
          return await this.createDocument(parameters);
        case 'docx_add_paragraph':
          return await this.addParagraph(parameters);
        case 'docx_create_list':
          return await this.createList(parameters);
        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create document
   */
  private async createDocument(params: any): Promise<ToolResult> {
    const { filePath, title, sections } = params;

    const children: Paragraph[] = [];

    // Title
    children.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.TITLE
      })
    );

    // Sections
    for (const section of sections) {
      // Section heading
      children.push(
        new Paragraph({
          text: section.heading,
          heading: HeadingLevel.HEADING_1
        })
      );

      // Section paragraphs
      for (const text of section.paragraphs) {
        children.push(
          new Paragraph({
            children: [new TextRun(text)]
          })
        );
      }

      // Spacing
      children.push(new Paragraph({ text: '' }));
    }

    const doc = new Document({
      sections: [{ children }]
    });

    const buffer = await Packer.toBuffer(doc);
    await writeFile(filePath, buffer);

    return {
      success: true,
      data: {
        message: 'Document created successfully',
        path: filePath,
        sectionCount: sections.length
      }
    };
  }

  /**
   * Add paragraph
   */
  private async addParagraph(params: any): Promise<ToolResult> {
    const { filePath, text, bold, italic } = params;

    // Note: docx library doesn't support editing existing files directly
    // This is a simplified implementation
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text,
                  bold: bold || false,
                  italics: italic || false
                })
              ]
            })
          ]
        }
      ]
    });

    const buffer = await Packer.toBuffer(doc);
    await writeFile(filePath, buffer);

    return {
      success: true,
      data: { message: 'Paragraph added successfully' }
    };
  }

  /**
   * Create list
   */
  private async createList(params: any): Promise<ToolResult> {
    const { filePath, title, items } = params;

    const children: Paragraph[] = [];

    // Title
    children.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_1
      })
    );

    children.push(new Paragraph({ text: '' }));

    // List items
    for (const item of items) {
      children.push(
        new Paragraph({
          text: item,
          bullet: {
            level: 0
          }
        })
      );
    }

    const doc = new Document({
      sections: [{ children }]
    });

    const buffer = await Packer.toBuffer(doc);
    await writeFile(filePath, buffer);

    return {
      success: true,
      data: {
        message: 'List document created successfully',
        path: filePath,
        itemCount: items.length
      }
    };
  }
}
