/**
 * Feedback Package Exporter - Diagnostic data export with privacy filtering
 */

import { createLogger } from '../utils/logger';
import { createWriteStream, createReadStream } from 'fs';
import { readdir, readFile, stat, mkdir } from 'fs/promises';
import { join, basename } from 'path';
import { EventEmitter } from 'events';
import archiver from 'archiver';

const logger = createLogger('FeedbackExporter');

/**
 * Export options
 */
export interface ExportOptions {
  includeSessions?: boolean;
  includeAwareness?: boolean;
  includeNotes?: boolean;
  includeDrafts?: boolean;
  includeEpisodes?: boolean;
  includeDiagnostics?: boolean;
  includeLogs?: boolean;
  sensitiveDataFilter?: boolean;
}

/**
 * Export progress
 */
export interface ExportProgress {
  stage: string;
  progress: number;
  total: number;
}

/**
 * Feedback Exporter
 */
export class FeedbackExporter extends EventEmitter {
  private dataDir: string;
  private outputDir: string;

  constructor(dataDir: string, outputDir: string) {
    super();
    this.dataDir = dataDir;
    this.outputDir = outputDir;
  }

  /**
   * Export feedback package
   */
  async export(options: ExportOptions = {}): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = join(this.outputDir, `nexus-feedback-${timestamp}.zip`);

    logger.info('Starting feedback package export...');
    this.emitProgress('Initializing', 0, 100);

    // Ensure output directory exists
    await mkdir(this.outputDir, { recursive: true });

    // Create archive
    const output = createWriteStream(outputPath);
    const archive = (archiver as any)('zip', { zlib: { level: 9 } });

    archive.pipe(output);

    try {
      // Add metadata
      await this.addMetadata(archive);
      this.emitProgress('Adding metadata', 10, 100);

      // Add sessions
      if (options.includeSessions !== false) {
        await this.addSessions(archive, options.sensitiveDataFilter);
        this.emitProgress('Adding sessions', 30, 100);
      }

      // Add awareness content
      if (options.includeAwareness !== false) {
        await this.addAwareness(archive, options);
        this.emitProgress('Adding awareness', 50, 100);
      }

      // Add diagnostics
      if (options.includeDiagnostics !== false) {
        await this.addDiagnostics(archive);
        this.emitProgress('Adding diagnostics', 70, 100);
      }

      // Add logs
      if (options.includeLogs) {
        await this.addLogs(archive, options.sensitiveDataFilter);
        this.emitProgress('Adding logs', 90, 100);
      }

      // Finalize archive
      await archive.finalize();
      this.emitProgress('Finalizing', 100, 100);

      await new Promise<void>((resolve, reject) => {
        output.on('close', () => resolve());
        output.on('error', reject);
      });

      logger.info(`Feedback package exported: ${outputPath}`);
      return outputPath;
    } catch (error) {
      logger.error('Failed to export feedback package:', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Add metadata to archive
   */
  private async addMetadata(archive: archiver.Archiver): Promise<void> {
    const metadata = {
      version: '1.0.0',
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      exportedAt: new Date().toISOString()
    };

    archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });
  }

