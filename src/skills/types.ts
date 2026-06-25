/**
 * Skill System Types
 *
 * Extended skill-specific types for Nexus Agent
 */

import { z } from 'zod';
import type { Tool, ToolResult, Skill } from '../types';

// ============================================================================
// Base Skill Infrastructure
// ============================================================================

export interface SkillConfig {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  enabled: boolean;
  requiresAuth?: boolean;
  dependencies?: string[];
  // i18n support
  nameKey?: string; // e.g., 'skills:gmail.name'
  descriptionKey?: string; // e.g., 'skills:gmail.description'
}

export interface SkillContext {
  userId?: string;
  sessionId: string;
  workingDir: string;
  env: Record<string, string>;
}

export type SkillHandler<TInput = any, TOutput = any> = (
  input: TInput,
  context: SkillContext
) => Promise<ToolResult>;

// ============================================================================
// Gmail Skill Types
// ============================================================================

export const GmailSearchSchema = z.object({
  query: z.string().describe('Gmail search query (e.g., "from:user@example.com is:unread")'),
  maxResults: z.number().min(1).max(100).default(10).optional(),
});

export const GmailSendSchema = z.object({
  to: z.string().email().or(z.array(z.string().email())),
  subject: z.string().min(1),
  body: z.string(),
  cc: z.string().email().or(z.array(z.string().email())).optional(),
  bcc: z.string().email().or(z.array(z.string().email())).optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    path: z.string(),
    contentType: z.string().optional(),
  })).optional(),
});

export const GmailReadSchema = z.object({
  messageId: z.string().describe('Gmail message ID'),
  format: z.enum(['full', 'metadata', 'minimal']).default('full').optional(),
});

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  date: string;
  labels: string[];
  attachments?: Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
  }>;
}

// ============================================================================
// Google Sheets Skill Types
// ============================================================================

export const SheetsReadSchema = z.object({
  spreadsheetId: z.string(),
  range: z.string().describe('A1 notation (e.g., "Sheet1!A1:D10")'),
  valueRenderOption: z.enum(['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA']).default('FORMATTED_VALUE').optional(),
});

export const SheetsWriteSchema = z.object({
  spreadsheetId: z.string(),
  range: z.string().describe('A1 notation (e.g., "Sheet1!A1")'),
  values: z.array(z.array(z.any())),
  valueInputOption: z.enum(['RAW', 'USER_ENTERED']).default('USER_ENTERED').optional(),
});

export const SheetsAppendSchema = z.object({
  spreadsheetId: z.string(),
  range: z.string().describe('A1 notation for the table range'),
  values: z.array(z.array(z.any())),
  valueInputOption: z.enum(['RAW', 'USER_ENTERED']).default('USER_ENTERED').optional(),
});

export const SheetsCreateSchema = z.object({
  title: z.string(),
  sheets: z.array(z.object({
    title: z.string(),
    rowCount: z.number().default(1000).optional(),
    columnCount: z.number().default(26).optional(),
  })).optional(),
});

// ============================================================================
// Google Docs Skill Types
// ============================================================================

export const DocsReadSchema = z.object({
  documentId: z.string(),
});

export const DocsCreateSchema = z.object({
  title: z.string(),
  content: z.string().optional(),
});

export const DocsUpdateSchema = z.object({
  documentId: z.string(),
  requests: z.array(z.object({
    insertText: z.object({
      location: z.object({
        index: z.number(),
      }),
      text: z.string(),
    }).optional(),
    deleteContentRange: z.object({
      range: z.object({
        startIndex: z.number(),
        endIndex: z.number(),
      }),
    }).optional(),
  })),
});

export interface DocsDocument {
  documentId: string;
  title: string;
  body: {
    content: Array<{
      paragraph?: {
        elements: Array<{
          textRun?: {
            content: string;
          };
        }>;
      };
    }>;
  };
}

// ============================================================================
// Calendar Skill Types
// ============================================================================

export const CalendarListEventsSchema = z.object({
  calendarId: z.string().default('primary').optional(),
  timeMin: z.string().datetime().optional(),
  timeMax: z.string().datetime().optional(),
  maxResults: z.number().min(1).max(250).default(10).optional(),
  query: z.string().optional(),
});

