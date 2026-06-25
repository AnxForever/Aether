/**
 * Browser Protocol Handler - Custom protocol support (aether://)
 */

import { protocol } from 'electron';
import { createLogger } from '../utils/logger';
import { readFile } from 'fs/promises';
import { join } from 'path';

const logger = createLogger('Browser:Protocol');

/**
 * Protocol Handler
 */
export class ProtocolHandler {
  /**
   * Register custom protocols
   */
  static register(): void {
    // Register aether:// protocol
    protocol.registerSchemesAsPrivileged([
      {
        scheme: 'nexus',
        privileges: {
          standard: true,
          secure: true,
          supportFetchAPI: true,
          corsEnabled: true
        }
      }
    ]);

    logger.info('Custom protocols registered');
  }

  /**
   * Setup protocol handlers
   */
  static async setup(dataDir: string): Promise<void> {
    // Handle aether:// URLs
    protocol.handle('nexus', async (request) => {
      const url = new URL(request.url);

      switch (url.hostname) {
        case 'home':
          return this.handleHome();

        case 'settings':
          return this.handleSettings();

        case 'help':
          return this.handleHelp();

        case 'skill':
          return this.handleSkill(url.pathname.slice(1));

        default:
          return new Response('Not Found', { status: 404 });
      }
    });

    logger.info('Protocol handlers setup completed');
  }

  /**
   * Handle aether://home
   */
  private static async handleHome(): Promise<Response> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Aether Home</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              max-width: 800px;
              margin: 50px auto;
              padding: 20px;
            }
            h1 { color: #333; }
            .card {
              background: #f5f5f5;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <h1>Welcome to Aether</h1>
          <div class="card">
            <h2>Quick Links</h2>
            <ul>
              <li><a href="aether://settings">Settings</a></li>
              <li><a href="aether://help">Help & Documentation</a></li>
            </ul>
          </div>
        </body>
      </html>
    `;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  /**
   * Handle aether://settings
   */
  private static async handleSettings(): Promise<Response> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Aether Settings</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              max-width: 800px;
              margin: 50px auto;
              padding: 20px;
            }
          </style>
        </head>
        <body>
          <h1>Settings</h1>
          <p>Manage your Aether configuration here.</p>
        </body>
      </html>
    `;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  /**
   * Handle aether://help
   */
  private static async handleHelp(): Promise<Response> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Aether Help</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              max-width: 800px;
              margin: 50px auto;
              padding: 20px;
            }
          </style>
        </head>
        <body>
          <h1>Help & Documentation</h1>
          <p>Find help and documentation for Aether.</p>
        </body>
      </html>
    `;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  /**
   * Handle aether://skill/{skillId}
   */
  private static async handleSkill(skillId: string): Promise<Response> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Skill: ${skillId}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              max-width: 800px;
              margin: 50px auto;
              padding: 20px;
            }
          </style>
        </head>
        <body>
          <h1>Skill: ${skillId}</h1>
          <p>Documentation for this skill.</p>
        </body>
      </html>
    `;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}
