import { EventEmitter } from 'events';
import * as parcelWatcher from '@parcel/watcher';
import { relative, normalize } from 'path';
import { existsSync, statSync } from 'fs';
import { createLogger } from '../utils/logger';

const logger = createLogger('FileWatcher');

import type {
  FileChangeEvent,
  FileChangeType,
  FileWatcherOptions,
  WatcherState,
  IFileWatcher,
} from '../types/watcher.js';

/**
 * File Watcher System
 *
 * Cross-platform file monitoring using @parcel/watcher with hot reload support.
 * Provides event-driven file change detection with automatic error recovery.
 *
 * @module watcher/file-watcher
 */

/**
 * Default ignore patterns
 */
const DEFAULT_IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/.next/**',
  '**/.cache/**',
  '**/dist/**',
  '**/build/**',
  '**/.turbo/**',
  '**/.vercel/**',
  '**/coverage/**',
  '**/.DS_Store',
  '**/*.log',
  '**/.env*',
];

/**
 * FileWatcher - Cross-platform file monitoring system
 *
 * Features:
 * - Uses @parcel/watcher for efficient native file watching
 * - Event-driven architecture (create/update/delete events)
 * - Multi-path watching with individual subscriptions
 * - Automatic error recovery with configurable retry
 * - Debouncing to reduce event noise
 * - Ignore patterns support (glob-based)
 *
 * @example
 * ```typescript
 * const watcher = new FileWatcher({
 *   paths: ['/path/to/skills', '/path/to/plugins'],
 *   ignore: ['*.log', 'node_modules'],
 *   debounceMs: 100,
 * });
 *
 * watcher.on('change', (event: FileChangeEvent) => {
 *   console.log(`${event.type}: ${event.relativePath}`);
 * });
 *
 * await watcher.start();
 * ```
 */
export class FileWatcher extends EventEmitter implements IFileWatcher {
  private _state: WatcherState = 'idle';
  private subscriptions = new Map<string, parcelWatcher.AsyncSubscription>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private retryAttempts = new Map<string, number>();
  private pendingChanges = new Map<string, FileChangeEvent>();

  constructor(private options: FileWatcherOptions) {
    super();

    // Normalize paths
    const paths = Array.isArray(options.paths) ? options.paths : [options.paths];
    this.options.paths = paths.map((p) => normalize(p));

    // Merge ignore patterns
    this.options.ignore = [
      ...DEFAULT_IGNORE_PATTERNS,
      ...(options.ignore || []),
    ];

    // Set defaults
    this.options.recursive = options.recursive !== false;
    this.options.debounceMs = options.debounceMs ?? 50;
    this.options.autoRetry = options.autoRetry !== false;
    this.options.maxRetries = options.maxRetries ?? 3;
    this.options.retryDelayMs = options.retryDelayMs ?? 1000;
  }

  /**
   * Current watcher state
   */
  get state(): WatcherState {
    return this._state;
  }

