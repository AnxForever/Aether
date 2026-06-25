/**
 * Apple Notes Skill - Integration with macOS Notes.app
 */

import { BaseSkill } from '../base-skill';
import { Tool, ToolResult } from '../../types';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Note
 */
interface Note {
  id?: string;
  name: string;
  body: string;
  folder?: string;
}

/**
 * Apple Notes Skill
 */
export class AppleNotesSkill extends BaseSkill {
  constructor() {
    super({
      id: 'apple-notes',
      name: 'Apple Notes',
      description: 'Integration with macOS Notes.app',
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
        name: 'notes_list',
        description: 'List all notes or notes in a specific folder',
        parameters: [],
        handler: async (params) => this.executeTool('notes_list', params)
      },
      {
        name: 'notes_create',
        description: 'Create a new note',
        parameters: [],
        handler: async (params) => this.executeTool('notes_create', params)
      },
      {
        name: 'notes_read',
        description: 'Read a specific note',
        parameters: [],
        handler: async (params) => this.executeTool('notes_read', params)
      },
      {
        name: 'notes_update',
        description: 'Update an existing note',
        parameters: [],
        handler: async (params) => this.executeTool('notes_update', params)
      },
      {
        name: 'notes_delete',
        description: 'Delete a note',
        parameters: [],
        handler: async (params) => this.executeTool('notes_delete', params)
      },
      {
        name: 'notes_search',
        description: 'Search notes by keyword',
        parameters: [],
        handler: async (params) => this.executeTool('notes_search', params)
      }
    ];
  }

  /**
   * Check if skill is properly configured
   */
  async isConfigured(): Promise<boolean> {
    return process.platform === 'darwin';
  }

  /**
   * Execute tool
   */
  async executeTool(toolName: string, parameters: any): Promise<ToolResult> {
    if (process.platform !== 'darwin') {
      return {
        success: false,
        error: 'Apple Notes is only available on macOS'
      };
    }

    try {
      switch (toolName) {
        case 'notes_list':
          return await this.listNotes(parameters);
        case 'notes_create':
          return await this.createNote(parameters);
        case 'notes_read':
          return await this.readNote(parameters);
        case 'notes_update':
          return await this.updateNote(parameters);
        case 'notes_delete':
          return await this.deleteNote(parameters);
        case 'notes_search':
          return await this.searchNotes(parameters);
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
    const { folder, limit = 50 } = params;

    const script = `
      tell application "Notes"
        ${folder ? `set targetFolder to folder "${this.escapeString(folder)}"` : 'set targetFolder to default account'}

        set noteList to {}
        set noteCount to 0

        repeat with n in (every note of targetFolder)
          if noteCount ≥ ${limit} then exit repeat
          set end of noteList to {name:name of n, body:plaintext of n, creationDate:creation date of n, modificationDate:modification date of n}
          set noteCount to noteCount + 1
        end repeat

        return noteList
      end tell
    `;

    const { stdout } = await execFileAsync('osascript', ['-e', script]);
    const notes = this.parseOutput(stdout);

    return {
      success: true,
      data: { notes, count: notes.length }
    };
  }

  /**
   * Create note
   */
  private async createNote(params: Note): Promise<ToolResult> {
    const { name, body, folder } = params;

    const script = `
      tell application "Notes"
        ${folder ? `set targetFolder to folder "${this.escapeString(folder)}"` : 'set targetFolder to default account'}

        tell targetFolder
          make new note with properties {name:"${this.escapeString(name)}", body:"${this.escapeString(body)}"}
        end tell

        return "Note created successfully"
      end tell
    `;

    await execFileAsync('osascript', ['-e', script]);

    return {
      success: true,
      data: { message: 'Note created successfully' }
    };
  }

  /**
   * Read note
   */
  private async readNote(params: any): Promise<ToolResult> {
    const { name } = params;

    const script = `
      tell application "Notes"
        set targetNote to first note whose name is "${this.escapeString(name)}"
        return {name:name of targetNote, body:plaintext of targetNote, creationDate:creation date of targetNote, modificationDate:modification date of targetNote}
      end tell
    `;

    const { stdout } = await execFileAsync('osascript', ['-e', script]);
    const note = this.parseOutput(stdout);

    return {
      success: true,
      data: note
    };
  }

  /**
   * Update note
   */
  private async updateNote(params: any): Promise<ToolResult> {
    const { name, body } = params;

    const script = `
      tell application "Notes"
        set targetNote to first note whose name is "${this.escapeString(name)}"
        set body of targetNote to "${this.escapeString(body)}"
        return "Note updated successfully"
      end tell
    `;

    await execFileAsync('osascript', ['-e', script]);

    return {
      success: true,
      data: { message: 'Note updated successfully' }
    };
  }

  /**
   * Delete note
   */
  private async deleteNote(params: any): Promise<ToolResult> {
    const { name } = params;

    const script = `
      tell application "Notes"
        set targetNote to first note whose name is "${this.escapeString(name)}"
        delete targetNote
        return "Note deleted successfully"
      end tell
    `;

    await execFileAsync('osascript', ['-e', script]);

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

    const script = `
      tell application "Notes"
        set matchingNotes to {}

        repeat with n in (every note)
          if name of n contains "${this.escapeString(query)}" or plaintext of n contains "${this.escapeString(query)}" then
            set end of matchingNotes to {name:name of n, body:plaintext of n}
          end if
        end repeat

        return matchingNotes
      end tell
    `;

    const { stdout } = await execFileAsync('osascript', ['-e', script]);
    const notes = this.parseOutput(stdout);

    return {
      success: true,
      data: { notes, count: notes.length }
    };
  }

  /**
   * Escape string for AppleScript
   */
  private escapeString(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  /**
   * Parse AppleScript output
   */
  private parseOutput(output: string): any {
    try {
      return JSON.parse(output);
    } catch {
      return output.trim();
    }
  }
}
