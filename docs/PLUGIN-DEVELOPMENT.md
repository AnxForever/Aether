# Plugin Development Guide

> Complete guide to creating plugins for Nexus Agent

## Table of Contents

- [Overview](#overview)
- [Plugin Structure](#plugin-structure)
- [Manifest Format](#manifest-format)
- [Creating Your First Plugin](#creating-your-first-plugin)
- [Plugin API](#plugin-api)
- [Tools & Capabilities](#tools--capabilities)
- [Security & Permissions](#security--permissions)
- [Testing](#testing)
- [Publishing](#publishing)
- [Best Practices](#best-practices)

---

## Overview

Nexus plugins extend the agent's capabilities by adding new tools, skills, and integrations. Plugins are:

- **Hot-reloadable**: Load/unload without restarting
- **Isolated**: Run in separate contexts with permission controls
- **Discoverable**: Published to the plugin marketplace
- **Versioned**: Follow semantic versioning

### What Can Plugins Do?

- Add new tools (e.g., GitHub integration, email sender)
- Extend AI capabilities (e.g., specialized prompts)
- Integrate external services (e.g., Slack, Notion)
- Provide custom workflows (e.g., code review, deployment)

---

## Plugin Structure

```
my-plugin/
├── manifest.json          # Plugin metadata (required)
├── index.ts               # Main entry point (required)
├── tools.ts               # Tool implementations
├── README.md              # Plugin documentation
├── package.json           # Dependencies (optional)
└── __tests__/
    └── index.test.ts      # Unit tests
```

### Minimal Plugin

```typescript
// index.ts
export function initialize(api) {
  api.log.info('My plugin initialized!');
}

export function cleanup() {
  // Cleanup logic
}

export const tools = [
  {
    name: 'my_tool',
    description: 'Does something useful',
    parameters: [
      {
        name: 'input',
        type: 'string',
        description: 'Input text',
        required: true
      }
    ],
    handler: async (params) => {
      return {
        success: true,
        data: `Processed: ${params.input}`
      };
    }
  }
];
```

---

## Manifest Format

### Required Fields

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A brief description of what this plugin does",
  "author": "Your Name <email@example.com>",
  "license": "MIT"
}
```

### Full Manifest Example

```json
{
  "id": "github-integration",
  "name": "GitHub Integration",
  "version": "1.2.3",
  "description": "Integrate with GitHub API for repository management",
  "author": "Nexus Team <team@nexus.dev>",
  "homepage": "https://github.com/nexus/plugin-github",
  "repository": "https://github.com/nexus/plugin-github",
  "license": "MIT",
  "main": "index.js",
  "keywords": ["github", "git", "version-control"],
  
  "permissions": [
    "network:https",
    "storage:local"
  ],
  
  "capabilities": [
    "repository-management",
    "issue-tracking",
    "pull-requests"
  ],
  
  "dependencies": {
    "@octokit/rest": "^19.0.0",
    "axios": "^1.0.0"
  }
}
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✓ | Unique plugin identifier (lowercase, hyphens only) |
| `name` | string | ✓ | Human-readable plugin name |
| `version` | string | ✓ | Semantic version (e.g., 1.0.0) |
| `description` | string | ✓ | Brief description (max 200 chars) |
| `author` | string | ✓ | Author name and email |
| `license` | string | ✓ | License identifier (e.g., MIT, Apache-2.0) |
| `main` | string | | Entry point file (default: index.js) |
| `homepage` | string | | Plugin homepage URL |
| `repository` | string | | Source code repository URL |
| `keywords` | string[] | | Search keywords |
| `permissions` | string[] | | Required permissions (see below) |
| `capabilities` | string[] | | Plugin capabilities |
| `dependencies` | object | | npm dependencies |

---

## Creating Your First Plugin

### Step 1: Initialize Plugin Directory

```bash
mkdir my-plugin
cd my-plugin
npm init -y
```

### Step 2: Create Manifest

```bash
cat > manifest.json << 'EOF'
{
  "id": "my-plugin",
  "name": "My First Plugin",
  "version": "1.0.0",
  "description": "My first Nexus plugin",
  "author": "Your Name",
  "license": "MIT"
}
EOF
```

### Step 3: Implement Plugin

```typescript
// index.ts
import { PluginAPI, Tool, ToolResult } from '@nexus/types';

/**
 * Initialize plugin
 */
export function initialize(api: PluginAPI): void {
  const info = api.getPluginInfo();
  api.log.info(`${info.name} v${info.version} initialized`);
  
  // Register hooks
  api.registerHook('before-message', async (message) => {
    api.log.debug('Message received:', message);
  });
}

/**
 * Cleanup plugin
 */
export function cleanup(): void {
  // Cleanup resources
}

/**
 * Plugin tools
 */
export const tools: Tool[] = [
  {
    name: 'greet',
    description: 'Greet a user',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'User name',
        required: true
      }
    ],
    handler: async (params): Promise<ToolResult> => {
      return {
        success: true,
        data: `Hello, ${params.name}!`
      };
    }
  }
];
```

### Step 4: Test Locally

```bash
# Build TypeScript
npm run build

# Copy to plugins directory
cp -r . ~/.nexus/plugins/my-plugin/
```

### Step 5: Load in Nexus

```typescript
import { NexusAgent } from '@nexus/agent';

const agent = new NexusAgent({
  pluginsDir: './plugins'
});

await agent.initialize();
await agent.loadPlugin('my-plugin');

// Use the plugin
const result = await agent.chat('Use the greet tool with name "Alice"');
console.log(result);
```

---

## Plugin API

### PluginAPI Interface

When your plugin's `initialize()` function is called, it receives a PluginAPI object:

```typescript
interface PluginAPI {
  // Plugin information
  getPluginInfo(): {
    id: string;
    name: string;
    version: string;
  };
  
  // Hook registration
  registerHook(hookName: string, callback: Function): void;
  
  // Logging
  log: {
    debug(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
  };
}
```

### Available Hooks

| Hook Name | Description | Parameters |
|-----------|-------------|------------|
| `before-message` | Before processing user message | `(message: Message)` |
| `after-message` | After generating response | `(message: Message, response: Message)` |
| `before-tool-call` | Before executing a tool | `(toolName: string, params: any)` |
| `after-tool-call` | After tool execution | `(toolName: string, result: ToolResult)` |
| `session-start` | New session started | `(sessionId: string)` |
| `session-end` | Session ended | `(sessionId: string)` |

### Example: Using Hooks

```typescript
export function initialize(api: PluginAPI): void {
  // Log all tool calls
  api.registerHook('before-tool-call', async (toolName, params) => {
    api.log.info(`Tool called: ${toolName}`, params);
  });
  
  // Enhance responses
  api.registerHook('after-message', async (message, response) => {
    if (response.content.includes('error')) {
      api.log.warn('Error detected in response');
    }
  });
}
```

---

## Tools & Capabilities

### Tool Definition

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  handler: ToolHandler;
}

interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  schema?: Record<string, any>; // For complex types
}

type ToolHandler = (params: Record<string, any>) => Promise<ToolResult>;

interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}
```

### Example: File Reader Tool

```typescript
export const tools: Tool[] = [
  {
    name: 'read_file',
    description: 'Read content from a file',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'File path',
        required: true
      },
      {
        name: 'encoding',
        type: 'string',
        description: 'File encoding',
        required: false
      }
    ],
    handler: async (params): Promise<ToolResult> => {
      try {
        const fs = require('fs').promises;
        const content = await fs.readFile(
          params.path,
          params.encoding || 'utf-8'
        );
        
        return {
          success: true,
          data: content,
          metadata: {
            size: content.length,
            path: params.path
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }
  }
];
```

### Example: HTTP Request Tool

```typescript
import axios from 'axios';

export const tools: Tool[] = [
  {
    name: 'http_get',
    description: 'Make HTTP GET request',
    parameters: [
      {
        name: 'url',
        type: 'string',
        description: 'URL to fetch',
        required: true
      },
      {
        name: 'headers',
        type: 'object',
        description: 'HTTP headers',
        required: false,
        schema: {
          type: 'object',
          additionalProperties: { type: 'string' }
        }
      }
    ],
    handler: async (params): Promise<ToolResult> => {
      try {
        const response = await axios.get(params.url, {
          headers: params.headers
        });
        
        return {
          success: true,
          data: response.data,
          metadata: {
            status: response.status,
            headers: response.headers
          }
        };
      } catch (error) {
        return {
          success: false,
          error: `HTTP request failed: ${error.message}`
        };
      }
    }
  }
];
```

---

## Security & Permissions

### Permission System

Plugins must declare required permissions in `manifest.json`:

```json
{
  "permissions": [
    "network:https",
    "filesystem:read",
    "storage:local"
  ]
}
```

### Available Permissions

| Permission | Description |
|------------|-------------|
| `network:http` | Make HTTP requests |
| `network:https` | Make HTTPS requests |
| `filesystem:read` | Read files from disk |
| `filesystem:write` | Write files to disk |
| `storage:local` | Access local storage |
| `clipboard:read` | Read from clipboard |
| `clipboard:write` | Write to clipboard |
| `notifications` | Show system notifications |
| `system:info` | Access system information |

### Security Validation

All plugins are automatically scanned for:

- **Code injection** (eval, Function constructor)
- **System access** (child_process, spawn)
- **Undeclared permissions** (filesystem/network without permissions)
- **Obfuscated code** (base64 strings, minified code)

### Security Best Practices

✅ **DO:**
- Declare all required permissions
- Validate user inputs
- Use try-catch for error handling
- Sanitize external data
- Use environment variables for secrets

❌ **DON'T:**
- Use `eval()` or `Function()`
- Access filesystem without permissions
- Store secrets in code
- Make undeclared network requests
- Execute arbitrary user code

---

## Testing

### Test Structure

```typescript
// __tests__/index.test.ts
import { describe, it, expect } from 'vitest';
import { tools } from '../index';

describe('MyPlugin', () => {
  describe('greet tool', () => {
    it('should greet user by name', async () => {
      const greetTool = tools.find(t => t.name === 'greet');
      expect(greetTool).toBeDefined();
      
      const result = await greetTool!.handler({ name: 'Alice' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('Hello, Alice!');
    });
    
    it('should handle empty name', async () => {
      const greetTool = tools.find(t => t.name === 'greet');
      const result = await greetTool!.handler({ name: '' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('Hello, !');
    });
  });
});
```

### Running Tests

```bash
# Install test framework
npm install --save-dev vitest

# Run tests
npm test

# Run with coverage
npm test -- --coverage
```

---

## Publishing

### Prerequisites

1. Plugin tested locally
2. All tests passing
3. README.md with usage examples
4. Valid manifest.json
5. Semantic version bump

### Publish to Marketplace

```bash
# Login to marketplace
nexus-cli login

# Publish plugin
nexus-cli publish ./my-plugin

# Update existing plugin
nexus-cli publish ./my-plugin --version 1.1.0
```

### Versioning Guidelines

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features (backward compatible)
- **PATCH** (1.0.0 → 1.0.1): Bug fixes

---

## Best Practices

### Code Quality

✅ Write clear, descriptive tool names and descriptions
✅ Use TypeScript for type safety
✅ Handle errors gracefully
✅ Log important events
✅ Write unit tests (aim for 80%+ coverage)

### Performance

✅ Lazy-load heavy dependencies
✅ Cache expensive computations
✅ Use async/await for I/O operations
✅ Avoid blocking the event loop

### User Experience

✅ Provide helpful error messages
✅ Include usage examples in README
✅ Document all tool parameters
✅ Return structured data from tools

### Example: Well-Structured Plugin

```typescript
// calculator-plugin/index.ts
import { PluginAPI, Tool, ToolResult } from '@nexus/types';

const PLUGIN_VERSION = '1.0.0';

export function initialize(api: PluginAPI): void {
  api.log.info(`Calculator Plugin v${PLUGIN_VERSION} loaded`);
}

export function cleanup(): void {
  // No cleanup needed
}

/**
 * Calculate tool - Perform mathematical operations
 */
const calculateTool: Tool = {
  name: 'calculate',
  description: 'Perform basic mathematical operations (add, subtract, multiply, divide)',
  parameters: [
    {
      name: 'operation',
      type: 'string',
      description: 'Operation to perform: add, subtract, multiply, divide',
      required: true
    },
    {
      name: 'a',
      type: 'number',
      description: 'First number',
      required: true
    },
    {
      name: 'b',
      type: 'number',
      description: 'Second number',
      required: true
    }
  ],
  handler: async (params): Promise<ToolResult> => {
    const { operation, a, b } = params;
    
    // Validate inputs
    if (typeof a !== 'number' || typeof b !== 'number') {
      return {
        success: false,
        error: 'Both a and b must be numbers'
      };
    }
    
    // Perform calculation
    let result: number;
    try {
      switch (operation.toLowerCase()) {
        case 'add':
          result = a + b;
          break;
        case 'subtract':
          result = a - b;
          break;
        case 'multiply':
          result = a * b;
          break;
        case 'divide':
          if (b === 0) {
            return {
              success: false,
              error: 'Cannot divide by zero'
            };
          }
          result = a / b;
          break;
        default:
          return {
            success: false,
            error: `Unknown operation: ${operation}`
          };
      }
      
      return {
        success: true,
        data: result,
        metadata: {
          operation,
          operands: { a, b }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};

export const tools: Tool[] = [calculateTool];
```

---

## Resources

- **Example Plugins**: `/plugins/example-plugin/`
- **API Reference**: `/docs/API.md`
- **Type Definitions**: `@nexus/types`
- **Plugin Marketplace**: https://plugins.nexus.dev
- **Community Discord**: https://discord.gg/nexus

---

## Support

- **Issues**: https://github.com/nexus/agent/issues
- **Discussions**: https://github.com/nexus/agent/discussions
- **Email**: plugins@nexus.dev

---

**Happy Plugin Development! 🚀**
