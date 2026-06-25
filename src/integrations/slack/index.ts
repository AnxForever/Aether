/**
 * Slack Integration Entry Point
 *
 * Export all Slack integration modules
 */

export * from './types';
export * from './slack-manager';
export * from './oauth-handler';
export { MessageHandler } from './message-handler';
export * from './command-handler';
export * from './action-handler';

// Re-export main class as default
export { SlackManager as default } from './slack-manager';
