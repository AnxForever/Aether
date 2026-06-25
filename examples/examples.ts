/**
 * Nexus Skills Usage Examples
 *
 * Demonstrates how to use the skills system
 */

import {
  createSkillManager,
  getAvailableSkills,
  type SkillContext,
} from './index';

/**
 * Example 1: Basic Setup
 */
async function basicSetup() {
  // Create context
  const context: SkillContext = {
    userId: 'user123',
    sessionId: 'session456',
    workingDir: process.cwd(),
    env: process.env as Record<string, string>,
  };

  // Create skill manager
  const manager = createSkillManager(context);

  // Initialize all skills
  await manager.initializeAll();

  // Get all available tools
  const tools = manager.getAllTools();
  console.log(`Loaded ${tools.length} tools from ${manager.getSkillCount()} skills`);

  // Cleanup
  await manager.cleanupAll();
}

/**
 * Example 2: Gmail Operations
 */
async function gmailExample() {
  const context: SkillContext = {
    sessionId: 'session789',
    workingDir: process.cwd(),
    env: process.env as Record<string, string>,
  };

  const manager = createSkillManager(context);
  await manager.initializeAll();

  // Search for unread emails
  const searchResult = await manager.executeTool('gmail_search', {
    query: 'is:unread',
    maxResults: 5,
  });

  if (searchResult.success) {
    console.log('Unread messages:', searchResult.data);
  }

  // Send an email
  const sendResult = await manager.executeTool('gmail_send', {
    to: 'recipient@example.com',
    subject: 'Hello from Nexus',
    body: 'This is an automated message from Nexus Agent.',
  });

  if (sendResult.success) {
    console.log('Email sent:', sendResult.data);
  }

  await manager.cleanupAll();
}

/**
 * Example 3: Google Sheets Operations
 */
async function sheetsExample() {
  const context: SkillContext = {
    sessionId: 'session101',
    workingDir: process.cwd(),
    env: process.env as Record<string, string>,
  };

  const manager = createSkillManager(context);
  await manager.initializeAll();

  // Create a new spreadsheet
  const createResult = await manager.executeTool('sheets_create', {
    title: 'Nexus Data',
    sheets: [
      { title: 'Sheet1', rowCount: 1000, columnCount: 26 },
    ],
  });

  if (createResult.success) {
    const { spreadsheetId } = createResult.data;

    // Write data to the spreadsheet
    await manager.executeTool('sheets_write', {
      spreadsheetId,
      range: 'Sheet1!A1',
      values: [
        ['Name', 'Age', 'Email'],
        ['Alice', 30, 'alice@example.com'],
        ['Bob', 25, 'bob@example.com'],
      ],
    });

    // Read the data back
    const readResult = await manager.executeTool('sheets_read', {
      spreadsheetId,
      range: 'Sheet1!A1:C3',
    });

    console.log('Spreadsheet data:', readResult.data);
  }

  await manager.cleanupAll();
}

/**
 * Example 4: GitHub Operations
 */
async function githubExample() {
  const context: SkillContext = {
    sessionId: 'session202',
    workingDir: process.cwd(),
    env: process.env as Record<string, string>,
  };

  const manager = createSkillManager(context);
  await manager.initializeAll();

  // Search for repositories
  const searchResult = await manager.executeTool('github_search_repos', {
    query: 'ai agent',
    sort: 'stars',
    order: 'desc',
    per_page: 5,
  });

  if (searchResult.success) {
    console.log('Top AI Agent repos:', searchResult.data);
  }

  // Get repository info
  const repoResult = await manager.executeTool('github_repo_info', {
    owner: 'anthropics',
    repo: 'anthropic-sdk-typescript',
  });

  if (repoResult.success) {
    console.log('Repository info:', repoResult.data);
  }

  // List issues
  const issuesResult = await manager.executeTool('github_list_issues', {
    owner: 'anthropics',
    repo: 'anthropic-sdk-typescript',
    state: 'open',
    per_page: 10,
  });

  if (issuesResult.success) {
    console.log('Open issues:', issuesResult.data);
  }

  await manager.cleanupAll();
}

/**
 * Example 5: Office Documents
 */
