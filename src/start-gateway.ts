/**
 * Gateway Server Starter
 *
 * Standalone script to start the API Gateway server
 */

import { GatewayServer } from './server/gateway-server';
import { Orchestrator } from './core/orchestrator';
import { createLogger } from './utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const logger = createLogger('GatewayStarter');

/**
 * Load gateway configuration
 */
function loadConfig(): any {
  const configPath = path.join(__dirname, '../config/gateway.json');

  try {
    const configData = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configData);
    // If jwtSecret is empty or not set, resolve securely
    if (!config.auth?.jwtSecret) {
      config.auth = config.auth || {};
      config.auth.jwtSecret = resolveJwtSecret();
    }
    return config;
  } catch (error) {
    logger.warn('Could not load config file, using defaults');
    const jwtSecret = resolveJwtSecret();
    return {
      port: 8080,
      host: '127.0.0.1',
      auth: {
        jwtSecret,
        publicPaths: ['/health', '/metrics', '/api/auth/login']
      },
      rateLimit: {
        maxTokens: 100,
        refillRate: 10
      },
      cors: {
        allowedOrigins: ['http://localhost:3000', 'http://localhost:5173']
      },
      timeout: 30000
    };
  }
}

/**
 * Start the gateway server
 */
async function startGateway() {
  try {
    logger.info('Starting API Gateway...');

    // Load configuration
    const config = loadConfig();
    logger.info(`Configuration loaded - Port: ${config.port}, Host: ${config.host}`);

    // Initialize orchestrator
    const orchestrator = new Orchestrator({
      defaultModel: process.env.DEFAULT_MODEL || 'claude-sonnet-4-20250514',
      defaultProvider: process.env.DEFAULT_PROVIDER || 'claude',
      maxConcurrentCycles: 10,
      dataDir: process.env.DATA_DIR || './data',
      enableLearning: process.env.ENABLE_LEARNING !== 'false'
    });

    await orchestrator.initialize();
    logger.info('Orchestrator initialized');

    // Create and start gateway server
    const gateway = new GatewayServer({
      port: config.port,
      host: config.host,
      auth: {
        jwtSecret: config.auth.jwtSecret,
        publicPaths: config.auth.publicPaths
      },
      rateLimit: {
        maxTokens: config.rateLimit.maxTokens || 100,
        refillRate: config.rateLimit.refillRate || 10
      },
      cors: config.cors,
      timeout: config.timeout,
      orchestrator
    });

    await gateway.start();

    logger.info(`✅ API Gateway is running on http://${config.host}:${config.port}`);
    logger.info('Available endpoints:');
    logger.info('  - GET  /health              - Health check');
    logger.info('  - GET  /metrics             - Gateway metrics');
    logger.info('  - POST /api/chat            - Chat with AI');
    logger.info('  - GET  /api/skills          - List all skills');
    logger.info('  - GET  /api/skills/:id      - Get specific skill');
    logger.info('  - POST /api/learning/feedback - Submit feedback');
    logger.info('  - GET  /api/learning/stats  - Learning statistics');
    logger.info('  - GET  /api/learning/report - Learning report');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await gateway.stop();
      await orchestrator.cleanup();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await gateway.stop();
      await orchestrator.cleanup();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start API Gateway:', error as Error);
    process.exit(1);
  }
}

/**
 * Resolve JWT secret securely.
 * - In production: JWT_SECRET must be set, otherwise throw.
 * - In development: generate a random secret (warns about non-persistence).
 */
function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) {
    return secret;
  }
  const isProduction = process.env.NODE_ENV === 'production';
  const generated = crypto.randomBytes(32).toString('hex');
  if (isProduction) {
    logger.error('JWT_SECRET environment variable is not set — refusing to start in production');
    throw new Error('JWT_SECRET must be configured in production environment');
  }
  logger.warn('JWT_SECRET not set. Generated a random secret — authentication tokens will NOT persist across restarts');
  return generated;
}

// Start if run directly
if (require.main === module) {
  startGateway();
}

export { startGateway };
