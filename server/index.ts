/**
 * Aether Web API Server
 *
 * Standalone Express server wrapping AetherAgent.
 * Zero Electron dependency — deploy anywhere.
 *
 * Routes:
 *   GET  /health              — health check
 *   GET  /api/models           — list available AI models
 *   POST /api/chat             — send message, get response
 *   GET  /api/chat/stream      — SSE streaming chat
 *   GET  /api/skills           — list skills
 *   POST /api/skills/:id/toggle— enable/disable skill
 *   POST /api/learning/feedback— record user feedback
 *   GET  /api/learning/stats   — learning statistics
 *   GET  /api/workflows        — list workflows
 *   POST /api/workflows/:id/run— execute workflow
 *   POST /api/auth/login       — JWT login
 *   WS   /ws                   — WebSocket collaboration
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer, Server } from 'http';
import { randomUUID } from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { config as loadEnv } from 'dotenv';
import { join } from 'path';

// Load .env
loadEnv({ path: join(__dirname, '..', '.env') });

import { createAetherAgent, AetherAgent } from '../src/agent';
import { createLogger } from '../src/utils/logger';

const logger = createLogger('Server');

// ============================================================================
// Configuration
// ============================================================================

interface ServerConfig {
  port: number;
  host: string;
  jwtSecret: string;
  corsOrigins: string[];
  dataDir: string;
}

const config: ServerConfig = {
  port: parseInt(process.env.HTTP_PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'aether-dev-secret-change-in-production-min-32-chars',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(','),
  dataDir: process.env.DATA_DIR || join(__dirname, '..', 'data'),
};

// ============================================================================
// JWT Middleware
// ============================================================================

import jwt from 'jsonwebtoken';

const PUBLIC_PATHS = ['/health', '/api/auth/login'];

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (PUBLIC_PATHS.some(p => req.path.startsWith(p))) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
    return;
  }

  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, config.jwtSecret);
    (req as any).user = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

// ============================================================================
// Rate Limiter
// ============================================================================

class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  constructor(private maxTokens: number, private refillRate: number) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }
  consume(count = 1): boolean {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }
}

const buckets = new Map<string, TokenBucket>();

function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const key = (req as any).user?.id || req.ip || 'anonymous';
  let bucket = buckets.get(key);
  if (!bucket) {
    const authenticated = !!(req as any).user;
    bucket = new TokenBucket(
      authenticated ? 100 : 20,
      authenticated ? 10 : 2
    );
    buckets.set(key, bucket);
  }
  if (!bucket.consume()) {
    res.status(429).json({ success: false, error: 'Too many requests. Slow down.' });
    return;
  }
  next();
}

// Cleanup stale buckets every 5 minutes
setInterval(() => {
  buckets.clear();
}, 300000);

// ============================================================================
// Agent Initialization
// ============================================================================

let agent: AetherAgent;

async function initAgent(): Promise<AetherAgent> {
  agent = createAetherAgent({
    dataDir: config.dataDir,
    enableLearning: true,
  });
  await agent.initialize();
  logger.info('AetherAgent initialized');
  return agent;
}

// ============================================================================
// Express App Setup
// ============================================================================

const app = express();

app.set('trust proxy', true);
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(authMiddleware);
app.use(rateLimiter);

// Request logger
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// ============================================================================
// Routes
// ============================================================================

// Health
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '3.0.0-web',
  });
});

// Auth
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  // Simple credential check — replace with real auth in production
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'aether-admin';

  if (username !== adminUser || password !== adminPass) {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign(
    { id: 'admin', username, role: 'admin' },
    config.jwtSecret,
    { expiresIn: '24h' }
  );

  res.json({ success: true, data: { token, expiresIn: 86400 } });
});

// Models
app.get('/api/models', async (_req: Request, res: Response) => {
  try {
    const models = await agent.getAvailableModels();
    res.json({ success: true, data: { models, count: models?.length || 0 } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Switch model
app.post('/api/models/switch', (req: Request, res: Response) => {
  const { model } = req.body;
  if (!model) {
    res.status(400).json({ success: false, error: 'model is required' });
    return;
  }
  agent.updateSettings({ model } as any);
  res.json({ success: true, data: { model } });
});

// Chat
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message, sessionId } = req.body;
    if (!message) {
      res.status(400).json({ success: false, error: 'message is required' });
      return;
    }
    const response = await agent.chat(message, sessionId);
    res.json({
      success: true,
      data: { message: response, sessionId: agent.getSessionId() },
    });
  } catch (error: any) {
    logger.error('Chat error:', error as Error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Chat SSE Stream
app.get('/api/chat/stream', async (req: Request, res: Response) => {
  const { message, sessionId } = req.query;
  if (!message || typeof message !== 'string') {
    res.status(400).json({ success: false, error: 'message query param required' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  try {
    for await (const chunk of agent.streamChat(message, sessionId as string | undefined)) {
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ type: 'done', sessionId: agent.getSessionId() })}\n\n`);
  } catch (error: any) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
  }
  res.end();
});

// Skills
app.get('/api/skills', async (_req: Request, res: Response) => {
  try {
    const skills = agent.listPlugins();
    const dynamic = agent.listDynamicSkills();
    res.json({
      success: true,
      data: { skills, dynamicSkills: dynamic, count: skills.length },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/skills/:id/toggle', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    if (enabled) {
      agent.enablePlugin(id as string);
    } else {
      agent.disablePlugin(id as string);
    }
    res.json({ success: true, data: { id, enabled } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Learning
app.post('/api/learning/feedback', async (req: Request, res: Response) => {
  try {
    const { messageId, rating, comment } = req.body;
    if (!messageId || rating == null) {
      res.status(400).json({ success: false, error: 'messageId and rating required' });
      return;
    }
    const id = await agent.recordFeedback(messageId, rating, comment);
    res.json({ success: true, data: { feedbackId: id } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/learning/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await agent.getLearningStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Workflows
app.get('/api/workflows', (_req: Request, res: Response) => {
  try {
    const workflows = agent.listWorkflows();
    res.json({ success: true, data: { workflows, count: workflows.length } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/workflows/:id/run', async (req: Request, res: Response) => {
  try {
    const result = await agent.executeWorkflow(req.params.id as string, req.body.inputs || {});
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Session
app.post('/api/session/new', (_req: Request, res: Response) => {
  agent.newSession();
  res.json({ success: true, data: { sessionId: agent.getSessionId() } });
});

// Plugin marketplace
app.get('/api/plugins/search', async (req: Request, res: Response) => {
  try {
    const { q, category } = req.query;
    const results = await agent.searchPlugins(q as string, category as string | undefined);
    res.json({ success: true, data: results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// Error Handling
// ============================================================================

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ============================================================================
// Start Server
// ============================================================================

async function start(): Promise<Server> {
  await initAgent();

  const httpServer = createServer(app);

  // WebSocket for collaboration
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  wss.on('connection', (ws: WebSocket) => {
    logger.info('WebSocket connected');
    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        // Broadcast to all other clients
        wss.clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ ...msg, timestamp: Date.now() }));
          }
        });
      } catch {
        ws.send(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    ws.on('close', () => logger.info('WebSocket disconnected'));
    ws.send(JSON.stringify({ type: 'connected', message: 'Welcome to Aether WebSocket' }));
  });

  return new Promise((resolve) => {
    httpServer.listen(config.port, config.host, () => {
      logger.info(`🚀 Aether API Server running at http://${config.host}:${config.port}`);
      logger.info(`   Health:  http://localhost:${config.port}/health`);
      logger.info(`   Chat:    http://localhost:${config.port}/api/chat`);
      logger.info(`   SSE:     http://localhost:${config.port}/api/chat/stream`);
      logger.info(`   WebSocket: ws://localhost:${config.port}/ws`);
      resolve(httpServer);
    });
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  await agent?.cleanup();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down...');
  await agent?.cleanup();
  process.exit(0);
});

// Run
start().catch((error) => {
  logger.error('Failed to start server:', error as Error);
  process.exit(1);
});

export { app, start, config };
