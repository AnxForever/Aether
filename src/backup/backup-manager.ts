/**
 * Backup Manager - Automatic backup with encryption and compression
 */

import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { createReadStream, createWriteStream } from 'fs';
import { readdir, stat, readFile, writeFile, mkdir, rm } from 'fs/promises';
import { join, relative } from 'path';
import { createGzip, createGunzip } from 'zlib';
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { pipeline } from 'stream/promises';

const logger = createLogger('BackupManager');

/**
 * Backup type
 */
export type BackupType = 'full' | 'incremental';

/**
 * Backup metadata
 */
export interface BackupMetadata {
  id: string;
  type: BackupType;
  timestamp: number;
  size: number;
  fileCount: number;
  checksum: string;
  encrypted: boolean;
  compressed: boolean;
  parentBackupId?: string; // For incremental backups
}

/**
 * Backup configuration
 */
export interface BackupConfig {
  sourceDir: string;
  backupDir: string;
  password?: string;
  compression: boolean;
  maxBackups: number;
  excludePatterns?: string[];
}

/**
 * Backup Manager
 */
export class BackupManager extends EventEmitter {
  private db: Database.Database;
  private config: BackupConfig;

  constructor(dbPath: string, config: BackupConfig) {
    super();
    this.db = new Database(dbPath);
    this.config = config;
    this.initializeTables();
  }

  /**
   * Initialize database tables
   */
  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS backups (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        size INTEGER NOT NULL,
        fileCount INTEGER NOT NULL,
        checksum TEXT NOT NULL,
        encrypted INTEGER NOT NULL,
        compressed INTEGER NOT NULL,
        parentBackupId TEXT,
        metadata TEXT,
        FOREIGN KEY (parentBackupId) REFERENCES backups(id)
      );

