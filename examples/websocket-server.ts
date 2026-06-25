/**
 * WebSocket Server Example
 *
 * Demonstrates real-time communication with WebSocket
 */

import { HTTPServer } from '../src/server/http-server';
import { WSServer } from '../src/server/websocket-server';
import { createDefaultRoutes } from '../src/server/routes';
import { NexusAgent } from '../src/agent';

async function main() {
  console.log('Starting Nexus WebSocket Server...\n');

  // Initialize agent
  const agent = new NexusAgent({
    apiKeys: {
      claude: process.env.ANTHROPIC_API_KEY!
    }
  });

  await agent.initialize();

  // Create HTTP server
  const httpServer = new HTTPServer({
    port: 3000,
    host: '127.0.0.1',
    cors: true
  });

  // Setup routes
  const router = httpServer.getRouter();
  createDefaultRoutes(router, agent);

  // Start HTTP server
  await httpServer.start();
  console.log('✅ HTTP server running on http://127.0.0.1:3000');

  // Attach WebSocket server
  const wsServer = new WSServer();
  wsServer.attach((httpServer as any).server);

  // Handle WebSocket connections
  wsServer.onConnection = (connection) => {
    console.log(`✅ New WebSocket connection: ${connection.id}`);

    // Handle chat messages
    connection.on('chat', async (data: { message: string }) => {
      console.log(`📨 Received: ${data.message}`);

      try {
        // Stream response back to client
        for await (const chunk of agent.streamChat(data.message)) {
          connection.send('chat-chunk', { chunk });
        }

        connection.send('chat-end', { message: 'Response completed' });
      } catch (error: any) {
        connection.send('error', { message: error.message });
      }
    });

    // Handle ping
    connection.on('ping', () => {
      connection.send('pong', { timestamp: Date.now() });
    });
  };

  console.log('✅ WebSocket server attached');
  console.log('\n📡 Server ready! Try connecting with:');
  console.log('   const ws = new WebSocket("ws://127.0.0.1:3000");');
  console.log('   ws.send(JSON.stringify({ type: "chat", data: { message: "Hello!" } }));');
  console.log('\nPress Ctrl+C to stop\n');

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('\n\nShutting down...');
    await httpServer.stop();
    wsServer.closeAll();
    await agent.cleanup();
    process.exit(0);
  });
}

main().catch(console.error);
