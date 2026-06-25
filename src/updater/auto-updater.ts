import { EventEmitter } from 'events';
import { app } from 'electron';
import { autoUpdater as electronUpdater } from 'electron-updater';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Type Definitions
// ============================================================================

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error';

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
  size: number;
}

export interface UpdateProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export interface AutoUpdaterConfig {
  autoCheck?: boolean;
  autoDownload?: boolean;
  autoInstall?: boolean;
  checkInterval?: number;
  allowPrerelease?: boolean;
  allowDowngrade?: boolean;
  updateUrl?: string;
}

interface UpdateState {
  version: string;
  lastChecked: number;
  lastUpdated?: number;
  skipVersion?: string;
}

// ============================================================================
// AutoUpdater Class
// ============================================================================

export class AutoUpdater extends EventEmitter {
  private status: UpdateStatus = 'idle';
  private currentVersion: string;
  private updateInfo: UpdateInfo | null = null;
  private checkTimer: NodeJS.Timeout | null = null;
  private stateFilePath: string;
  private state: UpdateState;

  constructor(private config: AutoUpdaterConfig = {}) {
    super();

    this.currentVersion = app.getVersion();
    this.stateFilePath = path.join(app.getPath('userData'), 'updater-state.json');
    this.state = this.loadState();

    // Set defaults
    this.config.autoCheck = config.autoCheck !== false;
    this.config.autoDownload = config.autoDownload !== false;
    this.config.autoInstall = config.autoInstall ?? false;
    this.config.checkInterval = config.checkInterval || 3600000; // 1 hour
    this.config.allowPrerelease = config.allowPrerelease ?? false;
    this.config.allowDowngrade = config.allowDowngrade ?? false;

    this.setupElectronUpdater();
  }

  /**
   * Setup electron-updater
   */
  private setupElectronUpdater(): void {
    electronUpdater.autoDownload = this.config.autoDownload!;
    electronUpdater.autoInstallOnAppQuit = this.config.autoInstall!;
    electronUpdater.allowPrerelease = this.config.allowPrerelease!;
    electronUpdater.allowDowngrade = this.config.allowDowngrade!;

    if (this.config.updateUrl) {
      electronUpdater.setFeedURL({ url: this.config.updateUrl } as any);
    }

    electronUpdater.on('checking-for-update', () => {
      this.setStatus('checking');
    });

    electronUpdater.on('update-available', (info) => {
      this.updateInfo = {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes as string,
        size: (info.files && info.files[0]?.size) || 0,
      };

      // Check if version should be skipped
      if (this.state.skipVersion === info.version) {
        this.setStatus('not-available');
        return;
      }

      this.setStatus('available');
      this.emit('update-available', this.updateInfo);
    });

    electronUpdater.on('update-not-available', () => {
      this.setStatus('not-available');
      this.emit('update-not-available');
    });

    electronUpdater.on('download-progress', (progress) => {
      this.setStatus('downloading');
      this.emit('download-progress', progress as UpdateProgress);
    });

    electronUpdater.on('update-downloaded', (info) => {
      this.setStatus('downloaded');
      this.emit('update-downloaded', {
        version: info.version,
        releaseDate: info.releaseDate,
      });
    });

    electronUpdater.on('error', (error) => {
      this.setStatus('error');
      this.emit('error', error);
    });
  }

  /**
   * Initialize updater
   */
  async initialize(): Promise<void> {
    if (this.config.autoCheck) {
      await this.checkForUpdates();
      this.startAutoCheck();
    }

    this.emit('ready');
  }

  /**
   * Check for updates
   */
  async checkForUpdates(): Promise<UpdateInfo | null> {
    try {
      this.setStatus('checking');
      this.state.lastChecked = Date.now();
      this.saveState();

      const result = await electronUpdater.checkForUpdates();
      return result ? this.updateInfo : null;
    } catch (error) {
      this.setStatus('error');
      throw error;
    }
  }

  /**
   * Download update
   */
  async downloadUpdate(): Promise<void> {
    if (this.status !== 'available') {
      throw new Error('No update available');
    }

    try {
      this.setStatus('downloading');
      await electronUpdater.downloadUpdate();
    } catch (error) {
      this.setStatus('error');
      throw error;
    }
  }

  /**
   * Install update and restart
   */
  quitAndInstall(): void {
    if (this.status !== 'downloaded') {
      throw new Error('Update not downloaded');
    }

    this.setStatus('installing');
    this.state.lastUpdated = Date.now();
    this.saveState();

    electronUpdater.quitAndInstall(false, true);
  }

  /**
   * Skip version
   */
  skipVersion(version: string): void {
    this.state.skipVersion = version;
    this.saveState();
    this.emit('version-skipped', version);
  }

  /**
   * Get current status
   */
  getStatus(): UpdateStatus {
    return this.status;
  }

  /**
   * Get current version
   */
  getCurrentVersion(): string {
    return this.currentVersion;
  }

  /**
   * Get update info
   */
  getUpdateInfo(): UpdateInfo | null {
    return this.updateInfo;
  }

  /**
   * Start automatic update checks
   */
  private startAutoCheck(): void {
    this.stopAutoCheck();

    this.checkTimer = setInterval(() => {
      this.checkForUpdates().catch((error) => {
        console.error('[AutoUpdater] Auto-check failed:', error);
      });
    }, this.config.checkInterval);
  }

  /**
   * Stop automatic update checks
   */
  private stopAutoCheck(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  /**
   * Set status and emit event
   */
  private setStatus(status: UpdateStatus): void {
    this.status = status;
    this.emit('status', status);
  }

  /**
   * Load state from disk
   */
  private loadState(): UpdateState {
    try {
      const content = fs.readFileSync(this.stateFilePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {
        version: this.currentVersion,
        lastChecked: 0,
      };
    }
  }

  /**
   * Save state to disk
   */
  private saveState(): void {
    try {
      fs.writeFileSync(this.stateFilePath, JSON.stringify(this.state, null, 2));
    } catch (error) {
      console.error('[AutoUpdater] Failed to save state:', error);
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopAutoCheck();
    this.removeAllListeners();
  }
}

export function createAutoUpdater(config?: AutoUpdaterConfig): AutoUpdater {
  return new AutoUpdater(config);
}

export default AutoUpdater;
