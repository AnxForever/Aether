/**
 * Google Sheets Skill
 *
 * Google Sheets reading, writing, and manipulation
 */

import { BaseSkill } from '../base-skill';
import type { Tool, ToolResult } from '../../types';
import type { SkillContext } from '../types';
import {
  SheetsReadSchema,
  SheetsWriteSchema,
  SheetsAppendSchema,
  SheetsCreateSchema,
} from '../types';

export class SheetsSkill extends BaseSkill {
  constructor() {
    super({
      id: 'sheets',
      name: 'Google Sheets',
      description: 'Google Sheets reading, writing, and data manipulation using Sheets API',
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
        name: 'sheets_read',
        description: 'Read data from a Google Sheets spreadsheet',
        parameters: [
          {
            name: 'spreadsheetId',
            type: 'string',
            description: 'The ID of the spreadsheet',
            required: true,
          },
          {
            name: 'range',
            type: 'string',
            description: 'The A1 notation range to read (e.g., "Sheet1!A1:D10")',
            required: true,
          },
          {
            name: 'valueRenderOption',
            type: 'string',
            description: 'How values should be rendered: FORMATTED_VALUE, UNFORMATTED_VALUE, or FORMULA',
            required: false,
          },
        ],
        handler: async (params) => this.readSheet(params),
      },
      {
        name: 'sheets_write',
        description: 'Write data to a Google Sheets spreadsheet',
        parameters: [
          {
            name: 'spreadsheetId',
            type: 'string',
            description: 'The ID of the spreadsheet',
            required: true,
          },
          {
            name: 'range',
            type: 'string',
            description: 'The A1 notation range to write (e.g., "Sheet1!A1")',
            required: true,
          },
          {
            name: 'values',
            type: 'array',
            description: 'The data to write as a 2D array',
            required: true,
          },
          {
            name: 'valueInputOption',
            type: 'string',
            description: 'How to interpret input: RAW or USER_ENTERED',
            required: false,
          },
        ],
        handler: async (params) => this.writeSheet(params),
      },
      {
        name: 'sheets_append',
        description: 'Append data to a Google Sheets spreadsheet',
        parameters: [
          {
            name: 'spreadsheetId',
            type: 'string',
            description: 'The ID of the spreadsheet',
            required: true,
          },
          {
            name: 'range',
            type: 'string',
            description: 'The A1 notation range for the table',
            required: true,
          },
          {
            name: 'values',
            type: 'array',
            description: 'The data to append as a 2D array',
            required: true,
          },
          {
            name: 'valueInputOption',
            type: 'string',
            description: 'How to interpret input: RAW or USER_ENTERED',
            required: false,
          },
        ],
        handler: async (params) => this.appendSheet(params),
      },
      {
        name: 'sheets_create',
        description: 'Create a new Google Sheets spreadsheet',
        parameters: [
          {
            name: 'title',
            type: 'string',
            description: 'The title of the new spreadsheet',
            required: true,
          },
          {
            name: 'sheets',
            type: 'array',
            description: 'Array of sheet configurations with title, rowCount, and columnCount',
            required: false,
          },
        ],
        handler: async (params) => this.createSheet(params),
      },
      {
        name: 'sheets_clear',
        description: 'Clear data from a range in a spreadsheet',
        parameters: [
          {
            name: 'spreadsheetId',
            type: 'string',
            description: 'The ID of the spreadsheet',
            required: true,
          },
          {
            name: 'range',
            type: 'string',
            description: 'The A1 notation range to clear',
            required: true,
          },
        ],
        handler: async (params) => this.clearSheet(params),
      },
    ];
  }

  async isConfigured(context: SkillContext): Promise<boolean> {
    // Check if Google Sheets API credentials are available
    return !!(
      context.env.GOOGLE_CLIENT_ID &&
      context.env.GOOGLE_CLIENT_SECRET &&
      context.env.GOOGLE_REFRESH_TOKEN
    );
  }

  private async readSheet(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof SheetsReadSchema._type>(
      SheetsReadSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { spreadsheetId, range, valueRenderOption = 'FORMATTED_VALUE' } = validation.data;

      // Use Google Sheets API to read data
      // This is a placeholder - actual implementation would use googleapis
      const values: any[][] = [
        ['Header 1', 'Header 2', 'Header 3'],
        ['Row 1 Col 1', 'Row 1 Col 2', 'Row 1 Col 3'],
        ['Row 2 Col 1', 'Row 2 Col 2', 'Row 2 Col 3'],
      ];

      return this.createSuccess(values, {
        spreadsheetId,
        range,
        rowCount: values.length,
        columnCount: values[0]?.length || 0,
      });
    } catch (error) {
      return this.handleError(error, 'Sheets read');
    }
  }

  private async writeSheet(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof SheetsWriteSchema._type>(
      SheetsWriteSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { spreadsheetId, range, values, valueInputOption = 'USER_ENTERED' } = validation.data;

      // Use Google Sheets API to write data
      // This is a placeholder - actual implementation would use googleapis
      const updatedCells = values.reduce((sum, row) => sum + row.length, 0);

      return this.createSuccess(
        { updatedCells },
        {
          spreadsheetId,
          range,
          rowCount: values.length,
          columnCount: values[0]?.length || 0,
        }
      );
    } catch (error) {
      return this.handleError(error, 'Sheets write');
    }
  }

  private async appendSheet(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof SheetsAppendSchema._type>(
      SheetsAppendSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { spreadsheetId, range, values, valueInputOption = 'USER_ENTERED' } = validation.data;

      // Use Google Sheets API to append data
      // This is a placeholder - actual implementation would use googleapis
      const updatedRange = `${range}!A${values.length + 1}`;

      return this.createSuccess(
        { updatedRange },
        {
          spreadsheetId,
          appendedRows: values.length,
        }
      );
    } catch (error) {
      return this.handleError(error, 'Sheets append');
    }
  }

  private async createSheet(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof SheetsCreateSchema._type>(
      SheetsCreateSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { title, sheets } = validation.data;

      // Use Google Sheets API to create spreadsheet
      // This is a placeholder - actual implementation would use googleapis
      const spreadsheetId = `sheet_${Date.now()}`;
      const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

      return this.createSuccess(
        { spreadsheetId, spreadsheetUrl },
        {
          title,
          sheetCount: sheets?.length || 1,
        }
      );
    } catch (error) {
      return this.handleError(error, 'Sheets create');
    }
  }

  private async clearSheet(params: unknown): Promise<ToolResult> {
    try {
      const { spreadsheetId, range } = params as { spreadsheetId: string; range: string };

      if (!spreadsheetId || !range) {
        return this.createError('spreadsheetId and range are required');
      }

      // Use Google Sheets API to clear range
      // This is a placeholder - actual implementation would use googleapis

      return this.createSuccess(undefined, { spreadsheetId, range, action: 'cleared' });
    } catch (error) {
      return this.handleError(error, 'Sheets clear');
    }
  }
}
