/**
 * Slack OAuth Handler
 *
 * Handles OAuth 2.0 flow and token management
 */

import { EventEmitter } from 'events';
import { Installation, SlackManagerConfig } from './types';

/**
 * Installation Store Interface
 */
export interface InstallationStore {
  storeInstallation(installation: Installation): Promise<void>;
  fetchInstallation(
    query: InstallQuery
  ): Promise<Installation | undefined>;
  deleteInstallation(
    query: InstallQuery
  ): Promise<void>;
}

/**
 * Installation Query
 */
export interface InstallQuery {
  teamId?: string;
  enterpriseId?: string;
  userId?: string;
  isEnterpriseInstall?: boolean;
}

/**
 * Memory-based Installation Store (Default)
 * For production, replace with database-backed store
 */
export class MemoryInstallationStore implements InstallationStore {
  private installations: Map<string, Installation> = new Map();

  async storeInstallation(installation: Installation): Promise<void> {
    const key = this.getKey(installation.team.id, installation.enterprise?.id);
    this.installations.set(key, installation);
  }

  async fetchInstallation(
    query: InstallQuery
  ): Promise<Installation | undefined> {
    const key = this.getKey(query.teamId, query.enterpriseId);
    return this.installations.get(key);
  }

  async deleteInstallation(query: InstallQuery): Promise<void> {
    const key = this.getKey(query.teamId, query.enterpriseId);
    this.installations.delete(key);
  }

  private getKey(teamId?: string, enterpriseId?: string): string {
    return enterpriseId
      ? `${enterpriseId}-${teamId || 'global'}`
      : teamId || 'unknown';
  }

  /**
   * Get all installations (for admin/debugging)
   */
  getAllInstallations(): Installation[] {
    return Array.from(this.installations.values());
  }

  /**
   * Clear all installations
   */
  clear(): void {
    this.installations.clear();
  }
}

/**
 * OAuth Handler
 *
 * Features:
 * - OAuth 2.0 authorization flow
 * - Installation storage
 * - Token refresh (if needed)
 * - Multi-workspace support
 */
export class OAuthHandler extends EventEmitter {
  private store: InstallationStore;
  private config: SlackManagerConfig;

  constructor(config: SlackManagerConfig, store?: InstallationStore) {
    super();
    this.config = config;
    this.store = store || new MemoryInstallationStore();
  }

  /**
   * Get OAuth authorize URL
   */
  getAuthorizeUrl(state?: string): string {
    if (!this.config.clientId) {
      throw new Error('clientId is required for OAuth');
    }

    const scopes = this.config.scopes || [
      'chat:write',
      'channels:read',
      'groups:read',
      'im:read',
      'mpim:read',
      'users:read',
      'files:write',
      'commands',
    ];

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      scope: scopes.join(','),
      redirect_uri: this.config.redirectUri || 'http://localhost:3000/slack/oauth_redirect',
      state: state || this.generateState(),
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Handle OAuth callback
   */
  async handleCallback(code: string): Promise<Installation> {
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error('clientId and clientSecret are required for OAuth');
    }

    try {
      // Exchange code for access token
      const response = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
          redirect_uri: this.config.redirectUri || 'http://localhost:3000/slack/oauth_redirect',
        }),
      });

      const data = await response.json();

      if (!data.ok) {
        throw new Error(`OAuth failed: ${data.error}`);
      }

      // Build installation object
      const installation: Installation = {
        team: {
          id: data.team.id,
          name: data.team.name,
        },
        enterprise: data.enterprise
          ? {
              id: data.enterprise.id,
              name: data.enterprise.name,
            }
          : undefined,
        bot: data.access_token
          ? {
              token: data.access_token,
              userId: data.bot_user_id,
              scopes: data.scope?.split(',') || [],
            }
          : undefined,
        user: {
          token: data.authed_user?.access_token,
          id: data.authed_user?.id,
          scopes: data.authed_user?.scope?.split(','),
        },
        incomingWebhook: data.incoming_webhook
          ? {
              url: data.incoming_webhook.url,
              channel: data.incoming_webhook.channel,
              channelId: data.incoming_webhook.channel_id,
              configurationUrl: data.incoming_webhook.configuration_url,
            }
          : undefined,
        appId: data.app_id,
        tokenType: data.token_type,
        isEnterpriseInstall: data.is_enterprise_install,
        installedAt: Date.now(),
      };

      // Store installation
      await this.store.storeInstallation(installation);

      this.emit('oauth:success', installation);

      return installation;
    } catch (error) {
      this.emit('oauth:error', error);
      throw error;
    }
  }

  /**
   * Get installation by team
   */
  async getInstallation(query: InstallQuery): Promise<Installation | undefined> {
    return this.store.fetchInstallation(query);
  }

  /**
   * Revoke installation
   */
  async revokeInstallation(query: InstallQuery): Promise<void> {
    const installation = await this.store.fetchInstallation(query);
    if (!installation) {
      throw new Error('Installation not found');
    }

    // Call Slack API to revoke token
    if (installation.bot?.token) {
      await fetch('https://slack.com/api/auth.revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${installation.bot.token}`,
        },
      });
    }

    // Remove from store
    await this.store.deleteInstallation(query);
  }

  /**
   * Generate secure state parameter
   */
  private generateState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verify state parameter (CSRF protection)
   */
  verifyState(state: string, expectedState: string): boolean {
    return state === expectedState;
  }

  /**
   * Get installation store (for advanced usage)
   */
  getStore(): InstallationStore {
    return this.store;
  }
}
