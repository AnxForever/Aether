/**
 * Slack Integration Types
 *
 * TypeScript types for Slack Bot integration
 */

import { EventEmitter } from 'events';
import { App, SlackEventMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { WebClient, ChatPostMessageArguments, FilesUploadV2Arguments } from '@slack/web-api';

/**
 * Slack Manager Configuration
 */
export interface SlackManagerConfig {
  botToken: string;
  signingSecret: string;
  appToken?: string;
  clientId?: string;
  clientSecret?: string;
  stateSecret?: string;
  redirectUri?: string;
  scopes?: string[];
  socketMode?: boolean;
  port?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * OAuth Installation Store
 */
export interface Installation {
  team: {
    id: string;
    name?: string;
  };
  enterprise?: {
    id: string;
    name?: string;
  };
  bot?: {
    token: string;
    userId: string;
    scopes: string[];
  };
  user: {
    token?: string;
    id: string;
    scopes?: string[];
  };
  incomingWebhook?: {
    url: string;
    channel: string;
    channelId: string;
    configurationUrl: string;
  };
  appId?: string;
  tokenType?: string;
  isEnterpriseInstall?: boolean;
  installedAt: number;
}

/**
 * Message Event
 */
export interface MessageEvent {
  type: 'message';
  subtype?: string;
  channel: string;
  user: string;
  text: string;
  ts: string;
  thread_ts?: string;
  team?: string;
  channel_type?: 'channel' | 'group' | 'im' | 'mpim';
}

/**
 * Slack Message Block
 */
export interface MessageBlock {
  type: string;
  text?: {
    type: 'plain_text' | 'mrkdwn';
    text: string;
    emoji?: boolean;
  };
  elements?: any[];
  accessory?: any;
  block_id?: string;
}

/**
 * Formatted Message
 */
export interface FormattedMessage {
  channel: string;
  text?: string;
  blocks?: MessageBlock[];
  attachments?: any[];
  thread_ts?: string;
  reply_broadcast?: boolean;
  unfurl_links?: boolean;
  unfurl_media?: boolean;
}

/**
 * Slash Command Payload
 */
export interface SlashCommandPayload {
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
  user_id: string;
  user_name: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  api_app_id: string;
}

/**
 * Action Payload (Button/Menu)
 */
export interface ActionPayload {
  type: 'block_actions' | 'interactive_message' | 'dialog_submission';
  actions: Array<{
    action_id: string;
    block_id?: string;
    value?: string;
    selected_option?: {
      value: string;
      text: { type: string; text: string };
    };
    type: string;
  }>;
  user: {
    id: string;
    username: string;
    name: string;
  };
  channel: {
    id: string;
    name: string;
  };
  message?: {
    ts: string;
    text?: string;
  };
  response_url: string;
  trigger_id: string;
}

/**
 * Modal View
 */
export interface ModalView {
  type: 'modal';
  callback_id: string;
  title: {
    type: 'plain_text';
    text: string;
  };
  blocks: MessageBlock[];
  submit?: {
    type: 'plain_text';
    text: string;
  };
  close?: {
    type: 'plain_text';
    text: string;
  };
  private_metadata?: string;
}

/**
 * File Upload Options
 */
export interface FileUploadOptions {
  channels?: string | string[];
  content?: string;
  file?: Buffer;
  filename?: string;
  filetype?: string;
  initial_comment?: string;
  thread_ts?: string;
  title?: string;
}

/**
 * Slack Manager Events
 */
export interface SlackManagerEvents {
  'slack:ready': () => void;
  'slack:error': (error: Error) => void;
  'slack:message': (event: MessageEvent) => void;
  'slack:command': (command: SlashCommandPayload) => void;
  'slack:action': (action: ActionPayload) => void;
  'slack:app_mention': (event: any) => void;
  'oauth:success': (installation: Installation) => void;
  'oauth:error': (error: Error) => void;
}

/**
 * Rate Limit Info
 */
export interface RateLimitInfo {
  retryAfter: number;
  maxRetries: number;
  currentRetry: number;
}

/**
 * Command Handler Function
 */
export type CommandHandler = (
  payload: SlashCommandPayload,
  respond: (message: any) => Promise<void>
) => Promise<void>;

/**
 * Action Handler Function
 */
export type ActionHandler = (
  payload: ActionPayload,
  respond: (message: any) => Promise<void>
) => Promise<void>;

/**
 * Message Handler Function
 */
export type MessageHandler = (
  event: MessageEvent,
  say: (message: string | FormattedMessage) => Promise<void>
) => Promise<void>;

/**
 * Bolt App Type Export
 */
export type SlackApp = App;

/**
 * Web Client Type Export
 */
export type SlackWebClient = WebClient;

/**
 * Re-export Bolt types
 */
export type {
  SlackEventMiddlewareArgs,
  AllMiddlewareArgs,
  ChatPostMessageArguments,
  FilesUploadV2Arguments,
};
