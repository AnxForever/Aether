/**
 * Slack Manager
 *
 * Main entry point for Slack Bot integration
 * Coordinates OAuth, messages, commands, and actions
 */

import { EventEmitter } from 'eventemitter3';
import { App, LogLevel } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import {
  SlackManagerConfig,
  SlackManagerEvents,
  MessageEvent,
  SlashCommandPayload,
  ActionPayload,
} from './types';
import { OAuthHandler, MemoryInstallationStore } from './oauth-handler';
import { MessageHandler } from './message-handler';
import { CommandHandlerManager, ExampleCommands } from './command-handler';
import { ActionHandlerManager, ExampleActions } from './action-handler';

/**
 * Slack Manager
 *
 * Architecture:
 * - Bolt App (event handling)
 * - OAuth Handler (authorization)
 * - Message Handler (send/receive)
 * - Command Handler (slash commands)
 * - Action Handler (buttons/menus/modals)
 *
 * Features:
 * - Multi-workspace support
 * - Event-driven architecture (EventEmitter)
 * - Rate limiting & retry
 * - Error handling
 * - Type-safe API
 */
export class SlackManager extends EventEmitter<SlackManagerEvents> {
  private config: SlackManagerConfig;
  private app: App;
  private client: WebClient;
  private oauthHandler: OAuthHandler;
  private messageHandler: MessageHandler;
  private commandHandler: CommandHandlerManager;
  private actionHandler: ActionHandlerManager;
  private isInitialized: boolean = false;

  constructor(config: SlackManagerConfig) {
    super();
    this.config = {
      socketMode: false,
      port: 3000,
      logLevel: 'info',
      ...config,
    };

    // Initialize Bolt App
    this.app = new App({
      token: this.config.botToken,
      signingSecret: this.config.signingSecret,
      socketMode: this.config.socketMode,
      appToken: this.config.appToken,
      logLevel: this.mapLogLevel(this.config.logLevel),
      // Custom installation store
      installationStore: this.config.clientId
        ? {
            storeInstallation: async (installation: any) => {
              await this.oauthHandler.getStore().storeInstallation(installation as any);
            },
            fetchInstallation: async (query: any) => {
              return (await this.oauthHandler.getStore().fetchInstallation(query)) as any;
            },
            deleteInstallation: async (query: any) => {
              await this.oauthHandler.getStore().deleteInstallation(query);
            },
          }
        : undefined,
    });

    // Initialize Web Client
    this.client = new WebClient(this.config.botToken);

    // Initialize handlers
    this.oauthHandler = new OAuthHandler(this.config, new MemoryInstallationStore());
    this.messageHandler = new MessageHandler(this.client);
    this.commandHandler = new CommandHandlerManager(this.app);
    this.actionHandler = new ActionHandlerManager(this.app);

    // Wire up events
    this.setupEventListeners();
  }

