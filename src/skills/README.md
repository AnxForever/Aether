# Aether Skills System

Complete skill system implementation for Aether with 6 core skills.

## Overview

The Aether skills system provides a modular, extensible architecture for adding capabilities to the agent. Each skill encapsulates related tools with proper validation, error handling, and authentication.

## Architecture

```
skills/
├── types.ts              # Type definitions and Zod schemas
├── base-skill.ts         # Abstract base class for all skills
├── skill-manager.ts      # Central skill management
├── index.ts              # Main exports
├── gmail/                # Gmail skill
├── sheets/               # Google Sheets skill
├── docs/                 # Google Docs skill
├── calendar/             # Google Calendar skill
├── github/               # GitHub skill
└── office/               # Office documents skill
```

## Core Skills

### 1. Gmail Skill

Email reading, sending, and management using Gmail API.

**Tools:**
- `gmail_search` - Search messages
- `gmail_send` - Send email
- `gmail_read` - Read specific message
- `gmail_mark_read` - Mark as read
- `gmail_delete` - Delete message

**Authentication:** Requires Google OAuth credentials

### 2. Google Sheets Skill

Spreadsheet reading, writing, and manipulation.

**Tools:**
- `sheets_read` - Read data from spreadsheet
- `sheets_write` - Write data to spreadsheet
- `sheets_append` - Append data to spreadsheet
- `sheets_create` - Create new spreadsheet
- `sheets_clear` - Clear range

**Authentication:** Requires Google OAuth credentials

### 3. Google Docs Skill

Document reading, creation, and editing.

**Tools:**
- `docs_read` - Read document content
- `docs_create` - Create new document
- `docs_update` - Update document with batch requests
- `docs_append` - Append text to document
- `docs_export` - Export to various formats

**Authentication:** Requires Google OAuth credentials

### 4. Google Calendar Skill

Calendar event management.

**Tools:**
- `calendar_list_events` - List events
- `calendar_create_event` - Create new event
- `calendar_update_event` - Update existing event
- `calendar_delete_event` - Delete event
- `calendar_get_event` - Get event details

**Authentication:** Requires Google OAuth credentials

### 5. GitHub Skill

Repository, issue, and PR management using GitHub CLI.

**Tools:**
- `github_repo_info` - Get repository information
- `github_create_issue` - Create new issue
- `github_list_issues` - List issues
- `github_create_pr` - Create pull request
- `github_search_repos` - Search repositories
- `github_clone_repo` - Clone repository

**Authentication:** Requires GitHub CLI (`gh`) authentication

### 6. Office Skill

PDF, Excel, Word, and PowerPoint operations.

**Tools:**
- `pdf_read` - Extract text from PDF
- `pdf_create` - Create PDF document
- `excel_read` - Read Excel data
- `excel_write` - Write Excel data
- `word_read` - Read Word document
- `word_create` - Create Word document
- `powerpoint_read` - Read PowerPoint slides
- `powerpoint_create` - Create PowerPoint presentation

**Authentication:** Not required

## Usage

### Basic Usage

```typescript
import { createSkillManager } from './skills';

// Create skill manager with context
const manager = createSkillManager({
  userId: 'user123',
  sessionId: 'session456',
  workingDir: '/home/user/projects',
  env: process.env,
});

// Initialize all skills
await manager.initializeAll();

// Get all available tools
const tools = manager.getAllTools();

// Execute a tool
const result = await manager.executeTool('gmail_search', {
  query: 'is:unread from:boss@company.com',
  maxResults: 10,
});

if (result.success) {
  console.log('Messages:', result.data);
} else {
  console.error('Error:', result.error);
}

// Cleanup when done
await manager.cleanupAll();
```

### Working with Individual Skills

```typescript
import { GmailSkill } from './skills';

const skill = new GmailSkill();

// Check if configured
const context = {
  userId: 'user123',
  sessionId: 'session456',
  workingDir: '/home/user',
  env: process.env,
};

const isConfigured = await skill.isConfigured(context);

if (isConfigured) {
  const tools = skill.getTools();
  // Use tools...
}
```

### Managing Skills

```typescript
// List all skills
const skillIds = manager.listSkillIds();

// Enable/disable skills
manager.disableSkill('gmail');
manager.enableSkill('gmail');

// Get skill metadata
const metadata = manager.getSkillMetadata('github');

// Search for tools
const searchResults = manager.searchTools('email');
```

## Environment Variables

### Google Skills (Gmail, Sheets, Docs, Calendar)

```bash
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REFRESH_TOKEN=your_refresh_token
```

### GitHub Skill

Requires GitHub CLI (`gh`) to be installed and authenticated:

```bash
gh auth login
```

### Office Skill

No authentication required. Works with local files.

## Validation

All tool parameters are validated using Zod schemas:

```typescript
// Example: Gmail send schema
const params = {
  to: 'recipient@example.com',
  subject: 'Hello',
  body: 'Message body',
};

// Validation happens automatically in the handler
const result = await manager.executeTool('gmail_send', params);
```

## Error Handling

All tools return a consistent result format:

```typescript
interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}
```

## Extending the System

### Creating a New Skill

1. Create a new directory under `skills/`
2. Extend `BaseSkill` class
3. Implement required methods
4. Add tool definitions with handlers
5. Register in `skill-manager.ts`

Example:

```typescript
import { BaseSkill } from '../base-skill';
import type { Tool, ToolResult } from '../../types';
import type { SkillContext } from '../types';

export class MyCustomSkill extends BaseSkill {
  constructor() {
    super({
      id: 'custom',
      name: 'Custom Skill',
      description: 'My custom skill',
      version: '1.0.0',
      author: 'Your Name',
      enabled: true,
    });
  }

  getTools(): Tool[] {
    return [
      {
        name: 'custom_action',
        description: 'Perform custom action',
        parameters: [
          {
            name: 'param1',
            type: 'string',
            description: 'Parameter description',
            required: true,
          },
        ],
        handler: async (params) => this.handleAction(params),
      },
    ];
  }

  async isConfigured(context: SkillContext): Promise<boolean> {
    return true; // Check if skill is properly configured
  }

  private async handleAction(params: unknown): Promise<ToolResult> {
    // Validate params
    // Perform action
    // Return result
    return this.createSuccess({ result: 'success' });
  }
}
```

## Testing

Each skill should have unit tests covering:
- Tool registration
- Parameter validation
- Success cases
- Error handling
- Authentication checks

## Dependencies

Core dependencies for skills:

```json
{
  "zod": "^3.23.0",
  "googleapis": "^140.0.0",
  "pdf-lib": "^1.17.1",
  "xlsx": "^0.18.5",
  "docx": "^8.5.0",
  "pptxgenjs": "^3.12.0"
}
```

## Performance Considerations

- Skills are initialized once and reused
- Tool handlers are async for non-blocking execution
- Parameter validation is fast (Zod schemas)
- Authentication checks are cached when possible

## Security

- All credentials stored in environment variables
- No secrets in code or version control
- OAuth tokens refreshed automatically
- File operations validated for path traversal
- Command injection prevention in GitHub skill

## Future Enhancements

- [ ] Slack integration skill
- [ ] Database query skill
- [ ] Web scraping skill
- [ ] Cloud storage skills (AWS S3, Google Drive)
- [ ] Email providers (Outlook, SendGrid)
- [ ] Project management (Jira, Linear)
- [ ] CRM integration (Salesforce, HubSpot)
- [ ] Analytics platforms (Google Analytics, Mixpanel)

## License

MIT
