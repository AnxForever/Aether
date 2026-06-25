/**
 * Restore Manager - Restore from backups with verification
 */

import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { createReadStream, createWriteStream } from 'fs';
import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { createGunzip } from 'zlib';
import { createDecipheriv, scrypt } from 'crypto';
import { pipeline } from 'stream/promises';
import { BackupMetadata } from './backup-manager';

const logger = createLogger('RestoreManager');

/**
 * Restore options
 */
export interface RestoreOptions {
  targetDir: string;
  password?: string;
  verifyChecksum?: boolean;
  overwrite?: boolean;
}

/**
 * Restore result
 */
export interface RestoreResult {
  backupId: string;
  filesRestored: number;
  totalSize: number;
  duration: number;
  errors: string[];
}

/**
 * Restore Manager
 */
export class RestoreManager extends EventEmitter {
  private db: Database.Database;
  private backupDir: string;

  constructor(dbPath: string, backupDir: string) {
    super();
    this.db = new Database(dbPath);
    this.backupDir = backupDir;
  }

  /**
   * Restore from backup
   */
  async restore(backupId: string, options: RestoreOptions): Promise<RestoreResult> {
    logger.info(`Starting restore from backup: ${backupId}`);

    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Get backup metadata
      const backup = this.getBackupMetadata(backupId);
      if (!backup) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      // Verify password if encrypted
      if (backup.encrypted && !options.password) {
        throw new Error('Password required for encrypted backup');
      }

      // Build restore chain (for incremental backups)
      const restoreChain = this.buildRestoreChain(backupId);
      logger.info(`Restore chain: ${restoreChain.map(b => b.id).join(' -> ')}`);

      // Create target directory
      await mkdir(options.targetDir, { recursive: true });

      let filesRestored = 0;
      let totalSize = 0;

      // Restore each backup in chain (oldest first)
      for (const chainBackup of restoreChain) {
        const files = this.getBackupFiles(chainBackup.id);
        logger.info(`Restoring ${files.length} files from ${chainBackup.id}`);

        for (const file of files) {
          try {
            const sourcePath = join(this.backupDir, chainBackup.id, file.filePath);
            const targetPath = join(options.targetDir, file.filePath);

            // Check if file exists
            if (!options.overwrite) {
              try {
                await readFile(targetPath);
                logger.warn(`File exists, skipping: ${file.filePath}`);
                continue;
              } catch (error: unknown) {
                logger.warn('File check failed, proceeding with restore:', error instanceof Error ? error : new Error(String(error)));
                // File doesn't exist, proceed
              }
            }

            // Create target directory
            await mkdir(dirname(targetPath), { recursive: true });

            // Restore file
            await this.restoreFile(
              sourcePath,
              targetPath,
              chainBackup.encrypted,
              chainBackup.compressed,
              options.password
            );

            // Verify checksum if requested
            if (options.verifyChecksum) {
              const restoredChecksum = await this.calculateFileChecksum(targetPath);
              if (restoredChecksum !== file.checksum) {
                throw new Error(`Checksum mismatch for ${file.filePath}`);
              }
            }

            filesRestored++;
            totalSize += file.size;

            this.emit('file-restored', { file: file.filePath, size: file.size });
          } catch (error: any) {
            const errorMsg = `Failed to restore ${file.filePath}: ${error.message}`;
            logger.error(errorMsg);
            errors.push(errorMsg);
          }
        }
      }

      const duration = Date.now() - startTime;

      const result: RestoreResult = {
        backupId,
        filesRestored,
        totalSize,
        duration,
        errors
      };

      logger.info(
        `Restore completed: ${filesRestored} files restored (${totalSize} bytes) in ${duration}ms`
      );

      if (errors.length > 0) {
        logger.warn(`Restore completed with ${errors.length} errors`);
      }

      this.emit('restore-completed', result);

      return result;
    } catch (error: any) {
      logger.error('Restore failed:', error as Error);
      throw error;
    }
  }

  /**
   * Restore single file
   */
  private async restoreFile(
    sourcePath: string,
    targetPath: string,
    encrypted: boolean,
    compressed: boolean,
    password?: string
  ): Promise<void> {
    if (compressed && encrypted) {
      // Decrypt and decompress
      await this.decryptAndDecompress(sourcePath, targetPath, password!);
    } else if (compressed) {
      // Decompress only
      await this.decompressFile(sourcePath, targetPath);
    } else if (encrypted) {
      // Decrypt only
      await this.decryptFile(sourcePath, targetPath, password!);
    } else {
      // Copy as-is
      await pipeline(
        createReadStream(sourcePath),
        createWriteStream(targetPath)
      );
    }
  }

  /**
   * Decompress file
   */
  private async decompressFile(sourcePath: string, targetPath: string): Promise<void> {
    await pipeline(
      createReadStream(sourcePath + '.gz'),
      createGunzip(),
      createWriteStream(targetPath)
    );
  }

  /**
   * Decrypt file
   */
  private async decryptFile(sourcePath: string, targetPath: string, password: string): Promise<void> {
    const key = await this.deriveKey(password);

    // Read IV from file
    const encFile = createReadStream(sourcePath + '.enc');
    const iv = await new Promise<Buffer>((resolve, reject) => {
      encFile.once('readable', () => {
        const iv = encFile.read(16);
        if (iv) resolve(iv);
        else reject(new Error('Failed to read IV'));
      });
      encFile.once('error', reject);
    });

    // Read auth tag
    const authTag = await readFile(sourcePath + '.tag');

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const output = createWriteStream(targetPath);

    await pipeline(encFile, decipher, output);
  }

  /**
   * Decrypt and decompress file
   */
  private async decryptAndDecompress(sourcePath: string, targetPath: string, password: string): Promise<void> {
    const key = await this.deriveKey(password);

    const encFile = createReadStream(sourcePath + '.gz.enc');
    const iv = await new Promise<Buffer>((resolve, reject) => {
      encFile.once('readable', () => {
        const iv = encFile.read(16);
        if (iv) resolve(iv);
        else reject(new Error('Failed to read IV'));
      });
      encFile.once('error', reject);
    });

    const authTag = await readFile(sourcePath + '.tag');

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const gunzip = createGunzip();
    const output = createWriteStream(targetPath);

    await pipeline(encFile, decipher, gunzip, output);
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
   * Build restore chain for incremental backups
   */
  private buildRestoreChain(backupId: string): BackupMetadata[] {
    const chain: BackupMetadata[] = [];
    let currentId: string | undefined = backupId;

    while (currentId) {
      const backup = this.getBackupMetadata(currentId);
      if (!backup) break;

      chain.unshift(backup); // Add to beginning
      currentId = backup.parentBackupId;
    }

    return chain;
  }

  /**
   * Get backup metadata
   */
  private getBackupMetadata(backupId: string): BackupMetadata | null {
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
   * Get backup files
   */
  private getBackupFiles(backupId: string): Array<{
    filePath: string;
    size: number;
    modifiedTime: number;
    checksum: string;
  }> {
    return this.db
      .prepare('SELECT * FROM backup_files WHERE backupId = ?')
      .all(backupId) as any[];
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
   * List available backups
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
   * Verify backup integrity
   */
  async verifyBackup(backupId: string, password?: string): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    logger.info(`Verifying backup: ${backupId}`);

    const errors: string[] = [];

    try {
      const backup = this.getBackupMetadata(backupId);
      if (!backup) {
        errors.push(`Backup not found: ${backupId}`);
        return { valid: false, errors };
      }

      if (backup.encrypted && !password) {
        errors.push('Password required for encrypted backup');
        return { valid: false, errors };
      }

      const files = this.getBackupFiles(backupId);

      for (const file of files) {
        const sourcePath = join(this.backupDir, backupId, file.filePath);

        try {
          // Try to read the file
          await readFile(sourcePath + (backup.compressed ? '.gz' : '') + (backup.encrypted ? '.enc' : ''));
        } catch (error: any) {
          errors.push(`File missing or unreadable: ${file.filePath}`);
        }
      }

      const valid = errors.length === 0;

      logger.info(`Backup verification ${valid ? 'passed' : 'failed'}: ${backupId}`);

      return { valid, errors };
    } catch (error: any) {
      logger.error('Backup verification failed:', error as Error);
      errors.push(error.message);
      return { valid: false, errors };
    }
  }

  /**
   * Close and cleanup
   */
  close(): void {
    if (this.db) {
      this.db.close();
      logger.info('Restore manager closed');
    }
  }
}