  /**
   * Add sessions to archive
   */
  private async addSessions(archive: archiver.Archiver, filterSensitive?: boolean): Promise<void> {
    const sessionsPath = join(this.dataDir, 'sessions');

    try {
      const files = await readdir(sessionsPath);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = join(sessionsPath, file);
        let content = await readFile(filePath, 'utf-8');

        if (filterSensitive) {
          content = this.filterSensitiveData(content);
        }

        archive.append(content, { name: `sessions/${file}` });
      }

      logger.info('Sessions added to archive');
    } catch (error) {
      logger.warn('Failed to add sessions:', error as Error);
    }
  }

  /**
   * Add awareness content to archive
   */
  private async addAwareness(archive: archiver.Archiver, options: ExportOptions): Promise<void> {
    const awarenessPath = join(this.dataDir, 'memory-bank');

    try {
      // Add index
      const indexPath = join(awarenessPath, 'index.json');
      try {
        const indexContent = await readFile(indexPath, 'utf-8');
        archive.append(indexContent, { name: 'awareness/index.json' });
      } catch (error) {
        logger.warn('No awareness index found');
      }

      // Add status
      const statusPath = join(awarenessPath, 'status.json');
      try {
        let statusContent = await readFile(statusPath, 'utf-8');
        statusContent = this.filterSensitiveData(statusContent);
        archive.append(statusContent, { name: 'awareness/status.json' });
      } catch (error) {
        logger.warn('No awareness status found');
      }

      // Add notes (optional)
      if (options.includeNotes) {
        await this.addAwarenessFolder(archive, awarenessPath, 'notes');
      }

      // Add drafts (optional)
      if (options.includeDrafts) {
        await this.addAwarenessFolder(archive, awarenessPath, 'drafts');
      }

      // Add episodes (optional)
      if (options.includeEpisodes) {
        await this.addAwarenessFolder(archive, awarenessPath, 'episodes');
      }

      logger.info('Awareness content added to archive');
    } catch (error) {
      logger.warn('Failed to add awareness content:', error as Error);
    }
  }

  /**
   * Add awareness folder to archive
   */
  private async addAwarenessFolder(
    archive: archiver.Archiver,
    basePath: string,
    folder: string
  ): Promise<void> {
    const folderPath = join(basePath, folder);

    try {
      const files = await readdir(folderPath);

      for (const file of files) {
        const filePath = join(folderPath, file);
        const content = await readFile(filePath, 'utf-8');
        archive.append(content, { name: `awareness/${folder}/${file}` });
      }
    } catch (error) {
      logger.warn(`Failed to add awareness/${folder}:`, error as Error);
    }
  }

  /**
   * Add diagnostics to archive
   */
  private async addDiagnostics(archive: archiver.Archiver): Promise<void> {
    const diagnosticsPath = join(this.dataDir, 'diagnostics');

    try {
      await mkdir(diagnosticsPath, { recursive: true });

      // Generate network diagnostics
      const networkDiag = await this.generateNetworkDiagnostics();
      archive.append(JSON.stringify(networkDiag, null, 2), {
        name: 'diagnostics/network-latest.json'
      });

      // Add system info
      const systemInfo = await this.generateSystemInfo();
      archive.append(JSON.stringify(systemInfo, null, 2), {
        name: 'diagnostics/system-info.json'
      });

      logger.info('Diagnostics added to archive');
    } catch (error) {
      logger.warn('Failed to add diagnostics:', error as Error);
    }
  }

  /**
   * Add logs to archive
   */
  private async addLogs(archive: archiver.Archiver, filterSensitive?: boolean): Promise<void> {
    const logsPath = join(this.dataDir, 'logs');

    try {
      const files = await readdir(logsPath);

      for (const file of files) {
        if (!file.endsWith('.log')) continue;

        const filePath = join(logsPath, file);
        const stats = await stat(filePath);

        // Only include recent logs (last 7 days)
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (stats.mtimeMs < sevenDaysAgo) continue;

        let content = await readFile(filePath, 'utf-8');

        if (filterSensitive) {
          content = this.filterSensitiveData(content);
        }

        archive.append(content, { name: `logs/${file}` });
      }

      logger.info('Logs added to archive');
    } catch (error) {
      logger.warn('Failed to add logs:', error as Error);
    }
  }

  /**
   * Filter sensitive data from content
   */
  private filterSensitiveData(content: string): string {
    const patterns = [
      // API keys and tokens
      /sk-[a-zA-Z0-9]{48}/g,
      /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/g,
      /"api[_-]?key":\s*"[^"]+"/gi,
      /"token":\s*"[^"]+"/gi,
      /"password":\s*"[^"]+"/gi,
      /"secret":\s*"[^"]+"/gi,

      // Email addresses
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

      // IP addresses
      /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,

      // File paths with usernames
      /\/Users\/[^\/\s]+/g,
      /C:\\Users\\[^\\s]+/g,

      // UUIDs
      /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g
    ];

    let filtered = content;

    for (const pattern of patterns) {
      filtered = filtered.replace(pattern, '[REDACTED]');
    }

    return filtered;
  }

  /**
   * Generate network diagnostics
   */
  private async generateNetworkDiagnostics(): Promise<any> {
    return {
      timestamp: Date.now(),
      userAgent: 'Nexus/1.0',
      platform: process.platform,
      connectivity: 'online'
    };
  }

  /**
   * Generate system info
   */
  private async generateSystemInfo(): Promise<any> {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cpus: require('os').cpus().length,
      totalMemory: require('os').totalmem(),
      freeMemory: require('os').freemem()
    };
  }

  /**
   * Emit progress event
   */
  private emitProgress(stage: string, progress: number, total: number): void {
    this.emit('progress', { stage, progress, total });
  }
}
