/**
 * Hot Reload Manager
 *
 * Manages hot reload functionality for skills, plugins, and configurations.
 * Debounces file changes and triggers appropriate reload actions.
 *
 * @module watcher/hot-reload-manager
 */

import { EventEmitter } from 'events';
import { Minimatch } from 'minimatch';
import type {
  FileChangeEvent,
  HotReloadOptions,
} from '../types/watcher.js';
import type { FileWatcher } from './file-watcher.js';

/**
 * Hot reload change batch
 */
interface HotReloadBatch {
  changes: FileChangeEvent[];
  timer: NodeJS.Timeout;
}

/**
 * HotReloadManager - Manages hot reload functionality
 *
 * Features:
 * - Pattern-based file matching (glob patterns)
 * - Batched reload (debouncing multiple rapid changes)
 * - Async reload handlers
 * - Error handling and recovery
 *
 * @example
 * ```typescript
 * const manager = new HotReloadManager(fileWatcher, {
 *   patterns: ['*.ts', '*.js', '*.json'],
 *   debounceMs: 200,
 *   onReload: async (changes) => {
 *     console.log('Reloading:', changes.length, 'files');
 *     await reloadModule(changes);
 *   },
 *   onError: (error) => {
 *     console.error('Reload failed:', error);
 *   },
 * });
 *
 * manager.start();
 * ```
 */
export class HotReloadManager extends EventEmitter {
  private isActive = false;
  private pendingBatch: HotReloadBatch | null = null;
  private reloadInProgress = false;

  constructor(
    private watcher: FileWatcher,
    private options: HotReloadOptions = {}
  ) {
    super();

    // Set defaults
    this.options.patterns = options.patterns || ['**/*.ts', '**/*.js', '**/*.json'];
    this.options.debounceMs = options.debounceMs ?? 100;
  }

  /**
   * Start hot reload manager
   */
  start(): void {
    if (this.isActive) {
      console.warn('[HotReloadManager] Already active');
      return;
    }

    this.isActive = true;

    // Listen to file changes from watcher
    this.watcher.on('change', this.handleFileChange.bind(this));

    this.emit('start');
  }

  /**
   * Stop hot reload manager
   */
  stop(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;

    // Remove listener
    this.watcher.off('change', this.handleFileChange.bind(this));

    // Cancel pending batch
    if (this.pendingBatch) {
      clearTimeout(this.pendingBatch.timer);
      this.pendingBatch = null;
    }

    this.emit('stop');
  }

  /**
   * Check if manager is active
   */
  get active(): boolean {
    return this.isActive;
  }

  /**
   * Handle file change event
   */
  private handleFileChange(event: FileChangeEvent): void {
    if (!this.isActive) {
      return;
    }

    // Check if file matches any pattern
    if (!this.matchesPatterns(event.relativePath)) {
      return;
    }

    // Add to pending batch
    this.addToBatch(event);
  }

  /**
   * Check if file path matches any of the configured patterns
   */
  private matchesPatterns(filePath: string): boolean {
    const patterns = this.options.patterns || [];

    for (const pattern of patterns) {
      const matcher = new Minimatch(pattern);
      if (matcher.match(filePath)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Add change event to pending batch
   */
  private addToBatch(event: FileChangeEvent): void {
    // Cancel existing timer
    if (this.pendingBatch) {
      clearTimeout(this.pendingBatch.timer);
    } else {
      // Create new batch
      this.pendingBatch = {
        changes: [],
        timer: null as any,
      };
    }

    // Add change to batch (avoid duplicates)
    const existingIndex = this.pendingBatch.changes.findIndex(
      (c) => c.path === event.path && c.type === event.type
    );

    if (existingIndex >= 0) {
      // Update existing event with latest timestamp
      this.pendingBatch.changes[existingIndex] = event;
    } else {
      // Add new event
      this.pendingBatch.changes.push(event);
    }

    // Set new timer
    this.pendingBatch.timer = setTimeout(() => {
      this.processBatch();
    }, this.options.debounceMs);
  }

  /**
   * Process pending batch
   */
  private async processBatch(): Promise<void> {
    if (!this.pendingBatch || this.pendingBatch.changes.length === 0) {
      return;
    }

    // Prevent concurrent reloads
    if (this.reloadInProgress) {
      console.warn('[HotReloadManager] Reload already in progress, skipping batch');
      return;
    }

    const batch = this.pendingBatch;
    this.pendingBatch = null;
    this.reloadInProgress = true;

    try {
      // Emit reload event
      this.emit('reload', batch.changes);

      // Call reload handler if provided
      if (this.options.onReload) {
        await this.options.onReload(batch.changes);
      }

      console.log(
        `[HotReloadManager] Reloaded ${batch.changes.length} file(s):`
      );
      for (const change of batch.changes) {
        console.log(`  - ${change.type}: ${change.relativePath}`);
      }
    } catch (error) {
      console.error('[HotReloadManager] Reload failed:', error);
      this.emit('error', error);

      // Call error handler if provided
      if (this.options.onError) {
        this.options.onError(error as Error);
      }
    } finally {
      this.reloadInProgress = false;
    }
  }

  /**
   * Force immediate reload of pending changes
   */
  async forceReload(): Promise<void> {
    if (this.pendingBatch) {
      clearTimeout(this.pendingBatch.timer);
      await this.processBatch();
    }
  }

  /**
   * Get pending changes count
   */
  getPendingCount(): number {
    return this.pendingBatch ? this.pendingBatch.changes.length : 0;
  }
}