  /**
   * Initialize Slack Manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Register default event handlers
      this.registerDefaultHandlers();

      // Register example commands (can be removed in production)
      this.registerExampleCommands();

      // Register example actions (can be removed in production)
      this.registerExampleActions();

      // Start Bolt App
      if (this.config.socketMode) {
        await this.app.start();
      } else {
        await this.app.start(this.config.port!);
      }

      this.isInitialized = true;
      this.emit('slack:ready');
    } catch (error) {
      this.emit('slack:error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Stop Slack Manager
   */
  async stop(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      await this.app.stop();
      this.isInitialized = false;
    } catch (error) {
      this.emit('slack:error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // OAuth events
    this.oauthHandler.on('oauth:success', (installation) => {
      this.emit('oauth:success', installation);
    });

    this.oauthHandler.on('oauth:error', (error) => {
      this.emit('oauth:error', error);
    });

    // Message events
    this.messageHandler.on('message:received', (event) => {
      this.emit('slack:message', event);
    });

    this.messageHandler.on('message:error', (error) => {
      this.emit('slack:error', error);
    });

    // Command events
    this.commandHandler.on('command:executed', (command, payload) => {
      // Optional: Add logging
    });

    this.commandHandler.on('command:error', (command, error) => {
      this.emit('slack:error', error);
    });

    // Action events
    this.actionHandler.on('action:executed', (actionId, payload) => {
      // Optional: Add logging
    });

    this.actionHandler.on('action:error', (actionId, error) => {
      this.emit('slack:error', error);
    });
  }

  /**
   * Register default event handlers
   */
  private registerDefaultHandlers(): void {
    // Handle message events
    this.app.message(async ({ message, say }: any) => {
      try {
        await this.messageHandler.handleMessage(message as MessageEvent);
      } catch (error) {
        this.emit('slack:error', error instanceof Error ? error : new Error(String(error)));
      }
    });

    // Handle app_mention events
    this.app.event('app_mention', async ({ event, say }: any) => {
      try {
        this.emit('slack:app_mention', event);
      } catch (error) {
        this.emit('slack:error', error instanceof Error ? error : new Error(String(error)));
      }
    });

    // Handle app_home_opened events
    this.app.event('app_home_opened', async ({ event, client }: any) => {
      try {
        // Publish home tab view
        await client.views.publish({
          user_id: event.user,
          view: {
            type: 'home',
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: '*Welcome to Aether Bot!* 🤖',
                },
              },
              {
                type: 'divider',
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: 'Use `/help` to see available commands.',
                },
              },
            ],
          },
        });
      } catch (error) {
        this.emit('slack:error', error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Register example commands
   */
  private registerExampleCommands(): void {
    this.commandHandler.registerHelpCommand();

    this.commandHandler.registerCommand('/ping', ExampleCommands.ping, {
      description: 'Ping the bot',
      usage: '/ping',
    });

    this.commandHandler.registerCommand('/echo', ExampleCommands.echo, {
      description: 'Echo your message',
      usage: '/echo <message>',
    });

    this.commandHandler.registerCommand('/status', ExampleCommands.status, {
      description: 'Show bot status',
      usage: '/status',
    });
  }

  /**
   * Register example actions
   */
  private registerExampleActions(): void {
    this.actionHandler.registerAction('approve_button', ExampleActions.approve, {
      description: 'Approve action',
    });

    this.actionHandler.registerAction('reject_button', ExampleActions.reject, {
      description: 'Reject action',
    });

    this.actionHandler.registerAction('delete_button', ExampleActions.delete, {
      description: 'Delete message',
    });
  }

  /**
   * Map log level to Bolt LogLevel
   */
  private mapLogLevel(level?: string): LogLevel {
    switch (level) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
        return LogLevel.INFO;
      case 'warn':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }

  /**
   * Get Bolt App instance (for advanced usage)
   */
  getApp(): App {
    return this.app;
  }

  /**
   * Get Web Client instance
   */
  getClient(): WebClient {
    return this.client;
  }

  /**
   * Get OAuth Handler
   */
  getOAuthHandler(): OAuthHandler {
    return this.oauthHandler;
  }

  /**
   * Get Message Handler
   */
  getMessageHandler(): MessageHandler {
    return this.messageHandler;
  }

  /**
   * Get Command Handler
   */
  getCommandHandler(): CommandHandlerManager {
    return this.commandHandler;
  }

  /**
   * Get Action Handler
   */
  getActionHandler(): ActionHandlerManager {
    return this.actionHandler;
  }

  /**
   * Check if Slack Manager is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Cleanup and remove all event listeners
   */
  destroy(): void {
    this.removeAllListeners();
    this.messageHandler.removeAllListeners();
    this.commandHandler.removeAllListeners();
    this.actionHandler.removeAllListeners();
    if (this.oauthHandler) {
      this.oauthHandler.removeAllListeners();
    }
  }
}
