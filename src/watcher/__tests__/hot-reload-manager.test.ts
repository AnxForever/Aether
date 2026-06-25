/**
 * Hot Reload Manager Tests
 *
 * @module watcher/__tests__/hot-reload-manager.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileWatcher } from '../file-watcher.js';
import { HotReloadManager } from '../hot-reload-manager.js';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { FileChangeEvent } from '../../types/watcher.js';

describe('HotReloadManager', () => {
  let testDir: string;
  let watcher: FileWatcher;
  let hotReload: HotReloadManager;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'hot-reload-test-'));
  });

  afterEach(async () => {
    if (hotReload) {
      hotReload.stop();
    }
    if (watcher) {
      await watcher.stop();
    }
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should initialize with default options', () => {
      watcher = new FileWatcher({ paths: testDir });
      hotReload = new HotReloadManager(watcher);

      expect(hotReload.active).toBe(false);
    });

    it('should initialize with custom patterns', () => {
      watcher = new FileWatcher({ paths: testDir });
      hotReload = new HotReloadManager(watcher, {
        patterns: ['*.ts', '*.js'],
        debounceMs: 200,
      });

      expect(hotReload['options'].patterns).toEqual(['*.ts', '*.js']);
      expect(hotReload['options'].debounceMs).toBe(200);
    });
  });

  describe('start/stop', () => {
    it('should start hot reload manager', async () => {
      watcher = new FileWatcher({ paths: testDir });
      hotReload = new HotReloadManager(watcher);

      const startPromise = new Promise((resolve) => {
        hotReload.once('start', resolve);
      });

      hotReload.start();
      await startPromise;

      expect(hotReload.active).toBe(true);
    });

    it('should stop hot reload manager', async () => {
      watcher = new FileWatcher({ paths: testDir });
      hotReload = new HotReloadManager(watcher);

      hotReload.start();

      const stopPromise = new Promise((resolve) => {
        hotReload.once('stop', resolve);
      });

      hotReload.stop();
      await stopPromise;

      expect(hotReload.active).toBe(false);
    });
  });

  describe('pattern matching', () => {
    it('should match files against patterns', async () => {
      watcher = new FileWatcher({
        paths: testDir,
        debounceMs: 10,
      });

      hotReload = new HotReloadManager(watcher, {
        patterns: ['**/*.ts', '**/*.js'],
        debounceMs: 50,
      });

      const reloads: FileChangeEvent[][] = [];
      hotReload.on('reload', (changes: FileChangeEvent[]) => {
        reloads.push(changes);
      });

      await watcher.start();
      hotReload.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create matching file
      writeFileSync(join(testDir, 'test.ts'), 'content');

      // Create non-matching file
      writeFileSync(join(testDir, 'test.txt'), 'content');

      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(reloads.length).toBeGreaterThan(0);
      expect(reloads[0].some((c) => c.relativePath.endsWith('.ts'))).toBe(true);
      expect(reloads[0].some((c) => c.relativePath.endsWith('.txt'))).toBe(false);
    });
  });

  describe('debouncing', () => {
    it('should batch multiple changes', async () => {
      watcher = new FileWatcher({
        paths: testDir,
        debounceMs: 10,
      });

      hotReload = new HotReloadManager(watcher, {
        patterns: ['**/*.ts'],
        debounceMs: 100,
      });

      const reloads: FileChangeEvent[][] = [];
      hotReload.on('reload', (changes: FileChangeEvent[]) => {
        reloads.push(changes);
      });

      await watcher.start();
      hotReload.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Make multiple rapid changes
      writeFileSync(join(testDir, 'file1.ts'), 'content1');
      writeFileSync(join(testDir, 'file2.ts'), 'content2');
      writeFileSync(join(testDir, 'file3.ts'), 'content3');

      await new Promise((resolve) => setTimeout(resolve, 300));

      // Should batch into single reload
      expect(reloads.length).toBe(1);
      expect(reloads[0].length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('reload callback', () => {
    it('should call onReload callback', async () => {
      watcher = new FileWatcher({
        paths: testDir,
        debounceMs: 10,
      });

      const onReload = vi.fn();

      hotReload = new HotReloadManager(watcher, {
        patterns: ['**/*.ts'],
        debounceMs: 50,
        onReload,
      });

      await watcher.start();
      hotReload.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      writeFileSync(join(testDir, 'test.ts'), 'content');

      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(onReload).toHaveBeenCalled();
      expect(onReload.mock.calls[0][0].length).toBeGreaterThan(0);
    });

    it('should call onError callback on reload failure', async () => {
      watcher = new FileWatcher({
        paths: testDir,
        debounceMs: 10,
      });

      const onError = vi.fn();
      const onReload = vi.fn().mockRejectedValue(new Error('Reload failed'));

      hotReload = new HotReloadManager(watcher, {
        patterns: ['**/*.ts'],
        debounceMs: 50,
        onReload,
        onError,
      });

      await watcher.start();
      hotReload.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      writeFileSync(join(testDir, 'test.ts'), 'content');

      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][0].message).toBe('Reload failed');
    });
  });

  describe('force reload', () => {
    it('should force immediate reload', async () => {
      watcher = new FileWatcher({
        paths: testDir,
        debounceMs: 10,
      });

      hotReload = new HotReloadManager(watcher, {
        patterns: ['**/*.ts'],
        debounceMs: 5000, // Long debounce
      });

      const reloads: FileChangeEvent[][] = [];
      hotReload.on('reload', (changes: FileChangeEvent[]) => {
        reloads.push(changes);
      });

      await watcher.start();
      hotReload.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      writeFileSync(join(testDir, 'test.ts'), 'content');

      // Don't wait for debounce, force reload immediately
      await new Promise((resolve) => setTimeout(resolve, 100));
      await hotReload.forceReload();

      expect(reloads.length).toBe(1);
    });
  });

  describe('pending count', () => {
    it('should track pending changes', async () => {
      watcher = new FileWatcher({
        paths: testDir,
        debounceMs: 10,
      });

      hotReload = new HotReloadManager(watcher, {
        patterns: ['**/*.ts'],
        debounceMs: 5000, // Long debounce
      });

      await watcher.start();
      hotReload.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(hotReload.getPendingCount()).toBe(0);

      writeFileSync(join(testDir, 'test.ts'), 'content');

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(hotReload.getPendingCount()).toBeGreaterThan(0);

      await hotReload.forceReload();

      expect(hotReload.getPendingCount()).toBe(0);
    });
  });
});