async function officeExample() {
  const context: SkillContext = {
    sessionId: 'session303',
    workingDir: process.cwd(),
    env: process.env as Record<string, string>,
  };

  const manager = createSkillManager(context);
  await manager.initializeAll();

  // Create an Excel file
  await manager.executeTool('excel_write', {
    filePath: './output.xlsx',
    sheetName: 'Data',
    data: [
      ['Product', 'Price', 'Quantity'],
      ['Item A', 10.99, 5],
      ['Item B', 25.50, 3],
    ],
    headers: ['Product', 'Price', 'Quantity'],
  });

  // Read the Excel file
  const excelResult = await manager.executeTool('excel_read', {
    filePath: './output.xlsx',
    sheetName: 'Data',
  });

  console.log('Excel data:', excelResult.data);

  // Create a PDF
  await manager.executeTool('pdf_create', {
    content: 'This is a sample PDF document created by Nexus Agent.',
    outputPath: './output.pdf',
    options: {
      title: 'Sample Document',
      author: 'Nexus Agent',
    },
  });

  // Create a Word document
  await manager.executeTool('word_create', {
    content: [
      { type: 'heading', text: 'Document Title', level: 1 },
      { type: 'paragraph', text: 'This is a paragraph.' },
      { type: 'heading', text: 'Section 1', level: 2 },
      { type: 'paragraph', text: 'More content here.' },
    ],
    outputPath: './output.docx',
  });

  await manager.cleanupAll();
}

/**
 * Example 6: Calendar Operations
 */
async function calendarExample() {
  const context: SkillContext = {
    sessionId: 'session404',
    workingDir: process.cwd(),
    env: process.env as Record<string, string>,
  };

  const manager = createSkillManager(context);
  await manager.initializeAll();

  // List upcoming events
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const listResult = await manager.executeTool('calendar_list_events', {
    timeMin: now.toISOString(),
    timeMax: nextWeek.toISOString(),
    maxResults: 10,
  });

  if (listResult.success) {
    console.log('Upcoming events:', listResult.data);
  }

  // Create a new event
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const eventEnd = new Date(tomorrow.getTime() + 60 * 60 * 1000); // 1 hour later

  const createResult = await manager.executeTool('calendar_create_event', {
    summary: 'Team Meeting',
    description: 'Weekly sync meeting',
    location: 'Conference Room A',
    start: {
      dateTime: tomorrow.toISOString(),
      timeZone: 'America/Los_Angeles',
    },
    end: {
      dateTime: eventEnd.toISOString(),
      timeZone: 'America/Los_Angeles',
    },
    attendees: [
      { email: 'colleague@example.com', displayName: 'Colleague' },
    ],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 1440 }, // 1 day before
        { method: 'popup', minutes: 10 },   // 10 minutes before
      ],
    },
  });

  if (createResult.success) {
    console.log('Event created:', createResult.data);
  }

  await manager.cleanupAll();
}

/**
 * Example 7: Error Handling
 */
async function errorHandlingExample() {
  const context: SkillContext = {
    sessionId: 'session505',
    workingDir: process.cwd(),
    env: process.env as Record<string, string>,
  };

  const manager = createSkillManager(context);
  await manager.initializeAll();

  // Invalid tool name
  const result1 = await manager.executeTool('invalid_tool', {});
  if (!result1.success) {
    console.error('Error:', result1.error);
  }

  // Invalid parameters
  const result2 = await manager.executeTool('gmail_send', {
    to: 'invalid-email', // Invalid email
    subject: 'Test',
  });
  if (!result2.success) {
    console.error('Error:', result2.error);
  }

  await manager.cleanupAll();
}

/**
 * Example 8: Skill Management
 */
async function skillManagementExample() {
  const context: SkillContext = {
    sessionId: 'session606',
    workingDir: process.cwd(),
    env: process.env as Record<string, string>,
  };

  const manager = createSkillManager(context);

  // List all available skills
  const availableSkills = getAvailableSkills();
  console.log('Available skills:', availableSkills);

  // Get skill metadata
  const gmailMeta = manager.getSkillMetadata('gmail');
  console.log('Gmail skill:', gmailMeta);

  // Disable a skill
  manager.disableSkill('gmail');
  console.log('Gmail disabled:', !manager.getSkillMetadata('gmail')?.enabled);

  // Enable it back
  manager.enableSkill('gmail');
  console.log('Gmail enabled:', manager.getSkillMetadata('gmail')?.enabled);

  // Search for tools
  const emailTools = manager.searchTools('email');
  console.log('Email-related tools:', emailTools.map(t => t.name));

  // Get specific tool
  const tool = manager.getTool('gmail_send');
  console.log('Gmail send tool:', tool);

  // Check if tool exists
  const hasTool = manager.hasTool('gmail_send');
  console.log('Has gmail_send:', hasTool);
}

// Export all examples
export {
  basicSetup,
  gmailExample,
  sheetsExample,
  githubExample,
  officeExample,
  calendarExample,
  errorHandlingExample,
  skillManagementExample,
};