export const CalendarCreateEventSchema = z.object({
  calendarId: z.string().default('primary').optional(),
  summary: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
  start: z.object({
    dateTime: z.string().datetime(),
    timeZone: z.string().optional(),
  }),
  end: z.object({
    dateTime: z.string().datetime(),
    timeZone: z.string().optional(),
  }),
  attendees: z.array(z.object({
    email: z.string().email(),
    displayName: z.string().optional(),
  })).optional(),
  reminders: z.object({
    useDefault: z.boolean(),
    overrides: z.array(z.object({
      method: z.enum(['email', 'popup']),
      minutes: z.number(),
    })).optional(),
  }).optional(),
});

export const CalendarUpdateEventSchema = z.object({
  calendarId: z.string().default('primary').optional(),
  eventId: z.string(),
  summary: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  start: z.object({
    dateTime: z.string().datetime(),
    timeZone: z.string().optional(),
  }).optional(),
  end: z.object({
    dateTime: z.string().datetime(),
    timeZone: z.string().optional(),
  }).optional(),
});

export const CalendarDeleteEventSchema = z.object({
  calendarId: z.string().default('primary').optional(),
  eventId: z.string(),
});

// ============================================================================
// GitHub Skill Types
// ============================================================================

export const GitHubRepoInfoSchema = z.object({
  owner: z.string(),
  repo: z.string(),
});

export const GitHubCreateIssueSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  title: z.string(),
  body: z.string().optional(),
  labels: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional(),
});

export const GitHubListIssuesSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  state: z.enum(['open', 'closed', 'all']).default('open').optional(),
  labels: z.string().optional(),
  per_page: z.number().min(1).max(100).default(30).optional(),
});

export const GitHubCreatePRSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  title: z.string(),
  body: z.string().optional(),
  head: z.string().describe('The name of the branch where your changes are implemented'),
  base: z.string().describe('The name of the branch you want the changes pulled into'),
  draft: z.boolean().default(false).optional(),
});

export const GitHubSearchReposSchema = z.object({
  query: z.string(),
  sort: z.enum(['stars', 'forks', 'updated']).optional(),
  order: z.enum(['asc', 'desc']).default('desc').optional(),
  per_page: z.number().min(1).max(100).default(30).optional(),
});

// ============================================================================
// Office Skill Types
// ============================================================================

export const PdfReadSchema = z.object({
  filePath: z.string(),
  pages: z.object({
    start: z.number().min(1).optional(),
    end: z.number().min(1).optional(),
  }).optional(),
});

export const PdfCreateSchema = z.object({
  content: z.string().or(z.array(z.object({
    type: z.enum(['text', 'image']),
    content: z.string(),
    options: z.record(z.any()).optional(),
  }))),
  outputPath: z.string(),
  options: z.object({
    title: z.string().optional(),
    author: z.string().optional(),
    subject: z.string().optional(),
  }).optional(),
});

export const ExcelReadSchema = z.object({
  filePath: z.string(),
  sheetName: z.string().optional(),
  range: z.string().optional(),
});

export const ExcelWriteSchema = z.object({
  filePath: z.string(),
  sheetName: z.string().default('Sheet1').optional(),
  data: z.array(z.array(z.any())),
  headers: z.array(z.string()).optional(),
});

export const WordReadSchema = z.object({
  filePath: z.string(),
});

export const WordCreateSchema = z.object({
  content: z.array(z.object({
    type: z.enum(['paragraph', 'heading', 'table', 'image']),
    text: z.string().optional(),
    level: z.number().min(1).max(6).optional(), // for headings
    data: z.any().optional(), // for tables/images
  })),
  outputPath: z.string(),
});

export const PowerPointReadSchema = z.object({
  filePath: z.string(),
});

export const PowerPointCreateSchema = z.object({
  slides: z.array(z.object({
    title: z.string().optional(),
    content: z.array(z.object({
      type: z.enum(['text', 'bullet', 'image', 'chart']),
      content: z.string().or(z.any()),
    })),
  })),
  outputPath: z.string(),
});
