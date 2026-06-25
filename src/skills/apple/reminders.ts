/**
 * Apple Reminders Skill - Integration with macOS Reminders.app
 */

import { BaseSkill } from '../base-skill';
import { Tool, ToolResult } from '../../types';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Reminder
 */
interface Reminder {
  name: string;
  notes?: string;
  dueDate?: string;
  priority?: number;
  list?: string;
}

/**
 * Apple Reminders Skill
 */
export class AppleRemindersSkill extends BaseSkill {
  constructor() {
    super({
      id: 'apple-reminders',
      name: 'Apple Reminders',
      description: 'Integration with macOS Reminders.app',
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
        name: 'reminders_list',
        description: 'List all reminders or reminders in a specific list',
        parameters: [],
        handler: async (params) => this.executeTool('reminders_list', params)
      },
      {
        name: 'reminders_create',
        description: 'Create a new reminder',
        parameters: [],
        handler: async (params) => this.executeTool('reminders_create', params)
      },
      {
        name: 'reminders_complete',
        description: 'Mark a reminder as completed',
        parameters: [],
        handler: async (params) => this.executeTool('reminders_complete', params)
      },
      {
        name: 'reminders_delete',
        description: 'Delete a reminder',
        parameters: [],
        handler: async (params) => this.executeTool('reminders_delete', params)
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
        error: 'Apple Reminders is only available on macOS'
      };
    }

    try {
      switch (toolName) {
        case 'reminders_list':
          return await this.listReminders(parameters);
        case 'reminders_create':
          return await this.createReminder(parameters);
        case 'reminders_complete':
          return await this.completeReminder(parameters);
        case 'reminders_delete':
          return await this.deleteReminder(parameters);
        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * List reminders
   */
  private async listReminders(params: any): Promise<ToolResult> {
    const { list, completed } = params;

    const script = `
      tell application "Reminders"
        ${list ? `set targetList to list "${this.escapeString(list)}"` : 'set targetList to default list'}

        set reminderList to {}

        repeat with r in (every reminder of targetList${completed !== undefined ? ` whose completed is ${completed}` : ''})
          set end of reminderList to {name:name of r, body:body of r, completed:completed of r, dueDate:due date of r, priority:priority of r}
        end repeat

        return reminderList
      end tell
    `;

    const { stdout } = await execFileAsync('osascript', ['-e', script]);
    const reminders = this.parseOutput(stdout);

    return {
      success: true,
      data: { reminders, count: reminders.length }
    };
  }

  /**
   * Create reminder
   */
  private async createReminder(params: Reminder): Promise<ToolResult> {
    const { name, notes, dueDate, priority, list } = params;

    const script = `
      tell application "Reminders"
        ${list ? `set targetList to list "${this.escapeString(list)}"` : 'set targetList to default list'}

        tell targetList
          set newReminder to make new reminder with properties {name:"${this.escapeString(name)}"${notes ? `, body:"${this.escapeString(notes)}"` : ''}${dueDate ? `, due date:date "${dueDate}"` : ''}${priority !== undefined ? `, priority:${priority}` : ''}}
        end tell

        return "Reminder created successfully"
      end tell
    `;

    await execFileAsync('osascript', ['-e', script]);

    return {
      success: true,
      data: { message: 'Reminder created successfully' }
    };
  }

  /**
   * Complete reminder
   */
  private async completeReminder(params: any): Promise<ToolResult> {
    const { name } = params;

    const script = `
      tell application "Reminders"
        set targetReminder to first reminder whose name is "${this.escapeString(name)}"
        set completed of targetReminder to true
        return "Reminder marked as completed"
      end tell
    `;

    await execFileAsync('osascript', ['-e', script]);

    return {
      success: true,
      data: { message: 'Reminder marked as completed' }
    };
  }

  /**
   * Delete reminder
   */
  private async deleteReminder(params: any): Promise<ToolResult> {
    const { name } = params;

    const script = `
      tell application "Reminders"
        set targetReminder to first reminder whose name is "${this.escapeString(name)}"
        delete targetReminder
        return "Reminder deleted successfully"
      end tell
    `;

    await execFileAsync('osascript', ['-e', script]);

    return {
      success: true,
      data: { message: 'Reminder deleted successfully' }
    };
  }

  /**
   * Escape string for AppleScript
   */
  private escapeString(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
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
