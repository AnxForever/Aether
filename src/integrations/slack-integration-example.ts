/**
 * Slack Integration Example
 *
 * Shows how to integrate Slack Manager with API Gateway
 */

import { SlackManager } from './slack';

/**
 * Initialize Slack integration
 */
export async function initializeSlackIntegration(): Promise<SlackManager | null> {
  // Check if Slack is configured
  const botToken = process.env.SLACK_BOT_TOKEN;
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  if (!botToken || !signingSecret) {
    console.warn('Slack integration disabled: Missing SLACK_BOT_TOKEN or SLACK_SIGNING_SECRET');
    return null;
  }

  // Create Slack Manager
  const slackManager = new SlackManager({
    botToken,
    signingSecret,
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    redirectUri: process.env.SLACK_REDIRECT_URI,
    socketMode: process.env.SLACK_SOCKET_MODE === 'true',
    appToken: process.env.SLACK_APP_TOKEN,
    port: parseInt(process.env.SLACK_PORT || '3000', 10),
    logLevel: (process.env.SLACK_LOG_LEVEL as any) || 'info',
  });

  // Setup event listeners
  slackManager.on('slack:ready', () => {
    console.log('✅ Slack Bot is ready');
  });

  slackManager.on('slack:error', (error: Error) => {
    console.error('❌ Slack error:', error);
  });

  slackManager.on('slack:message', (event: any) => {
    console.log('📩 Message received:', event.text);
  });

  slackManager.on('oauth:success', (installation: any) => {
    console.log('✅ OAuth success for team:', installation.team.name);
  });

  // Initialize
  await slackManager.initialize();

  return slackManager;
}

/**
 * Example: Custom command handler
 */
export function registerCustomCommands(slackManager: SlackManager): void {
  const commandHandler = slackManager.getCommandHandler();

  // Example: AI chat command
  commandHandler.registerCommand(
    '/ai',
    async (payload: any, respond: any) => {
      const prompt = payload.text.trim();

      if (!prompt) {
        await respond({
          text: 'Usage: /ai <your question>',
          response_type: 'ephemeral',
        });
        return;
      }

      // Send loading response
      await respond({
        text: '🤔 Thinking...',
        response_type: 'ephemeral',
      });

      // TODO: Integrate with AI provider
      // const response = await aiProvider.chat(prompt);

      await respond({
        text: `🤖 AI Response:\n${prompt}`,
        response_type: 'in_channel',
      });
    },
    {
      description: 'Ask AI a question',
      usage: '/ai <your question>',
    }
  );
}

/**
 * Example: Custom action handlers
 */
export function registerCustomActions(slackManager: SlackManager): void {
  const actionHandler = slackManager.getActionHandler();

  // Example: Approval workflow
  actionHandler.registerAction('request_approval', async (payload: any, respond: any) => {
    const messageHandler = slackManager.getMessageHandler();

    // Send approval request
    await messageHandler.sendFormattedMessage({
      channel: payload.channel.id,
      text: 'Approval Request',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Approval Request from <@${payload.user.id}>*\n\nPlease review and approve.`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '✅ Approve',
                emoji: true,
              },
              action_id: 'approve_button',
              style: 'primary' as const,
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '❌ Reject',
                emoji: true,
              },
              action_id: 'reject_button',
              style: 'danger' as const,
            },
          ],
        } as any,
      ],
    });

    await respond({
      text: '✅ Approval request sent',
      response_type: 'ephemeral',
    });
  });
}
