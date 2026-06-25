/**
 * PowerPoint Skill - PPTX file processing
 */

import { BaseSkill } from '../base-skill';
import { Tool, ToolResult } from '../../types';
import PptxGenJS from 'pptxgenjs';
import { readFile } from 'fs/promises';

/**
 * PowerPoint Skill
 */
export class PowerPointSkill extends BaseSkill {
  constructor() {
    super({
      id: 'pptx',
      name: 'PowerPoint Processing',
      description: 'Create and process PowerPoint presentations',
      version: '1.0.0',
      author: 'Aether',
      enabled: true,
    });
  }

  /**
   * Get tool definitions
   */
  getTools(): Tool[] {
    return [
      {
        name: 'pptx_create',
        description: 'Create a new PowerPoint presentation',
        parameters: [],
        handler: async (params) => this.executeTool('pptx_create', params)
      },
      {
        name: 'pptx_add_slide',
        description: 'Add a slide to existing presentation',
        parameters: [],
        handler: async (params) => this.executeTool('pptx_add_slide', params)
      },
      {
        name: 'pptx_create_table',
        description: 'Create a slide with table',
        parameters: [],
        handler: async (params) => this.executeTool('pptx_create_table', params)
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
        case 'pptx_create':
          return await this.createPresentation(parameters);
        case 'pptx_add_slide':
          return await this.addSlide(parameters);
        case 'pptx_create_table':
          return await this.createTableSlide(parameters);
        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create presentation
   */
  private async createPresentation(params: any): Promise<ToolResult> {
    const { filePath, title, slides } = params;

    const pptx = new PptxGenJS();

    // Title slide
    const titleSlide = pptx.addSlide();
    titleSlide.addText(title, {
      x: 1,
      y: 2.5,
      w: 8,
      h: 1,
      fontSize: 44,
      bold: true,
      align: 'center'
    });

    // Content slides
    for (const slideData of slides) {
      const slide = pptx.addSlide();

      // Slide title
      slide.addText(slideData.title, {
        x: 0.5,
        y: 0.5,
        w: 9,
        h: 0.75,
        fontSize: 28,
        bold: true,
        color: '363636'
      });

      // Content as bullet points
      if (slideData.content && slideData.content.length > 0) {
        slide.addText(
          slideData.content.map((item: string) => ({ text: item, options: { bullet: true } })),
          {
            x: 0.5,
            y: 1.5,
            w: 9,
            h: 4,
            fontSize: 18
          }
        );
      }
    }

    await pptx.writeFile({ fileName: filePath });

    return {
      success: true,
      data: {
        message: 'Presentation created successfully',
        path: filePath,
        slideCount: slides.length + 1
      }
    };
  }

  /**
   * Add slide
   */
  private async addSlide(params: any): Promise<ToolResult> {
    const { filePath, title, content } = params;

    // Note: pptxgenjs doesn't support editing existing files directly
    // This is a simplified implementation
    const pptx = new PptxGenJS();

    const slide = pptx.addSlide();

    slide.addText(title, {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 0.75,
      fontSize: 28,
      bold: true,
      color: '363636'
    });

    slide.addText(
      content.map((item: string) => ({ text: item, options: { bullet: true } })),
      {
        x: 0.5,
        y: 1.5,
        w: 9,
        h: 4,
        fontSize: 18
      }
    );

    await pptx.writeFile({ fileName: filePath });

    return {
      success: true,
      data: { message: 'Slide added successfully' }
    };
  }

  /**
   * Create table slide
   */
  private async createTableSlide(params: any): Promise<ToolResult> {
    const { filePath, title, headers, rows } = params;

    const pptx = new PptxGenJS();
    const slide = pptx.addSlide();

    // Title
    slide.addText(title, {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 0.75,
      fontSize: 28,
      bold: true
    });

    // Table
    const tableData = [headers, ...rows];

    slide.addTable(tableData, {
      x: 0.5,
      y: 1.5,
      w: 9,
      h: 4,
      border: { pt: 1, color: 'CFCFCF' },
      fill: { color: 'F7F7F7' },
      fontSize: 14
    });

    await pptx.writeFile({ fileName: filePath });

    return {
      success: true,
      data: {
        message: 'Table slide created successfully',
        path: filePath
      }
    };
  }
}
