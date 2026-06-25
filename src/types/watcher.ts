/**
 * File Watcher Type Definitions
 *
 * @module types/watcher
 */

import type { EventEmitter } from 'events';

/**
 * File change event types
 */
export type FileChangeType = 'create' | 'update' | 'delete';

/**
 * File change event
 */
export interface FileChangeEvent {
  /** Event type */
  type: FileChangeType;
  /** Absolute file path */
  path: string;
  /** Relative path from watch root */
  relativePath: string;
  /** Timestamp of the change */
  timestamp: number;
}

/**
 * Watcher state
 */
export type WatcherState = 'idle' | 'starting' | 'active' | 'error' | 'closed';

/**
 * File watcher options
 */
export interface FileWatcherOptions {
  /** Watch path(s) - can be single path or array */
  paths: string | string[];

  /** Recursive watching (default: true) */
  recursive?: boolean;

  /** Ignore patterns (glob patterns) */
  ignore?: string[];

  /** Backend to use (@parcel/watcher supports multiple backends) */
  backend?: 'fs-events' | 'watchman' | 'inotify' | 'windows';

  /** Debounce delay in milliseconds (default: 50) */
  debounceMs?: number;

  /** Auto-retry on error (default: true) */
  autoRetry?: boolean;

  /** Max retry attempts (default: 3) */
  maxRetries?: number;

  /** Retry delay in milliseconds (default: 1000) */
  retryDelayMs?: number;
}

/**
 * Hot reload options
 */
export interface HotReloadOptions {
  /** Patterns to watch for hot reload */
  patterns?: string[];

  /** Delay before triggering reload (ms, default: 100) */
  debounceMs?: number;

  /** Callback on reload */
  onReload?: (changes: FileChangeEvent[]) => void | Promise<void>;

  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Watcher subscription
 */
export interface WatcherSubscription {
  /** Unsubscribe from watcher */
  unsubscribe(): Promise<void>;
}

/**
 * File watcher interface
 */
export interface IFileWatcher extends EventEmitter {
  /** Current watcher state */
  readonly state: WatcherState;

  /** Start watching */
  start(): Promise<void>;

  /** Stop watching */
  stop(): Promise<void>;

  /** Add path to watch */
  addPath(path: string): Promise<void>;

  /** Remove path from watch */
  removePath(path: string): Promise<void>;

  /** Get watched paths */
  getWatchedPaths(): string[];
}
