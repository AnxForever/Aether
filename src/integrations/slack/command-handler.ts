/**
 * Slack Command Handler
 *
 * Handles Slash Commands registration and processing
 */

import { EventEmitter } from 'eventemitter3';
import { App } from '@slack/bolt';
import { SlashCommandPayload, CommandHandler } from './types';

/**
 * Command Registration
 */
interface CommandRegistration {
  command: string;
  handler: CommandHandler;
  description?: string;
  usage?: string;
}

/**
 * Command Handler
 *
 * Features:
 * - Dynamic command registration
 * - Command routing
 * - Response helpers (ephemeral, in_channel)
 * - Error handling
 * - Command help/list
 */
export class CommandHandlerManager extends EventEmitter {
  private app: App;
  private commands: Map<string, CommandRegistration> = new Map();

  constructor(app: App) {
    super();
    this.app = app;
  }

  /**
   * Register a slash command
   */
  registerCommand(
    command: string,
    handler: CommandHandler,
    options?: {
      description?: string;
      usage?: string;
    }
  ): void {
    // Ensure command starts with /
    const normalizedCommand = command.startsWith('/') ? command : `/${command}`;

    const registration: CommandRegistration = {
      command: normalizedCommand,
      handler,
      description: options?.description,
      usage: options?.usage,
    };

    this.commands.set(normalizedCommand, registration);

    // Register with Bolt
    this.app.command(normalizedCommand, async ({ command, ack, respond }: any) => {
      try {
        // Acknowledge command immediately
        await ack();

        // Build payload
        const payload: SlashCommandPayload = {
          command: command.command,
          text: command.text,
          response_url: command.response_url,
          trigger_id: command.trigger_id,
          user_id: command.user_id,
          user_name: command.user_name,
          team_id: command.team_id,
          team_domain: command.team_domain,
          channel_id: command.channel_id,
          channel_name: command.channel_name,
          api_app_id: command.api_app_id,
        };

        // Execute handler
        await handler(payload, respond);

        this.emit('command:executed', normalizedCommand, payload);
      } catch (error) {
        this.emit('command:error', normalizedCommand, error);

        // Send error response
        await respond({
          text: `❌ Error executing command: ${error instanceof Error ? error.message : 'Unknown error'}`,
          response_type: 'ephemeral',
        });
      }
    });
  }

  /**
   * Register built-in help command
   */
  registerHelpCommand(): void {
    this.registerCommand(
      '/help',
      async (payload, respond) => {
        const commandList = Array.from(this.commands.values())
          .map((reg) => {
            let text = `• ${reg.command}`;
            if (reg.description) {
              text += ` - ${reg.description}`;
            }
            if (reg.usage) {
              text += `\n  Usage: \`${reg.usage}\``;
            }
            return text;
          })
          .join('\n\n');

        await respond({
          text: '📚 Available Commands',
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: '📚 Available Commands',
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: commandList || 'No commands registered.',
              },
            },
          ],
          response_type: 'ephemeral',
        });
      },
      {
        description: 'Show available commands',
        usage: '/help',
      }
    );
  }

  /**
   * Unregister a command
   */
  unregisterCommand(command: string): boolean {
    const normalizedCommand = command.startsWith('/') ? command : `/${command}`;
    return this.commands.delete(normalizedCommand);
  }

  /**
   * Get all registered commands
   */
  getCommands(): CommandRegistration[] {
    return Array.from(this.commands.values());
  }

  /**
   * Check if command exists
   */
  hasCommand(command: string): boolean {
    const normalizedCommand = command.startsWith('/') ? command : `/${command}`;
    return this.commands.has(normalizedCommand);
  }

  /**
   * Helper: Send ephemeral response (only visible to user)
   */
  static createEphemeralResponse(text: string): any {
    return {
      text,
      response_type: 'ephemeral',
    };
  }

  /**
   * Helper: Send in_channel response (visible to all)
   */
  static createInChannelResponse(text: string): any {
    return {
      text,
      response_type: 'in_channel',
    };
  }

  /**
   * Helper: Create rich command response
   */
  static createRichResponse(
    title: string,
    description: string,
    options?: {
      ephemeral?: boolean;
      fields?: Array<{ title: string; value: string }>;
      color?: string;
    }
  ): any {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: title,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: description,
        },
      },
    ];

    if (options?.fields && options.fields.length > 0) {
      blocks.push({
        type: 'divider',
      } as any);

      options.fields.forEach((field) => {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${field.title}*\n${field.value}`,
          },
        } as any);
      });
    }

    return {
      text: title,
      blocks,
      response_type: options?.ephemeral ? 'ephemeral' : 'in_channel',
    };
  }

  /**
   * Helper: Create loading response
   */
  static createLoadingResponse(message: string = 'Processing...'): any {
    return {
      text: message,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `⏳ ${message}`,
          },
        },
      ],
      response_type: 'ephemeral',
    };
  }

  /**
   * Helper: Create success response
   */
  static createSuccessResponse(message: string, details?: string): any {
    return {
      text: message,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `✅ ${message}${details ? `\n${details}` : ''}`,
          },
        },
      ],
      response_type: 'ephemeral',
    };
  }

  /**
   * Helper: Create error response
   */
  static createErrorResponse(message: string, details?: string): any {
    return {
      text: message,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `❌ ${message}${details ? `\n\`\`\`${details}\`\`\`` : ''}`,
          },
        },
      ],
      response_type: 'ephemeral',
    };
  }
}

/**
 * Example command handlers
 */
export class ExampleCommands {
  /**
   * Echo command - repeat user's text
   */
  static echo: CommandHandler = async (payload, respond) => {
    const text = payload.text.trim();
    if (!text) {
      await respond(
        CommandHandlerManager.createEphemeralResponse(
          'Usage: /echo <message>'
        )
      );
      return;
    }

    await respond(
      CommandHandlerManager.createInChannelResponse(`Echo: ${text}`)
    );
  };

  /**
   * Status command - show bot status
   */
  static status: CommandHandler = async (payload, respond) => {
    await respond(
      CommandHandlerManager.createRichResponse(
        '🤖 Bot Status',
        'The bot is running and healthy!',
        {
          ephemeral: true,
          fields: [
            { title: 'Uptime', value: `${process.uptime().toFixed(0)}s` },
            { title: 'Memory', value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB` },
            { title: 'Node Version', value: process.version },
          ],
        }
      )
    );
  };

  /**
   * Ping command - simple health check
   */
  static ping: CommandHandler = async (payload, respond) => {
    await respond(
      CommandHandlerManager.createSuccessResponse('Pong! 🏓')
    );
  };
}
