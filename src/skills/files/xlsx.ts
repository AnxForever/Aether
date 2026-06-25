/**
 * Excel (XLSX) Skill - Excel file processing
 */

import { BaseSkill } from '../base-skill';
import { Tool, ToolResult } from '../../types';
import * as XLSX from 'xlsx';
import { readFile, writeFile } from 'fs/promises';

/**
 * Excel Skill
 */
export class ExcelSkill extends BaseSkill {
  constructor() {
    super({
      id: 'xlsx',
      name: 'Excel Processing',
      description: 'Read and write Excel files',
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
        name: 'xlsx_read',
        description: 'Read data from Excel file',
        parameters: [],
        handler: async (params) => this.executeTool('xlsx_read', params)
      },
      {
        name: 'xlsx_write',
        description: 'Write data to Excel file',
        parameters: [],
        handler: async (params) => this.executeTool('xlsx_write', params)
      },
      {
        name: 'xlsx_sheets_list',
        description: 'List all sheets in Excel file',
        parameters: [],
        handler: async (params) => this.executeTool('xlsx_sheets_list', params)
      },
      {
        name: 'xlsx_append',
        description: 'Append rows to existing Excel file',
        parameters: [],
        handler: async (params) => this.executeTool('xlsx_append', params)
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
        case 'xlsx_read':
          return await this.readExcel(parameters);
        case 'xlsx_write':
          return await this.writeExcel(parameters);
        case 'xlsx_sheets_list':
          return await this.listSheets(parameters);
        case 'xlsx_append':
          return await this.appendExcel(parameters);
        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Read Excel file
   */
  private async readExcel(params: any): Promise<ToolResult> {
    const { filePath, sheetName, range } = params;

    const buffer = await readFile(filePath);
    const workbook = XLSX.read(buffer);

    const targetSheet = sheetName || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[targetSheet];

    if (!worksheet) {
      return {
        success: false,
        error: `Sheet "${targetSheet}" not found`
      };
    }

    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      range: range
    });

    return {
      success: true,
      data: {
        sheet: targetSheet,
        rows: data,
        rowCount: data.length
      }
    };
  }

  /**
   * Write Excel file
   */
  private async writeExcel(params: any): Promise<ToolResult> {
    const { filePath, data, sheetName = 'Sheet1' } = params;

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    await writeFile(filePath, buffer);

    return {
      success: true,
      data: {
        message: 'Excel file written successfully',
        path: filePath,
        rowCount: data.length
      }
    };
  }

  /**
   * List sheets
   */
  private async listSheets(params: any): Promise<ToolResult> {
    const { filePath } = params;

    const buffer = await readFile(filePath);
    const workbook = XLSX.read(buffer);

    return {
      success: true,
      data: {
        sheets: workbook.SheetNames,
        count: workbook.SheetNames.length
      }
    };
  }

  /**
   * Append to Excel file
   */
  private async appendExcel(params: any): Promise<ToolResult> {
    const { filePath, data, sheetName } = params;

    const buffer = await readFile(filePath);
    const workbook = XLSX.read(buffer);

    const targetSheet = sheetName || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[targetSheet];

    if (!worksheet) {
      return {
        success: false,
        error: `Sheet "${targetSheet}" not found`
      };
    }

    // Get existing data
    const existingData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Append new data
    const newData = [...existingData, ...data];

    // Create new worksheet
    const newWorksheet = XLSX.utils.aoa_to_sheet(newData);
    workbook.Sheets[targetSheet] = newWorksheet;

    // Write back
    const outputBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    await writeFile(filePath, outputBuffer);

    return {
      success: true,
      data: {
        message: 'Rows appended successfully',
        newRowCount: newData.length
      }
    };
  }
}
