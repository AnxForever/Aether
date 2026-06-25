/**
 * Collaboration Demo - Demonstrates real-time collaboration features
 *
 * Usage:
 *   npx ts-node examples/collaboration-demo.ts
 */

import { CollaborationLauncher } from '../src/server/collaboration-launcher';
import { createLogger } from '../src/utils/logger';
import { join } from 'path';
import { tmpdir } from 'os';

const logger = createLogger('CollaborationDemo');

async function main() {
  logger.info('Starting Collaboration Demo...');

  // Initialize collaboration launcher
  const launcher = new CollaborationLauncher({
    port: 8081,
    dataDir: join(tmpdir(), 'nexus-collab-demo'),
    enableAuth: false
  });

  // Setup event listeners
  launcher.on('started', (data) => {
    logger.info(`✅ Collaboration server started on port ${data.port}`);
    logger.info(`🌐 WebSocket URL: ws://localhost:${data.port}`);
    logger.info(`📂 Test client: Open examples/collaboration-client.html in your browser`);
  });

  launcher.on('user-joined', (data) => {
    logger.info(`👤 User joined: ${data.user.name} (${data.userId})`);
    logger.info(`   Session: ${data.sessionId}`);
  });

  launcher.on('user-left', (data) => {
    logger.info(`👋 User left: ${data.userId} from session ${data.sessionId}`);
  });

  launcher.on('edit-operation', (operation) => {
    logger.info(`✏️  Edit: ${operation.type} in ${operation.file} by user ${operation.userId}`);
  });

  launcher.on('comment-added', (comment) => {
    logger.info(`💬 Comment: "${comment.content}" by user ${comment.userId}`);
    logger.info(`   File: ${comment.file}:${comment.line}`);
  });

  launcher.on('session-created', (session) => {
    logger.info(`📝 Session created: ${session.name} (${session.id})`);
  });

  launcher.on('error', (error) => {
    logger.error('❌ Error:', error as Error);
  });

  // Start the server
  await launcher.start();

  // Create a demo session
  const session = launcher.createSession('Demo Session', 'demo-user', {
    project: 'nexus-agent',
    description: 'Real-time collaboration demo'
  });

  logger.info(`\n📋 Demo Session Created:`);
  logger.info(`   ID: ${session.id}`);
  logger.info(`   Name: ${session.name}`);
  logger.info(`   Created by: ${session.createdBy}`);

  // Display server status
  setInterval(() => {
    const status = launcher.getStatus();
    logger.info(`\n📊 Server Status:`);
    logger.info(`   Running: ${status.isRunning}`);
    logger.info(`   Port: ${status.port}`);
    logger.info(`   Active Sessions: ${status.activeSessions}`);
    logger.info(`   Total Users: ${status.totalUsers}`);
    logger.info(`   Uptime: ${Math.floor(status.uptime / 1000)}s`);

    // Display active sessions
    const sessions = launcher.getActiveSessions();
    if (sessions.length > 0) {
      logger.info(`\n📁 Active Sessions:`);
      sessions.forEach(s => {
        logger.info(`   - ${s.sessionId}: ${s.userCount} users`);
      });
    }
  }, 10000);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('\n\n⏹️  Shutting down...');
    await launcher.stop();
    logger.info('✅ Server stopped gracefully');
    process.exit(0);
  });

  logger.info(`\n🚀 Server is running! Press Ctrl+C to stop.`);
  logger.info(`\n📖 How to test:`);
  logger.info(`   1. Open examples/collaboration-client.html in multiple browser tabs`);
  logger.info(`   2. Enter the session ID: ${session.id}`);
  logger.info(`   3. Move your cursor, type, and add comments`);
  logger.info(`   4. Watch real-time updates across all tabs\n`);
}

// Run the demo
main().catch((error) => {
  logger.error('Failed to start demo:', error as Error);
  process.exit(1);
});
