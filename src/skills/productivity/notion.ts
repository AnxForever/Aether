/**
 * Notion Skill - Integration with Notion API
 */

import { BaseSkill } from '../base-skill';
import { Tool, ToolResult } from '../../types';
import { SkillContext } from '../types';
import { Client } from '@notionhq/client';

/**
 * Notion Skill
 */
export class NotionSkill extends BaseSkill {
  private client?: Client;

  constructor() {
    super({
      id: 'notion',
      name: 'Notion',
      description: 'Integration with Notion API',
      version: '1.0.0',
      author: 'Nexus',
      enabled: true,
    });
  }

  /**
   * Initialize skill
   */
  async initialize(context: SkillContext): Promise<void> {
    const apiKey = context.env.NOTION_API_KEY;
    if (apiKey) {
      this.client = new Client({ auth: apiKey });
    }
  }

  /**
   * Get tool definitions
   */
  getTools(): Tool[] {
    return [
      {
        name: 'notion_search',
        description: 'Search Notion pages and databases',
        parameters: [],
        handler: async (params) => this.executeTool('notion_search', params)
      },
      {
        name: 'notion_page_get',
        description: 'Get page content by ID',
        parameters: [],
        handler: async (params) => this.executeTool('notion_page_get', params)
      },
      {
        name: 'notion_page_create',
        description: 'Create a new page',
        parameters: [],
        handler: async (params) => this.executeTool('notion_page_create', params)
      },
      {
        name: 'notion_page_update',
        description: 'Update an existing page',
        parameters: [],
        handler: async (params) => this.executeTool('notion_page_update', params)
      },
      {
        name: 'notion_database_query',
        description: 'Query a Notion database',
        parameters: [],
        handler: async (params) => this.executeTool('notion_database_query', params)
      },
      {
        name: 'notion_database_create_item',
        description: 'Create a new database item',
        parameters: [],
        handler: async (params) => this.executeTool('notion_database_create_item', params)
      }
    ];
  }

  /**
   * Check if skill is properly configured
   */
  async isConfigured(): Promise<boolean> {
    return !!this.client;
  }

  /**
   * Execute tool
   */
  async executeTool(toolName: string, parameters: any): Promise<ToolResult> {
    if (!this.client) {
      return {
        success: false,
        error: 'Notion client not initialized. Please provide API key.'
      };
    }

    try {
      switch (toolName) {
        case 'notion_search':
          return await this.search(parameters);
        case 'notion_page_get':
          return await this.getPage(parameters);
        case 'notion_page_create':
          return await this.createPage(parameters);
        case 'notion_page_update':
          return await this.updatePage(parameters);
        case 'notion_database_query':
          return await this.queryDatabase(parameters);
        case 'notion_database_create_item':
          return await this.createDatabaseItem(parameters);
        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Search Notion
   */
  private async search(params: any): Promise<ToolResult> {
    const { query, filter } = params;

    const response = await this.client!.search({
      query,
      filter: filter ? { property: 'object', value: filter } : undefined
    });

    return {
      success: true,
      data: response.results
    };
  }

  /**
   * Get page
   */
  private async getPage(params: any): Promise<ToolResult> {
    const { pageId } = params;

    const page = await this.client!.pages.retrieve({ page_id: pageId });
    const blocks = await this.client!.blocks.children.list({ block_id: pageId });

    return {
      success: true,
      data: { page, blocks: blocks.results }
    };
  }

  /**
   * Create page
   */
  private async createPage(params: any): Promise<ToolResult> {
    const { parentId, title, content } = params;

    const response = await this.client!.pages.create({
      parent: { page_id: parentId },
      properties: {
        title: {
          title: [{ text: { content: title } }]
        }
      },
      children: content ? this.markdownToBlocks(content) : []
    });

    return {
      success: true,
      data: response
    };
  }

  /**
   * Update page
   */
  private async updatePage(params: any): Promise<ToolResult> {
    const { pageId, title, archived } = params;

    const updates: any = {};

    if (title) {
      updates.properties = {
        title: {
          title: [{ text: { content: title } }]
        }
      };
    }

    if (archived !== undefined) {
      updates.archived = archived;
    }

    const response = await this.client!.pages.update({
      page_id: pageId,
      ...updates
    });

    return {
      success: true,
      data: response
    };
  }

  /**
   * Query database
   */
  private async queryDatabase(params: any): Promise<ToolResult> {
    const { databaseId, filter, sorts } = params;

    const response = await (this.client! as any).databases.query({
      database_id: databaseId,
      filter,
      sorts
    });

    return {
      success: true,
      data: response.results
    };
  }

  /**
   * Create database item
   */
  private async createDatabaseItem(params: any): Promise<ToolResult> {
    const { databaseId, properties } = params;

    const response = await this.client!.pages.create({
      parent: { database_id: databaseId },
      properties
    });

    return {
      success: true,
      data: response
    };
  }

  /**
   * Convert markdown to Notion blocks (simplified)
   */
  private markdownToBlocks(markdown: string): any[] {
    const lines = markdown.split('\n');
    const blocks: any[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      // Heading
      if (line.startsWith('# ')) {
        blocks.push({
          object: 'block',
          type: 'heading_1',
          heading_1: { rich_text: [{ text: { content: line.slice(2) } }] }
        });
      } else if (line.startsWith('## ')) {
        blocks.push({
          object: 'block',
          type: 'heading_2',
          heading_2: { rich_text: [{ text: { content: line.slice(3) } }] }
        });
      } else {
        // Paragraph
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: { rich_text: [{ text: { content: line } }] }
        });
      }
    }

    return blocks;
  }
}
