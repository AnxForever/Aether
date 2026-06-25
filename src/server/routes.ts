/**
 * Routes - API route definitions
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('Router');

/**
 * Request context
 */
export interface RequestContext {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: any;
  params: Record<string, string>;
}

/**
 * Route handler
 */
export type RouteHandler = (ctx: RequestContext) => Promise<any>;

/**
 * Route definition
 */
export interface Route {
  method: string;
  path: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

/**
 * Router
 */
export class Router {
  private routes: Route[] = [];

  /**
   * Add route
   */
  add(method: string, path: string, handler: RouteHandler): void {
    // Convert path to regex
    const paramNames: string[] = [];
    const pattern = new RegExp(
      '^' +
        path
          .replace(/\//g, '\\/')
          .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => {
            paramNames.push(name);
            return '([^/]+)';
          }) +
        '$'
    );

    this.routes.push({
      method: method.toUpperCase(),
      path,
      pattern,
      paramNames,
      handler
    });

    logger.debug(`Registered route: ${method} ${path}`);
  }

  /**
   * Match route
   */
  match(method: string, path: string): { handler: RouteHandler; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method !== method.toUpperCase()) continue;

      const match = path.match(route.pattern);
      if (!match) continue;

      // Extract params
      const params: Record<string, string> = {};
      for (let i = 0; i < route.paramNames.length; i++) {
        params[route.paramNames[i]] = match[i + 1];
      }

      return { handler: route.handler, params };
    }

    return null;
  }

  /**
   * List all routes
   */
  list(): Array<{ method: string; path: string }> {
    return this.routes.map(r => ({ method: r.method, path: r.path }));
  }
}

/**
 * Create default routes
 */
export function createDefaultRoutes(router: Router, agent: any): void {
  // Health check
  router.add('GET', '/health', async () => ({
    status: 'ok',
    timestamp: Date.now()
  }));

  // Agent status
  router.add('GET', '/api/status', async () => ({
    isProcessing: agent.isProcessing(),
    uptime: process.uptime()
  }));

  // Send message
  router.add('POST', '/api/chat', async (ctx) => {
    const { message, sessionId } = ctx.body;

    if (!message) {
      throw new Error('Message is required');
    }

    const response = await agent.chat(message, sessionId);
    return { response };
  });

  // List sessions
  router.add('GET', '/api/sessions', async () => {
    const sessions = await agent.listSessions();
    return { sessions };
  });

  // Get session
  router.add('GET', '/api/sessions/:sessionId', async (ctx) => {
    const session = await agent.getSession(ctx.params.sessionId);
    return { session };
  });

  // Delete session
  router.add('DELETE', '/api/sessions/:sessionId', async (ctx) => {
    await agent.deleteSession(ctx.params.sessionId);
    return { success: true };
  });

  // Get settings
  router.add('GET', '/api/settings', async () => {
    const settings = await agent.getSettings();
    return { settings };
  });

  // Update settings
  router.add('PUT', '/api/settings', async (ctx) => {
    await agent.updateSettings(ctx.body);
    return { success: true };
  });

  // List models
  router.add('GET', '/api/models', async () => {
    const models = await agent.getAvailableModels();
    return { models };
  });

  logger.info('Default routes registered');
}