  /**
   * Start watching all configured paths
   */
  async start(): Promise<void> {
    if (this._state === 'active') {
      throw new Error('FileWatcher is already active');
    }

    if (this._state === 'closed') {
      throw new Error('FileWatcher is closed, create a new instance');
    }

    this._state = 'starting';

    try {
      const paths = this.getWatchedPaths();

      // Validate paths exist
      for (const path of paths) {
        if (!existsSync(path)) {
          throw new Error(`Watch path does not exist: ${path}`);
        }

        if (!statSync(path).isDirectory()) {
          throw new Error(`Watch path is not a directory: ${path}`);
        }
      }

      // Start watching each path
      await Promise.all(paths.map((path) => this.watchPath(path)));

      this._state = 'active';
      this.emit('ready');
    } catch (error) {
      this._state = 'error';
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop watching all paths
   */
  async stop(): Promise<void> {
    if (this._state === 'closed') {
      return;
    }

    this._state = 'closed';

    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.pendingChanges.clear();

    // Unsubscribe from all paths
    const unsubscribePromises = Array.from(this.subscriptions.entries()).map(
      async ([path, subscription]) => {
        try {
          await subscription.unsubscribe();
          this.subscriptions.delete(path);
        } catch (error) {
          logger.error(`Failed to unsubscribe from ${path}:`, error as Error);
        }
      }
    );

    await Promise.all(unsubscribePromises);

    this.emit('close');
  }

  /**
   * Add a new path to watch
   */
  async addPath(path: string): Promise<void> {
    const normalizedPath = normalize(path);

    if (this.subscriptions.has(normalizedPath)) {
      logger.warn(`Path already watched: ${normalizedPath}`);
      return;
    }

    if (!existsSync(normalizedPath)) {
      throw new Error(`Path does not exist: ${normalizedPath}`);
    }

    // Add to paths array
    const paths = Array.isArray(this.options.paths)
      ? this.options.paths
      : [this.options.paths];

    if (!paths.includes(normalizedPath)) {
      paths.push(normalizedPath);
      this.options.paths = paths;
    }

    // Start watching if watcher is active
    if (this._state === 'active') {
      await this.watchPath(normalizedPath);
    }
  }

  /**
   * Remove a path from watching
   */
  async removePath(path: string): Promise<void> {
    const normalizedPath = normalize(path);
    const subscription = this.subscriptions.get(normalizedPath);

    if (!subscription) {
      logger.warn(`Path not watched: ${normalizedPath}`);
      return;
    }

    try {
      await subscription.unsubscribe();
      this.subscriptions.delete(normalizedPath);
      this.retryAttempts.delete(normalizedPath);

      // Remove from paths array
      const paths = Array.isArray(this.options.paths)
        ? this.options.paths
        : [this.options.paths];

      this.options.paths = paths.filter((p) => p !== normalizedPath);
    } catch (error) {
      logger.error(`Failed to remove path ${normalizedPath}:`, error as Error);
      throw error;
    }
  }

  /**
   * Get all watched paths
   */
  getWatchedPaths(): string[] {
    return Array.isArray(this.options.paths)
      ? this.options.paths
      : [this.options.paths];
  }

  /**
   * Watch a specific path
   */
  private async watchPath(watchRoot: string): Promise<void> {
    try {
      const subscribeOptions: parcelWatcher.Options = {
        ignore: this.options.ignore,
      };

      if (this.options.backend) {
        subscribeOptions.backend = this.options.backend;
      }

      const subscription = await parcelWatcher.subscribe(
        watchRoot,
        (err, events) => {
          if (err) {
            this.handleWatchError(watchRoot, err);
            return;
          }

          this.handleEvents(watchRoot, events);
        },
        subscribeOptions
      );

      this.subscriptions.set(watchRoot, subscription);
      this.retryAttempts.delete(watchRoot);
    } catch (error) {
      await this.handleWatchError(watchRoot, error as Error);
    }
  }

  /**
   * Handle file system events
   */
  private handleEvents(
    watchRoot: string,
    events: parcelWatcher.Event[]
  ): void {
    for (const event of events) {
      const relativePath = relative(watchRoot, event.path);

      // Skip if no relative path (shouldn't happen but be safe)
      if (!relativePath) {
        continue;
      }

      // Skip if not recursive and path contains subdirectories
      if (!this.options.recursive) {
        if (relativePath.includes('/') || relativePath.includes('\\')) {
          continue;
        }
      }

      // Map @parcel/watcher event types to our types
      const changeType = this.mapEventType(event.type);

      const changeEvent: FileChangeEvent = {
        type: changeType,
        path: event.path,
        relativePath,
        timestamp: Date.now(),
      };

      // Debounce the event
      this.debounceEvent(changeEvent);
    }
  }

  /**
   * Map @parcel/watcher event types to our event types
   */
  private mapEventType(type: parcelWatcher.EventType): FileChangeType {
    switch (type) {
      case 'create':
        return 'create';
      case 'update':
        return 'update';
      case 'delete':
        return 'delete';
      default:
        return 'update';
    }
  }

  /**
   * Debounce file change events
   */
  private debounceEvent(event: FileChangeEvent): void {
    const key = `${event.type}:${event.path}`;

    // Store the latest event
    this.pendingChanges.set(key, event);

    // Clear existing timer
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      const pendingEvent = this.pendingChanges.get(key);
      if (pendingEvent) {
        this.pendingChanges.delete(key);
        this.debounceTimers.delete(key);
        this.emit('change', pendingEvent);
      }
    }, this.options.debounceMs);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Handle watch errors with auto-retry
   */
  private async handleWatchError(
    watchRoot: string,
    error: Error
  ): Promise<void> {
    logger.error(`Error watching ${watchRoot}:`, error as Error);

    this.emit('error', error);

    // Check if auto-retry is enabled
    if (!this.options.autoRetry) {
      this._state = 'error';
      return;
    }

    // Check retry attempts
    const attempts = this.retryAttempts.get(watchRoot) || 0;

    if (attempts >= this.options.maxRetries!) {
      logger.error(`Max retries (${this.options.maxRetries}) exceeded for ${watchRoot}`);
      this._state = 'error';
      return;
    }

    // Increment retry counter
    this.retryAttempts.set(watchRoot, attempts + 1);

    // Retry after delay
    logger.info(
      `Retrying ${watchRoot} (attempt ${attempts + 1}/${
        this.options.maxRetries
      })...`
    );

    setTimeout(() => {
      if (this._state !== 'closed') {
        this.watchPath(watchRoot).catch((err) => {
          logger.error(`Retry failed for ${watchRoot}:`, err as Error);
        });
      }
    }, this.options.retryDelayMs);
  }
}
