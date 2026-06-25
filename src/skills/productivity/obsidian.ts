/**
 * Obsidian Skill - Integration with Obsidian vaults
 */

import { BaseSkill } from '../base-skill';
import { Tool, ToolResult } from '../../types';
import { SkillContext } from '../types';
import { readdir, readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { join, extname, basename } from 'path';

/**
 * Obsidian Skill
 */
export class ObsidianSkill extends BaseSkill {
  private vaultPath?: string;

  constructor() {
    super({
      id: 'obsidian',
      name: 'Obsidian',
      description: 'Integration with Obsidian vaults',
      version: '1.0.0',
      author: 'Nexus',
      enabled: true,
    });
  }

  /**
   * Initialize skill
   */
  async initialize(context: SkillContext): Promise<void> {
    this.vaultPath = context.env.OBSIDIAN_VAULT_PATH;
  }

  /**
   * Get tool definitions
   */
  getTools(): Tool[] {
    return [
      {
        name: 'obsidian_note_list',
        description: 'List all notes in the vault',
        parameters: [],
        handler: async (params) => this.executeTool('obsidian_note_list', params)
      },
      {
        name: 'obsidian_note_read',
        description: 'Read a note by filename',
        parameters: [],
        handler: async (params) => this.executeTool('obsidian_note_read', params)
      },
      {
        name: 'obsidian_note_create',
        description: 'Create a new note',
        parameters: [],
        handler: async (params) => this.executeTool('obsidian_note_create', params)
      },
      {
        name: 'obsidian_note_update',
        description: 'Update an existing note',
        parameters: [],
        handler: async (params) => this.executeTool('obsidian_note_update', params)
      },
      {
        name: 'obsidian_note_delete',
        description: 'Delete a note',
        parameters: [],
        handler: async (params) => this.executeTool('obsidian_note_delete', params)
      },
      {
        name: 'obsidian_search',
        description: 'Search notes by content',
        parameters: [],
        handler: async (params) => this.executeTool('obsidian_search', params)
      },
      {
        name: 'obsidian_backlinks',
        description: 'Find backlinks to a note',
        parameters: [],
        handler: async (params) => this.executeTool('obsidian_backlinks', params)
      }
    ];
  }

  /**
   * Check if skill is properly configured
   */
  async isConfigured(): Promise<boolean> {
    return !!this.vaultPath;
  }

  /**
   * Execute tool
   */
  async executeTool(toolName: string, parameters: any): Promise<ToolResult> {
    if (!this.vaultPath) {
      return {
        success: false,
        error: 'Obsidian vault path not configured'
      };
    }

    try {
      switch (toolName) {
        case 'obsidian_note_list':
          return await this.listNotes(parameters);
        case 'obsidian_note_read':
          return await this.readNote(parameters);
        case 'obsidian_note_create':
          return await this.createNote(parameters);
        case 'obsidian_note_update':
          return await this.updateNote(parameters);
        case 'obsidian_note_delete':
          return await this.deleteNote(parameters);
        case 'obsidian_search':
          return await this.searchNotes(parameters);
        case 'obsidian_backlinks':
          return await this.findBacklinks(parameters);
        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * List notes
   */
  private async listNotes(params: any): Promise<ToolResult> {
    const { folder } = params;
    const searchPath = folder ? join(this.vaultPath!, folder) : this.vaultPath!;

    const notes = await this.scanDirectory(searchPath);

    return {
      success: true,
      data: { notes, count: notes.length }
    };
  }

  /**
   * Scan directory recursively
   */
  private async scanDirectory(path: string): Promise<string[]> {
    const notes: string[] = [];
    const entries = await readdir(path, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(path, entry.name);

      if (entry.isDirectory()) {
        const subNotes = await this.scanDirectory(fullPath);
        notes.push(...subNotes);
      } else if (entry.isFile() && extname(entry.name) === '.md') {
        notes.push(fullPath.replace(this.vaultPath! + '/', ''));
      }
    }

    return notes;
  }

  /**
   * Read note
   */
  private async readNote(params: any): Promise<ToolResult> {
    let { filename } = params;

    if (!filename.endsWith('.md')) {
      filename += '.md';
    }

    const notePath = join(this.vaultPath!, filename);
    const content = await readFile(notePath, 'utf-8');

    // Extract frontmatter and links
    const { frontmatter, body, links } = this.parseMarkdown(content);

    return {
      success: true,
      data: { filename, content: body, frontmatter, links }
    };
  }

  /**
   * Create note
   */
  private async createNote(params: any): Promise<ToolResult> {
    let { filename, content, folder } = params;

    if (!filename.endsWith('.md')) {
      filename += '.md';
    }

    const notePath = folder
      ? join(this.vaultPath!, folder, filename)
      : join(this.vaultPath!, filename);

    // Ensure directory exists
    const dir = notePath.substring(0, notePath.lastIndexOf('/'));
    await mkdir(dir, { recursive: true });

    await writeFile(notePath, content, 'utf-8');

    return {
      success: true,
      data: { message: 'Note created successfully', path: notePath }
    };
  }

  /**
   * Update note
   */
  private async updateNote(params: any): Promise<ToolResult> {
    let { filename, content } = params;

    if (!filename.endsWith('.md')) {
      filename += '.md';
    }

    const notePath = join(this.vaultPath!, filename);
    await writeFile(notePath, content, 'utf-8');

    return {
      success: true,
      data: { message: 'Note updated successfully' }
    };
  }

  /**
   * Delete note
   */
  private async deleteNote(params: any): Promise<ToolResult> {
    let { filename } = params;

    if (!filename.endsWith('.md')) {
      filename += '.md';
    }

    const notePath = join(this.vaultPath!, filename);
    await unlink(notePath);

    return {
      success: true,
      data: { message: 'Note deleted successfully' }
    };
  }

  /**
   * Search notes
   */
  private async searchNotes(params: any): Promise<ToolResult> {
    const { query } = params;
    const allNotes = await this.scanDirectory(this.vaultPath!);
    const matches: any[] = [];

    for (const notePath of allNotes) {
      const fullPath = join(this.vaultPath!, notePath);
      const content = await readFile(fullPath, 'utf-8');

      if (content.toLowerCase().includes(query.toLowerCase())) {
        matches.push({
          filename: notePath,
          preview: this.getPreview(content, query)
        });
      }
    }

    return {
      success: true,
      data: { matches, count: matches.length }
    };
  }

  /**
   * Find backlinks
   */
  private async findBacklinks(params: any): Promise<ToolResult> {
    let { filename } = params;

    if (!filename.endsWith('.md')) {
      filename += '.md';
    }

    const noteTitle = basename(filename, '.md');
    const allNotes = await this.scanDirectory(this.vaultPath!);
    const backlinks: string[] = [];

    // Wikilink pattern: [[Note Title]]
    const linkPattern = new RegExp(`\\[\\[${noteTitle}(\\|[^\\]]+)?\\]\\]`, 'g');

    for (const notePath of allNotes) {
      if (notePath === filename) continue;

      const fullPath = join(this.vaultPath!, notePath);
      const content = await readFile(fullPath, 'utf-8');

      if (linkPattern.test(content)) {
        backlinks.push(notePath);
      }
    }

    return {
      success: true,
      data: { backlinks, count: backlinks.length }
    };
  }

  /**
   * Parse markdown
   */
  private parseMarkdown(content: string): any {
    let frontmatter: any = null;
    let body = content;
    const links: string[] = [];

    // Extract frontmatter
    if (content.startsWith('---')) {
      const endIndex = content.indexOf('---', 3);
      if (endIndex !== -1) {
        const frontmatterText = content.slice(4, endIndex);
        body = content.slice(endIndex + 3).trim();
        // Parse YAML (simplified)
        frontmatter = {};
      }
    }

    // Extract wikilinks
    const linkPattern = /\[\[([^\]]+)\]\]/g;
    let match;
    while ((match = linkPattern.exec(body)) !== null) {
      links.push(match[1]);
    }

    return { frontmatter, body, links };
  }

  /**
   * Get preview around query
   */
  private getPreview(content: string, query: string, length: number = 150): string {
    const index = content.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return content.slice(0, length);

    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + query.length + 100);

    return '...' + content.slice(start, end) + '...';
  }
}
