/**
 * Hot Reload System
 *
 * Simplified hot reload for skills and plugins using the existing
 * file watcher and hot reload manager.
 *
 * @module watcher/hot-reload
 */

import { EventEmitter } from 'events';
import { FileWatcher } from './file-watcher.js';
import { HotReloadManager } from './hot-reload-manager.js';
import type { FileChangeEvent } from '../types/watcher.js';

// ============================================================================
// Type Definitions
// ============================================================================

export interface HotReloadConfig {
  watchPaths: string[];
  patterns?: string[];
  debounceMs?: number;
  onReload?: (changes: FileChangeEvent[]) => Promise<void>;
}

// ============================================================================
// HotReload Class
// ============================================================================

/**
 * HotReload - Simplified hot reload system
 *
 * Wraps FileWatcher and HotReloadManager for easy setup
 */
export class HotReload extends EventEmitter {
  private watcher: FileWatcher;
  private manager: HotReloadManager;

  constructor(private config: HotReloadConfig) {
    super();

    // Create file watcher
    this.watcher = new FileWatcher({
      paths: config.watchPaths,
      recursive: true,
    });

    // Create hot reload manager
    this.manager = new HotReloadManager(this.watcher, {
      patterns: config.patterns,
      debounceMs: config.debounceMs,
      onReload: async (changes) => {
        this.emit('reload', changes);
        if (this.config.onReload) {
          await this.config.onReload(changes);
        }
      },
      onError: (error) => {
        this.emit('error', error);
      },
    });

    // Forward events
    this.watcher.on('error', (error) => this.emit('error', error));
  }

  /**
   * Start hot reload
   */
  async start(): Promise<void> {
    await this.watcher.start();
    this.manager.start();
    this.emit('ready');
  }

  /**
   * Stop hot reload
   */
  async stop(): Promise<void> {
    this.manager.stop();
    await this.watcher.stop();
  }

  /**
   * Get watcher instance
   */
  getWatcher(): FileWatcher {
    return this.watcher;
  }

  /**
   * Get manager instance
   */
  getManager(): HotReloadManager {
    return this.manager;
  }
}

export function createHotReload(config: HotReloadConfig): HotReload {
  return new HotReload(config);
}

export default HotReload;
