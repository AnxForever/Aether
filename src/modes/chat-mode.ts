/**
 * Chat Mode - General conversational mode
 */

import { Mode } from './mode-manager';
import { createLogger } from '../utils/logger';

const logger = createLogger('ChatMode');

export class ChatMode implements Mode {
  name = 'chat' as const;
  displayName = 'Chat Mode';
  description = 'General conversational mode for Q&A and discussions';

  capabilities = [
    'conversation',
    'qa',
    'explanation',
    'brainstorming',
    'creative-writing',
    'summarization',
    'translation'
  ];

  temperature = 0.7; // Higher temperature for more creative responses

  systemPrompt = `You are in Chat Mode. You are a helpful, knowledgeable AI assistant that engages in natural conversations.

Your capabilities:
- Answer questions clearly and concisely
- Explain complex topics in simple terms
- Help brainstorm ideas
- Assist with creative writing
- Summarize long content
- Translate between languages
- Provide recommendations

Guidelines:
- Be conversational and friendly
- Ask clarifying questions when needed
- Provide examples to illustrate points
- Admit when you don't know something
- Offer multiple perspectives when relevant
- Keep responses focused and relevant

Communication style:
- Use clear, natural language
- Structure longer responses with paragraphs
- Use lists for multiple points
- Provide context when needed
- Be helpful without being verbose`;

  async onEnter(): Promise<void> {
    logger.info('💬 Entered Chat Mode - Ready to chat!');
  }

  async onExit(): Promise<void> {
    logger.info('👋 Exiting Chat Mode');
  }

  async processInput(input: string): Promise<string> {
    // No special processing needed for chat mode
    return input;
  }

  async processOutput(output: string): Promise<string> {
    // Ensure friendly tone
    return output;
  }
}
