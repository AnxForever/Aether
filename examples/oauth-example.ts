/**
 * OAuth Example
 *
 * 演示 OAuth 和扫码登录功能
 */

import { OAuthManager, type OAuthProviderConfig } from './oauth-manager';
import { QRLoginManager } from './qr-login';
import { createLogger } from '../utils/logger';

const logger = createLogger('OAuthExample');

/**
 * 示例：GitHub OAuth
 */
export async function exampleGitHubOAuth() {
  const manager = new OAuthManager(3000);

  // 注册 GitHub provider
  const githubConfig: OAuthProviderConfig = {
    name: 'github',
    clientId: process.env.GITHUB_CLIENT_ID || 'your-client-id',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || 'your-client-secret',
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    redirectUri: 'http://localhost:3000/callback',
    scopes: ['user', 'repo'],
  };

  manager.registerProvider(githubConfig);

  // 监听授权 URL
  manager.on('authorize-url', ({ provider, url }) => {
    logger.info(`Please open this URL in your browser:\n${url}`);
    // 实际应用中应该自动打开浏览器
  });

  // 监听 token 接收
  manager.on('token-received', ({ provider, token }) => {
    logger.info(`Token received for ${provider}`);
    logger.info(`Access token: ${token.accessToken.substring(0, 20)}...`);
  });

  try {
    // 启动回调服务器
    await manager.startCallbackServer();

    // 开始授权
    const token = await manager.authorize('github');

    logger.info('GitHub OAuth completed!');
    logger.info(`Token: ${token.accessToken.substring(0, 20)}...`);

    // 停止服务器
    await manager.stopCallbackServer();
  } catch (error: any) {
    logger.error('GitHub OAuth failed:', error);
  }
}

/**
 * 示例：Token 刷新
 */
export async function exampleTokenRefresh() {
  const manager = new OAuthManager();

  // 假设已经有 token
  // const token = manager.getToken('github');
  // if (token && token.refreshToken) {
  //   const newToken = await manager.refreshToken('github');
  //   logger.info('Token refreshed!');
  // }

  logger.info('Token refresh example (requires existing refresh token)');
}

/**
 * 示例：扫码登录
 */
export async function exampleQRLogin() {
  const qrManager = new QRLoginManager('http://localhost:3000');

  // 监听会话创建
  qrManager.on('session-created', (session) => {
    logger.info('QR Login session created:');
    logger.info(`  Session ID: ${session.id}`);
    logger.info(`  Login URL: ${session.loginUrl}`);
    logger.info(`\n  Scan this QR code:\n`);
    // 实际应用中应该显示 QR 码图片
    logger.info(session.qrCode);
  });

  // 监听状态更新
  qrManager.on('session-updated', (session) => {
    logger.info(`Session status updated: ${session.status}`);
  });

  try {
    // 创建会话
    const session = await qrManager.createSession();

    // 模拟扫描（实际由移动端触发）
    setTimeout(() => {
      logger.info('Simulating scan...');
      qrManager.markScanned(session.id);
    }, 2000);

    // 模拟确认（实际由移动端触发）
    setTimeout(() => {
      logger.info('Simulating confirm...');
      qrManager.confirmLogin(session.id, {
        userId: '12345',
        username: 'test-user',
      });
    }, 4000);

    // 轮询状态
    await qrManager.pollSession(session.id, (status, user) => {
      logger.info(`Polling: ${status}`, user);
    });

    logger.info('QR Login completed!');

    // 清理
    qrManager.cleanup();
  } catch (error: any) {
    logger.error('QR Login failed:', error);
  }
}

/**
 * 示例：多个 OAuth 提供商
 */
export async function exampleMultipleProviders() {
  const manager = new OAuthManager();

  // GitHub
  manager.registerProvider({
    name: 'github',
    clientId: 'github-client-id',
    clientSecret: 'github-client-secret',
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    redirectUri: 'http://localhost:3000/callback',
    scopes: ['user'],
  });

  // Google
  manager.registerProvider({
    name: 'google',
    clientId: 'google-client-id',
    clientSecret: 'google-client-secret',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    redirectUri: 'http://localhost:3000/callback',
    scopes: ['openid', 'email', 'profile'],
  });

  logger.info('Registered providers: github, google');
}

/**
 * 运行所有示例
 */
export async function runAllOAuthExamples() {
  logger.info('=== Example 1: GitHub OAuth ===');
  await exampleGitHubOAuth().catch(e => logger.warn('Skipped:', e.message));

  logger.info('\n=== Example 2: Token Refresh ===');
  await exampleTokenRefresh();

  logger.info('\n=== Example 3: QR Login ===');
  await exampleQRLogin();

  logger.info('\n=== Example 4: Multiple Providers ===');
  await exampleMultipleProviders();

  logger.info('\n=== All OAuth examples completed ===');
}

// 如果直接运行此文件
if (require.main === module) {
  runAllOAuthExamples().catch(error => {
    logger.error('OAuth examples failed:', error);
    process.exit(1);
  });
}
