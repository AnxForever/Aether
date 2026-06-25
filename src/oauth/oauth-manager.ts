/**
 * OAuth System - OAuth 2.0 authentication flow
 *
 * 支持：
 * - GitHub OAuth
 * - 渠道插件 OAuth
 * - 扫码登录
 */

import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';
import { randomBytes } from 'crypto';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http';

const logger = createLogger('OAuthManager');

/**
 * OAuth 提供商配置
 */
export interface OAuthProviderConfig {
  /** 提供商名称 */
  name: string;
  /** 客户端 ID */
  clientId: string;
  /** 客户端密钥 */
  clientSecret: string;
  /** 授权 URL */
  authorizationUrl: string;
  /** Token URL */
  tokenUrl: string;
  /** 回调 URL */
  redirectUri: string;
  /** Scope */
  scopes?: string[];
}

/**
 * OAuth Token
 */
export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  scope?: string;
}

/**
 * OAuth 状态
 */
interface OAuthState {
  state: string;
  codeVerifier?: string;
  provider: string;
  timestamp: number;
  resolve: (token: OAuthToken) => void;
  reject: (error: Error) => void;
}

/**
 * OAuth 管理器
 */
export class OAuthManager extends EventEmitter {
  private providers = new Map<string, OAuthProviderConfig>();
  private tokens = new Map<string, OAuthToken>();
  private pendingStates = new Map<string, OAuthState>();
  private callbackServer?: Server;
  private callbackPort: number = 3000;

  constructor(callbackPort?: number) {
    super();
    if (callbackPort) {
      this.callbackPort = callbackPort;
    }
  }

  /**
   * 注册 OAuth 提供商
   */
  registerProvider(config: OAuthProviderConfig): void {
    this.providers.set(config.name, config);
    logger.info(`OAuth provider registered: ${config.name}`);
  }

  /**
   * 启动回调服务器
   */
  async startCallbackServer(): Promise<void> {
    if (this.callbackServer) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.callbackServer = createServer((req, res) => {
        this.handleCallback(req, res);
      });

      this.callbackServer.listen(this.callbackPort, () => {
        logger.info(`OAuth callback server listening on port ${this.callbackPort}`);
        resolve();
      });

      this.callbackServer.on('error', reject);
    });
  }

  /**
   * 停止回调服务器
   */
  async stopCallbackServer(): Promise<void> {
    if (!this.callbackServer) {
      return;
    }

    return new Promise((resolve) => {
      this.callbackServer!.close(() => {
        logger.info('OAuth callback server stopped');
        this.callbackServer = undefined;
        resolve();
      });
    });
  }

  /**
   * 开始 OAuth 流程
   */
  async authorize(providerName: string): Promise<OAuthToken> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    // 生成 state
    const state = randomBytes(16).toString('hex');

    // 构建授权 URL
    const authUrl = new URL(provider.authorizationUrl);
    authUrl.searchParams.set('client_id', provider.clientId);
    authUrl.searchParams.set('redirect_uri', provider.redirectUri);
    authUrl.searchParams.set('state', state);

    if (provider.scopes && provider.scopes.length > 0) {
      authUrl.searchParams.set('scope', provider.scopes.join(' '));
    }

    // PKCE 支持（可选）
    let codeVerifier: string | undefined;
    if (this.shouldUsePKCE(providerName)) {
      codeVerifier = randomBytes(32).toString('base64url');
      const codeChallenge = await this.generateCodeChallenge(codeVerifier);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
    }

    logger.info(`Starting OAuth flow for ${providerName}`);

    // 返回 Promise，等待回调
    return new Promise((resolve, reject) => {
      this.pendingStates.set(state, {
        state,
        codeVerifier,
        provider: providerName,
        timestamp: Date.now(),
        resolve,
        reject,
      });

      // 触发授权事件（外部应该打开浏览器）
      this.emit('authorize-url', {
        provider: providerName,
        url: authUrl.toString(),
        state,
      });

      // 超时处理
      setTimeout(() => {
        if (this.pendingStates.has(state)) {
          this.pendingStates.delete(state);
          reject(new Error('OAuth timeout'));
        }
      }, 300000); // 5 分钟超时
    });
  }

  /**
   * 处理回调
   */
  private async handleCallback(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '', `http://localhost:${this.callbackPort}`);

    // 获取参数
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // 错误处理
    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`<html><body><h1>OAuth Error</h1><p>${error}</p></body></html>`);

      const pendingState = state ? this.pendingStates.get(state) : null;
      if (pendingState) {
        this.pendingStates.delete(state!);
        pendingState.reject(new Error(`OAuth error: ${error}`));
      }

      return;
    }

    // 验证 state
    if (!state || !this.pendingStates.has(state)) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`<html><body><h1>Invalid State</h1></body></html>`);
      return;
    }

    const pendingState = this.pendingStates.get(state)!;
    this.pendingStates.delete(state);

    // 验证 code
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`<html><body><h1>Missing Code</h1></body></html>`);
      pendingState.reject(new Error('Missing authorization code'));
      return;
    }

    try {
      // 交换 token
      const token = await this.exchangeToken(pendingState.provider, code, pendingState.codeVerifier);

      // 存储 token
      this.tokens.set(pendingState.provider, token);

      // 成功响应
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<html><body><h1>Success!</h1><p>You can close this window now.</p></body></html>`);

      logger.info(`OAuth completed for ${pendingState.provider}`);

      // 解决 Promise
      pendingState.resolve(token);

      this.emit('token-received', {
        provider: pendingState.provider,
        token,
      });
    } catch (error: any) {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`<html><body><h1>Error</h1><p>${error.message}</p></body></html>`);

      logger.error(`OAuth exchange failed for ${pendingState.provider}:`, error as Error);

      pendingState.reject(error);
    }
  }

  /**
   * 交换授权码为 token
   */
  private async exchangeToken(
    providerName: string,
    code: string,
    codeVerifier?: string
  ): Promise<OAuthToken> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      redirect_uri: provider.redirectUri,
    });

    if (codeVerifier) {
      body.set('code_verifier', codeVerifier);
    }

    const response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  /**
   * 刷新 token
   */
  async refreshToken(providerName: string): Promise<OAuthToken> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    const currentToken = this.tokens.get(providerName);
    if (!currentToken || !currentToken.refreshToken) {
      throw new Error('No refresh token available');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: currentToken.refreshToken,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
    });

    const response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    const newToken: OAuthToken = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || currentToken.refreshToken,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
      tokenType: data.token_type,
      scope: data.scope,
    };

    this.tokens.set(providerName, newToken);

    logger.info(`Token refreshed for ${providerName}`);

    return newToken;
  }

  /**
   * 获取 token
   */
  getToken(providerName: string): OAuthToken | undefined {
    return this.tokens.get(providerName);
  }

  /**
   * 撤销 token
   */
  revokeToken(providerName: string): void {
    this.tokens.delete(providerName);
    logger.info(`Token revoked for ${providerName}`);
  }

  /**
   * 是否应该使用 PKCE
   */
  private shouldUsePKCE(providerName: string): boolean {
    // GitHub 等公共客户端应该使用 PKCE
    return providerName === 'github';
  }

  /**
   * 生成 PKCE code challenge
   */
  private async generateCodeChallenge(verifier: string): Promise<string> {
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update(verifier).digest();
    return hash.toString('base64url');
  }
}
