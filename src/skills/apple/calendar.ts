/**
 * Apple Calendar Skill - Integration with macOS Calendar.app
 */

import { BaseSkill } from '../base-skill';
import { Tool, ToolResult } from '../../types';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Calendar event
 */
interface CalendarEvent {
  id?: string;
  title: string;
  startDate: string;
  endDate: string;
  location?: string;
  notes?: string;
  calendar?: string;
}

/**
 * Apple Calendar Skill
 */
export class AppleCalendarSkill extends BaseSkill {
  constructor() {
    super({
      id: 'apple-calendar',
      name: 'Apple Calendar',
      description: 'Integration with macOS Calendar.app',
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
        name: 'calendar_list_events',
        description: 'List calendar events within a date range',
        parameters: [],
        handler: async (params) => this.executeTool('calendar_list_events', params)
      },
      {
        name: 'calendar_create_event',
        description: 'Create a new calendar event',
        parameters: [],
        handler: async (params) => this.executeTool('calendar_create_event', params)
      },
      {
        name: 'calendar_delete_event',
        description: 'Delete a calendar event',
        parameters: [],
        handler: async (params) => this.executeTool('calendar_delete_event', params)
      },
      {
        name: 'calendar_search',
        description: 'Search calendar events by keyword',
        parameters: [],
        handler: async (params) => this.executeTool('calendar_search', params)
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
    // Check macOS platform
    if (process.platform !== 'darwin') {
      return {
        success: false,
        error: 'Apple Calendar is only available on macOS'
      };
    }

    try {
      switch (toolName) {
        case 'calendar_list_events':
          return await this.listEvents(parameters);
        case 'calendar_create_event':
          return await this.createEvent(parameters);
        case 'calendar_delete_event':
          return await this.deleteEvent(parameters);
        case 'calendar_search':
          return await this.searchEvents(parameters);
        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * List calendar events
   */
  private async listEvents(params: any): Promise<ToolResult> {
    const { startDate, endDate, calendar } = params;

    const script = `
      tell application "Calendar"
        set startDate to date "${startDate}"
        set endDate to date "${endDate}"
        ${calendar ? `set targetCalendar to calendar "${calendar}"` : 'set targetCalendar to default calendar'}

        set eventList to {}
        repeat with evt in (every event of targetCalendar whose start date ≥ startDate and start date ≤ endDate)
          set end of eventList to {summary:summary of evt, startDate:start date of evt, endDate:end date of evt, location:location of evt, description:description of evt}
        end repeat

        return eventList
      end tell
    `;

    const { stdout } = await execFileAsync('osascript', ['-e', script]);
    const events = this.parseAppleScriptOutput(stdout);

    return {
      success: true,
      data: events
    };
  }

  /**
   * Create calendar event
   */
  private async createEvent(params: CalendarEvent): Promise<ToolResult> {
    const { title, startDate, endDate, location, notes, calendar } = params;

    const script = `
      tell application "Calendar"
        ${calendar ? `set targetCalendar to calendar "${calendar}"` : 'set targetCalendar to default calendar'}

        tell targetCalendar
          set newEvent to make new event with properties {summary:"${this.escapeString(title)}", start date:date "${startDate}", end date:date "${endDate}"${location ? `, location:"${this.escapeString(location)}"` : ''}${notes ? `, description:"${this.escapeString(notes)}"` : ''}}
        end tell

        return "Event created successfully"
      end tell
    `;

    await execFileAsync('osascript', ['-e', script]);

    return {
      success: true,
      data: { message: 'Event created successfully' }
    };
  }

  /**
   * Delete calendar event
   */
  private async deleteEvent(params: any): Promise<ToolResult> {
    const { eventId } = params;

    const script = `
      tell application "Calendar"
        set targetEvent to first event whose summary is "${this.escapeString(eventId)}"
        delete targetEvent
        return "Event deleted successfully"
      end tell
    `;

    await execFileAsync('osascript', ['-e', script]);

    return {
      success: true,
      data: { message: 'Event deleted successfully' }
    };
  }

  /**
   * Search calendar events
   */
  private async searchEvents(params: any): Promise<ToolResult> {
    const { query } = params;

    const script = `
      tell application "Calendar"
        set matchingEvents to {}
        repeat with cal in calendars
          repeat with evt in (every event of cal)
            if summary of evt contains "${this.escapeString(query)}" or description of evt contains "${this.escapeString(query)}" then
              set end of matchingEvents to {summary:summary of evt, startDate:start date of evt, endDate:end date of evt}
            end if
          end repeat
        end repeat
        return matchingEvents
      end tell
    `;

    const { stdout } = await execFileAsync('osascript', ['-e', script]);
    const events = this.parseAppleScriptOutput(stdout);

    return {
      success: true,
      data: events
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
  private parseAppleScriptOutput(output: string): any {
    // Simple parsing - in production, use proper parser
    try {
      return JSON.parse(output);
    } catch {
      return output.trim();
    }
  }
}