      CREATE TABLE IF NOT EXISTS backup_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        backupId TEXT NOT NULL,
        filePath TEXT NOT NULL,
        size INTEGER NOT NULL,
        modifiedTime INTEGER NOT NULL,
        checksum TEXT NOT NULL,
        FOREIGN KEY (backupId) REFERENCES backups(id)
      );

      CREATE INDEX IF NOT EXISTS idx_backups_timestamp ON backups(timestamp);
      CREATE INDEX IF NOT EXISTS idx_backup_files_backup ON backup_files(backupId);
      CREATE INDEX IF NOT EXISTS idx_backup_files_path ON backup_files(filePath);
    `);

    logger.info('Backup manager initialized');
  }

  /**
   * Create full backup
   */
  async createFullBackup(): Promise<BackupMetadata> {
    logger.info('Starting full backup');

    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const backupPath = join(this.config.backupDir, backupId);

    await mkdir(backupPath, { recursive: true });

    try {
      // Collect files
      const files = await this.collectFiles(this.config.sourceDir);
      logger.info(`Collected ${files.length} files for backup`);

      let totalSize = 0;
      const fileRecords: any[] = [];

      // Backup each file
      for (const file of files) {
        const relativePath = relative(this.config.sourceDir, file.path);
        const destPath = join(backupPath, relativePath);

        // Create directory
        await mkdir(join(destPath, '..'), { recursive: true });

        // Copy and optionally encrypt/compress
        await this.backupFile(file.path, destPath);

        const fileSize = (await stat(destPath)).size;
        totalSize += fileSize;

        fileRecords.push({
          backupId,
          filePath: relativePath,
          size: fileSize,
          modifiedTime: file.modifiedTime,
          checksum: file.checksum
        });

        this.emit('file-backed-up', { file: relativePath, size: fileSize });
      }

      // Calculate backup checksum
      const checksum = await this.calculateDirectoryChecksum(backupPath);

      // Store metadata
      const metadata: BackupMetadata = {
        id: backupId,
        type: 'full',
        timestamp: Date.now(),
        size: totalSize,
        fileCount: files.length,
        checksum,
        encrypted: !!this.config.password,
        compressed: this.config.compression
      };

      this.db
        .prepare(
          `INSERT INTO backups (id, type, timestamp, size, fileCount, checksum, encrypted, compressed, parentBackupId, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          metadata.id,
          metadata.type,
          metadata.timestamp,
          metadata.size,
          metadata.fileCount,
          metadata.checksum,
          metadata.encrypted ? 1 : 0,
          metadata.compressed ? 1 : 0,
          null,
          JSON.stringify(metadata)
        );

      // Store file records
      const insertFile = this.db.prepare(
        `INSERT INTO backup_files (backupId, filePath, size, modifiedTime, checksum)
         VALUES (?, ?, ?, ?, ?)`
      );

      for (const record of fileRecords) {
        insertFile.run(record.backupId, record.filePath, record.size, record.modifiedTime, record.checksum);
      }

      // Cleanup old backups
      await this.cleanupOldBackups();

      logger.info(`Full backup completed: ${backupId} (${totalSize} bytes, ${files.length} files)`);
      this.emit('backup-completed', metadata);

      return metadata;
    } catch (error: any) {
      logger.error('Full backup failed:', error as Error);

      // Cleanup failed backup
      await rm(backupPath, { recursive: true, force: true });

      throw error;
    }
  }

  /**
   * Create incremental backup
   */
  async createIncrementalBackup(parentBackupId?: string): Promise<BackupMetadata> {
    logger.info('Starting incremental backup');

    // Find latest full backup if no parent specified
    if (!parentBackupId) {
      const latestBackup = this.db
        .prepare('SELECT id FROM backups WHERE type = ? ORDER BY timestamp DESC LIMIT 1')
        .get('full') as { id: string } | undefined;

      if (!latestBackup) {
        throw new Error('No full backup found. Create a full backup first.');
      }

      parentBackupId = latestBackup.id;
    }

    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const backupPath = join(this.config.backupDir, backupId);

    await mkdir(backupPath, { recursive: true });

    try {
      // Get parent backup files
      const parentFiles = this.db
        .prepare('SELECT * FROM backup_files WHERE backupId = ?')
        .all(parentBackupId) as any[];

      const parentFileMap = new Map(parentFiles.map(f => [f.filePath, f]));

      // Collect current files
      const currentFiles = await this.collectFiles(this.config.sourceDir);

      // Find changed and new files
      const changedFiles = currentFiles.filter(file => {
        const relativePath = relative(this.config.sourceDir, file.path);
        const parentFile = parentFileMap.get(relativePath);

        return !parentFile ||
               parentFile.checksum !== file.checksum ||
               parentFile.modifiedTime !== file.modifiedTime;
      });

      logger.info(`Found ${changedFiles.length} changed/new files`);

      let totalSize = 0;
      const fileRecords: any[] = [];

      // Backup changed files
      for (const file of changedFiles) {
        const relativePath = relative(this.config.sourceDir, file.path);
        const destPath = join(backupPath, relativePath);

        await mkdir(join(destPath, '..'), { recursive: true });
        await this.backupFile(file.path, destPath);

        const fileSize = (await stat(destPath)).size;
        totalSize += fileSize;

        fileRecords.push({
          backupId,
          filePath: relativePath,
          size: fileSize,
          modifiedTime: file.modifiedTime,
          checksum: file.checksum
        });

        this.emit('file-backed-up', { file: relativePath, size: fileSize });
      }

      const checksum = await this.calculateDirectoryChecksum(backupPath);

      const metadata: BackupMetadata = {
        id: backupId,
        type: 'incremental',
        timestamp: Date.now(),
        size: totalSize,
        fileCount: changedFiles.length,
        checksum,
        encrypted: !!this.config.password,
        compressed: this.config.compression,
        parentBackupId
      };

      this.db
        .prepare(
          `INSERT INTO backups (id, type, timestamp, size, fileCount, checksum, encrypted, compressed, parentBackupId, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          metadata.id,
          metadata.type,
          metadata.timestamp,
          metadata.size,
          metadata.fileCount,
          metadata.checksum,
          metadata.encrypted ? 1 : 0,
          metadata.compressed ? 1 : 0,
          metadata.parentBackupId,
          JSON.stringify(metadata)
        );

      const insertFile = this.db.prepare(
        `INSERT INTO backup_files (backupId, filePath, size, modifiedTime, checksum)
         VALUES (?, ?, ?, ?, ?)`
      );

      for (const record of fileRecords) {
        insertFile.run(record.backupId, record.filePath, record.size, record.modifiedTime, record.checksum);
      }

      await this.cleanupOldBackups();

      logger.info(`Incremental backup completed: ${backupId} (${totalSize} bytes, ${changedFiles.length} files)`);
      this.emit('backup-completed', metadata);

      return metadata;
    } catch (error: any) {
      logger.error('Incremental backup failed:', error as Error);
      await rm(backupPath, { recursive: true, force: true });
      throw error;
    }
  }

  /**
   * Backup single file with optional encryption and compression
   */
  private async backupFile(sourcePath: string, destPath: string): Promise<void> {
    if (this.config.compression && this.config.password) {
      // Compress and encrypt
      await this.compressAndEncrypt(sourcePath, destPath);
    } else if (this.config.compression) {
      // Compress only
      await this.compressFile(sourcePath, destPath);
    } else if (this.config.password) {
      // Encrypt only
      await this.encryptFile(sourcePath, destPath);
    } else {
      // Copy as-is
      await pipeline(
        createReadStream(sourcePath),
        createWriteStream(destPath)
      );
    }
  }

  /**
   * Compress file
   */
  private async compressFile(sourcePath: string, destPath: string): Promise<void> {
    await pipeline(
      createReadStream(sourcePath),
      createGzip(),
      createWriteStream(destPath + '.gz')
    );
  }

  /**
   * Encrypt file
   */
  private async encryptFile(sourcePath: string, destPath: string): Promise<void> {
    if (!this.config.password) throw new Error('Password required for encryption');

    const key = await this.deriveKey(this.config.password);
    const iv = randomBytes(16);

    const cipher = createCipheriv('aes-256-gcm', key, iv);

    const input = createReadStream(sourcePath);
    const output = createWriteStream(destPath + '.enc');

    // Write IV first
    output.write(iv);

    await pipeline(input, cipher, output);

    // Write auth tag
    const authTag = cipher.getAuthTag();
    await writeFile(destPath + '.tag', authTag);
  }

  /**
   * Compress and encrypt file
   */
  private async compressAndEncrypt(sourcePath: string, destPath: string): Promise<void> {
    if (!this.config.password) throw new Error('Password required for encryption');

    const key = await this.deriveKey(this.config.password);
    const iv = randomBytes(16);

    const cipher = createCipheriv('aes-256-gcm', key, iv);

    const input = createReadStream(sourcePath);
    const gzip = createGzip();
    const output = createWriteStream(destPath + '.gz.enc');

    output.write(iv);

    await pipeline(input, gzip, cipher, output);

    const authTag = cipher.getAuthTag();
    await writeFile(destPath + '.tag', authTag);
  }

  /**
   * Derive encryption key from password
   */
  private async deriveKey(password: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scrypt(password, 'nexus-backup-salt', 32, (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });
  }

  /**
   * Collect files from directory
   */
  private async collectFiles(dir: string): Promise<Array<{ path: string; modifiedTime: number; checksum: string }>> {
    const files: Array<{ path: string; modifiedTime: number; checksum: string }> = [];

    const walk = async (currentDir: string): Promise<void> => {
      const entries = await readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);

        // Check exclude patterns
        if (this.shouldExclude(fullPath)) {
          continue;
        }

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          const stats = await stat(fullPath);
          const checksum = await this.calculateFileChecksum(fullPath);

          files.push({
            path: fullPath,
            modifiedTime: stats.mtimeMs,
            checksum
          });
        }
      }
    };

    await walk(dir);

    return files;
  }

  /**
   * Check if file should be excluded
   */
  private shouldExclude(filePath: string): boolean {
    if (!this.config.excludePatterns) return false;

    return this.config.excludePatterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(filePath);
    });
  }

  /**
   * Calculate file checksum
   */
  private async calculateFileChecksum(filePath: string): Promise<string> {
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256');
    const input = createReadStream(filePath);

    return new Promise((resolve, reject) => {
      input.on('data', chunk => hash.update(chunk));
      input.on('end', () => resolve(hash.digest('hex')));
      input.on('error', reject);
    });
  }

  /**
   * Calculate directory checksum
   */
  private async calculateDirectoryChecksum(dir: string): Promise<string> {
    const files = await this.collectFiles(dir);
    const checksums = files.map(f => f.checksum).sort().join('');

    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(checksums).digest('hex');
  }

  /**
   * Cleanup old backups
   */
  private async cleanupOldBackups(): Promise<void> {
    const backups = this.listBackups();

    if (backups.length > this.config.maxBackups) {
      const toDelete = backups
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(0, backups.length - this.config.maxBackups);

      for (const backup of toDelete) {
        await this.deleteBackup(backup.id);
      }

      logger.info(`Cleaned up ${toDelete.length} old backups`);
    }
  }

  /**
   * List all backups
   */
  listBackups(): BackupMetadata[] {
    const rows = this.db
      .prepare('SELECT * FROM backups ORDER BY timestamp DESC')
      .all() as any[];

    return rows.map(row => ({
      id: row.id,
      type: row.type,
      timestamp: row.timestamp,
      size: row.size,
      fileCount: row.fileCount,
      checksum: row.checksum,
      encrypted: row.encrypted === 1,
      compressed: row.compressed === 1,
      parentBackupId: row.parentBackupId
    }));
  }

  /**
   * Get backup metadata
   */
  getBackup(backupId: string): BackupMetadata | null {
    const row = this.db
      .prepare('SELECT * FROM backups WHERE id = ?')
      .get(backupId) as any;

    if (!row) return null;

    return {
      id: row.id,
      type: row.type,
      timestamp: row.timestamp,
      size: row.size,
      fileCount: row.fileCount,
      checksum: row.checksum,
      encrypted: row.encrypted === 1,
      compressed: row.compressed === 1,
      parentBackupId: row.parentBackupId
    };
  }

  /**
   * Delete backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    const backupPath = join(this.config.backupDir, backupId);

    // Delete files
    await rm(backupPath, { recursive: true, force: true });

    // Delete database records
    this.db.prepare('DELETE FROM backup_files WHERE backupId = ?').run(backupId);
    this.db.prepare('DELETE FROM backups WHERE id = ?').run(backupId);

    logger.info(`Backup deleted: ${backupId}`);
  }

  /**
   * Close and cleanup
   */
  close(): void {
    if (this.db) {
      this.db.close();
      logger.info('Backup manager closed');
    }
  }
}
