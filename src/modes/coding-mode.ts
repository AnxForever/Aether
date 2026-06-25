/**
 * Coding Mode - Specialized mode for code generation and debugging
 */

import { Mode } from './mode-manager';
import { createLogger } from '../utils/logger';

const logger = createLogger('CodingMode');

export class CodingMode implements Mode {
  name = 'coding' as const;
  displayName = 'Coding Mode';
  description = 'Optimized for code generation, debugging, and technical assistance';

  capabilities = [
    'code-generation',
    'debugging',
    'refactoring',
    'testing',
    'documentation',
    'code-review',
    'performance-optimization'
  ];

  temperature = 0.2; // Lower temperature for more precise code

  systemPrompt = `You are in Coding Mode. You are a senior software engineer with expertise in multiple programming languages and best practices.

Your capabilities:
- Write clean, maintainable, and well-documented code
- Debug complex issues systematically
- Suggest optimal solutions with trade-offs
- Follow language-specific best practices
- Write comprehensive tests
- Optimize for performance and readability

Guidelines:
- Always include code comments explaining complex logic
- Suggest multiple approaches when applicable
- Consider edge cases and error handling
- Follow the DRY principle
- Write type-safe code when possible
- Include usage examples for functions/classes

Output format:
- Use markdown code blocks with language tags
- Explain your reasoning before code
- Include test cases when relevant
- Suggest next steps after implementation`;

  async onEnter(): Promise<void> {
    logger.info('🔧 Entered Coding Mode - Ready for technical tasks');
  }

  async onExit(): Promise<void> {
    logger.info('👋 Exiting Coding Mode');
  }

  async processInput(input: string): Promise<string> {
    // Add context markers for coding tasks
    if (!input.toLowerCase().includes('code') && !input.includes('```')) {
      return `[Coding Context] ${input}`;
    }
    return input;
  }

  async processOutput(output: string): Promise<string> {
    // Ensure code blocks are properly formatted
    return output;
  }
}
