import http from 'http';
import { URL } from 'url';
import { randomUUID } from 'crypto';
import { PiAgentAdapter } from '../agent/pi-adapter';
import { SkillRegistry } from '../skills/registry';
import { createLogger } from '../utils/logger';

const logger = createLogger('HTTPServer');

export interface HttpServerConfig {
  port: number;
  host: string;
}

export interface AgentExecuteRequest {
  input: string;
  sessionId?: string;
  context?: Record<string, unknown>;
}

export interface AgentContinueRequest {
  sessionId: string;
  input?: string;
}

export interface AgentAbortRequest {
  sessionId: string;
}

export interface SkillInvokeRequest {
  skillName: string;
  args?: string;
  context?: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}

export class HttpServer {
  private server: http.Server | null = null;
  private agent: PiAgentAdapter;
  private skillRegistry: SkillRegistry;
  private config: HttpServerConfig;
  private sessions: Map<string, { active: boolean; lastAccess: number }> = new Map();
  private connections: Set<any> = new Set();

  constructor(
    agent: PiAgentAdapter,
    skillRegistry: SkillRegistry,
    config: HttpServerConfig = { port: 3000, host: '127.0.0.1' }
  ) {
    this.agent = agent;
    this.skillRegistry = skillRegistry;
    this.config = config;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(this.handleRequest.bind(this));

      // Track connections for graceful shutdown
      this.server.on('connection', (conn) => {
        this.connections.add(conn);
        conn.on('close', () => this.connections.delete(conn));
      });

      this.server.on('error', (error) => {
        reject(error);
      });

      this.server.listen(this.config.port, this.config.host, () => {
        logger.info(`Listening on http://${this.config.host}:${this.config.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    logger.info('Stopping HTTP server (graceful shutdown)...');

    // Stop accepting new connections
    await new Promise<void>((resolve, reject) => {
      this.server!.close((error) => {
        if (error) {
          logger.error('Error closing server', error as Error);
          reject(error);
        } else {
          resolve();
        }
      });
    });

    // Wait for existing connections to complete (max 30 seconds)
    const gracefulTimeout = 30000;
    const checkInterval = 100;
    const startTime = Date.now();

    await new Promise<void>((resolve) => {
      const check = () => {
        const elapsed = Date.now() - startTime;

        if (this.connections.size === 0) {
          clearInterval(intervalId);
          resolve();
        } else if (elapsed >= gracefulTimeout) {
          logger.warn(`Force closing ${this.connections.size} remaining connections`);
          this.connections.forEach(conn => conn.destroy());
          clearInterval(intervalId);
          resolve();
        }
      };

      const intervalId = setInterval(check, checkInterval);
      check(); // Run immediately
    });

    this.server = null;
    logger.info('HTTP server stopped');
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Parse URL
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const method = req.method || 'GET';
    const pathname = url.pathname;

    // CORS headers
    const corsOrigin = process.env.NODE_ENV === 'production'
      ? (process.env.CORS_ORIGIN || 'http://localhost:5173')
      : '*';
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS preflight
    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Route handling
    if (method === 'POST' && pathname === '/api/agent/execute') {
      this.handleAgentExecute(req, res);
    } else if (method === 'POST' && pathname === '/api/agent/continue') {
      this.handleAgentContinue(req, res);
    } else if (method === 'POST' && pathname === '/api/agent/abort') {
      this.handleAgentAbort(req, res);
    } else if (method === 'GET' && pathname.startsWith('/api/agent/status/')) {
      this.handleAgentStatus(req, res, pathname);
    } else if (method === 'POST' && pathname === '/api/skills/invoke') {
      this.handleSkillInvoke(req, res);
    } else if (method === 'GET' && pathname === '/api/skills/list') {
      this.handleSkillList(req, res);
    } else if (method === 'GET' && pathname === '/health') {
      this.sendJson(res, 200, { success: true, data: { status: 'healthy' } });
    } else {
      this.sendJson(res, 404, { success: false, error: 'Not Found' });
    }
  }

  private async handleAgentExecute(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const body = await this.readBody<AgentExecuteRequest>(req);

      if (!body.input) {
        this.sendJson(res, 400, { success: false, error: 'Missing required field: input' });
        return;
      }

      const sessionId = body.sessionId || this.generateSessionId();
      this.sessions.set(sessionId, { active: true, lastAccess: Date.now() });

      // Execute agent
      const result = await this.agent.execute(body.input);

      this.sessions.set(sessionId, { active: false, lastAccess: Date.now() });

      this.sendJson(res, 200, {
        success: true,
        data: {
          sessionId,
          result,
        },
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async handleAgentContinue(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const body = await this.readBody<AgentContinueRequest>(req);

      if (!body.sessionId) {
        this.sendJson(res, 400, { success: false, error: 'Missing required field: sessionId' });
        return;
      }

      const session = this.sessions.get(body.sessionId);
      if (!session) {
        this.sendJson(res, 404, { success: false, error: 'Session not found' });
        return;
      }

      this.sessions.set(body.sessionId, { active: true, lastAccess: Date.now() });

      // Continue execution (implementation depends on PiAgentAdapter capabilities)
      // For now, we'll treat it as a new execution with continuation context
      const result = await this.agent.execute(body.input || '');

      this.sessions.set(body.sessionId, { active: false, lastAccess: Date.now() });

      this.sendJson(res, 200, {
        success: true,
        data: {
          sessionId: body.sessionId,
          result,
        },
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async handleAgentAbort(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const body = await this.readBody<AgentAbortRequest>(req);

      if (!body.sessionId) {
        this.sendJson(res, 400, { success: false, error: 'Missing required field: sessionId' });
        return;
      }

      const session = this.sessions.get(body.sessionId);
      if (!session) {
        this.sendJson(res, 404, { success: false, error: 'Session not found' });
        return;
      }

      // Mark session as inactive
      this.sessions.set(body.sessionId, { active: false, lastAccess: Date.now() });

      this.sendJson(res, 200, {
        success: true,
        data: {
          sessionId: body.sessionId,
          aborted: true,
        },
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async handleAgentStatus(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string
  ): Promise<void> {
    try {
      const sessionId = pathname.split('/').pop();

      if (!sessionId) {
        this.sendJson(res, 400, { success: false, error: 'Missing sessionId' });
        return;
      }

      const session = this.sessions.get(sessionId);
      if (!session) {
        this.sendJson(res, 404, { success: false, error: 'Session not found' });
        return;
      }

      this.sendJson(res, 200, {
        success: true,
        data: {
          sessionId,
          active: session.active,
          lastAccess: new Date(session.lastAccess).toISOString(),
        },
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async handleSkillInvoke(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const body = await this.readBody<SkillInvokeRequest>(req);

      if (!body.skillName) {
        this.sendJson(res, 400, { success: false, error: 'Missing required field: skillName' });
        return;
      }

      const skill = this.skillRegistry.getSkill(body.skillName);
      if (!skill) {
        this.sendJson(res, 404, { success: false, error: `Skill not found: ${body.skillName}` });
        return;
      }

      // Execute skill
      const result = await skill.execute!(body.args || '', body.context || {});

      this.sendJson(res, 200, {
        success: true,
        data: {
          skillName: body.skillName,
          result,
        },
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async handleSkillList(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const skills = this.skillRegistry.listSkills().map((skill: any) => ({
        name: skill.name,
        description: skill.description,
        version: skill.version,
        category: 'general',
      }));

      this.sendJson(res, 200, {
        success: true,
        data: skills,
        meta: {
          total: skills.length,
        },
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async readBody<T>(req: http.IncomingMessage, maxSize: number = 10 * 1024 * 1024): Promise<T> {
    return new Promise((resolve, reject) => {
      let body = '';
      let bodySize = 0;

      const timeout = setTimeout(() => {
        req.destroy();
        reject(new Error('Request timeout'));
      }, 30000);

      req.on('data', (chunk) => {
        bodySize += chunk.length;
        if (bodySize > maxSize) {
          clearTimeout(timeout);
          req.destroy();
          reject(new Error('Request body too large'));
          return;
        }
        body += chunk.toString();
      });

      req.on('end', () => {
        clearTimeout(timeout);
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (error) {
          reject(new Error('Invalid JSON'));
        }
      });

      req.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private sendJson(res: http.ServerResponse, statusCode: number, data: ApiResponse): void {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  }

  private handleError(res: http.ServerResponse, error: unknown): void {
    logger.error('Request error', error instanceof Error ? error : new Error(String(error)));

    const message = error instanceof Error ? error.message : 'Unknown error';

    this.sendJson(res, 500, {
      success: false,
      error: message,
    });
  }

  private generateSessionId(): string {
    return randomUUID();
  }

  // Cleanup inactive sessions periodically
  startSessionCleanup(intervalMs: number = 60000, maxAgeMs: number = 3600000): void {
    const timer = setInterval(() => {
      const now = Date.now();
      for (const [sessionId, session] of this.sessions.entries()) {
        if (!session.active && now - session.lastAccess > maxAgeMs) {
          this.sessions.delete(sessionId);
          logger.info(`Cleaned up session: ${sessionId}`);
        }
      }
    }, intervalMs);

    // Prevent blocking process exit
    timer.unref();
  }
}
