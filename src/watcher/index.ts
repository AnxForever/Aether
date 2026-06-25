/**
 * Watcher Module Exports
 *
 * @module watcher
 */

export { FileWatcher } from './file-watcher.js';
export { HotReloadManager } from './hot-reload-manager.js';
export { HotReload, createHotReload } from './hot-reload.js';
export type {
  FileChangeEvent,
  FileChangeType,
  FileWatcherOptions,
  HotReloadOptions,
  WatcherState,
  WatcherSubscription,
  IFileWatcher,
} from '../types/watcher.js';
export type { HotReloadConfig } from './hot-reload.js';
