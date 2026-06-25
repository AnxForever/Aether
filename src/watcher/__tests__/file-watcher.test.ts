/**
 * File Watcher Tests
 *
 * @module watcher/__tests__/file-watcher.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileWatcher } from '../file-watcher.js';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { FileChangeEvent } from '../../types/watcher.js';

describe('FileWatcher', () => {
  let testDir: string;
  let watcher: FileWatcher;

  beforeEach(() => {
    // Create temporary test directory
    testDir = mkdtempSync(join(tmpdir(), 'file-watcher-test-'));
  });

  afterEach(async () => {
    // Clean up
    if (watcher) {
      await watcher.stop();
    }
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should initialize with single path', () => {
      watcher = new FileWatcher({
        paths: testDir,
      });

      expect(watcher.state).toBe('idle');
      expect(watcher.getWatchedPaths()).toEqual([testDir]);
    });

    it('should initialize with multiple paths', () => {
      const dir2 = mkdtempSync(join(tmpdir(), 'file-watcher-test-2-'));

      watcher = new FileWatcher({
        paths: [testDir, dir2],
      });

      expect(watcher.getWatchedPaths()).toContain(testDir);
      expect(watcher.getWatchedPaths()).toContain(dir2);

      rmSync(dir2, { recursive: true, force: true });
    });

    it('should merge default ignore patterns', () => {
      watcher = new FileWatcher({
        paths: testDir,
        ignore: ['*.custom'],
      });

      // Internal check - implementation detail
      expect(watcher['options'].ignore).toContain('**/node_modules/**');
      expect(watcher['options'].ignore).toContain('*.custom');
    });
  });

  describe('start/stop', () => {
    it('should start watching', async () => {
      watcher = new FileWatcher({
        paths: testDir,
      });

      const readyPromise = new Promise((resolve) => {
        watcher.once('ready', resolve);
      });

      await watcher.start();
      await readyPromise;

      expect(watcher.state).toBe('active');
    });

    it('should stop watching', async () => {
      watcher = new FileWatcher({
        paths: testDir,
      });

      await watcher.start();

      const closePromise = new Promise((resolve) => {
        watcher.once('close', resolve);
      });

      await watcher.stop();
      await closePromise;

      expect(watcher.state).toBe('closed');
    });

    it('should reject start if already active', async () => {
      watcher = new FileWatcher({
        paths: testDir,
      });

      await watcher.start();

      await expect(watcher.start()).rejects.toThrow(
        'FileWatcher is already active'
      );
    });

    it('should reject start if path does not exist', async () => {
      watcher = new FileWatcher({
        paths: '/nonexistent/path',
      });

      await expect(watcher.start()).rejects.toThrow(
        'Watch path does not exist'
      );
    });
  });

  describe('file change detection', () => {
    it('should detect file creation', async () => {
      watcher = new FileWatcher({
        paths: testDir,
        debounceMs: 10,
      });

      const changes: FileChangeEvent[] = [];
      watcher.on('change', (event: FileChangeEvent) => {
        changes.push(event);
      });

      await watcher.start();

      // Wait for watcher to be ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create a file
      const testFile = join(testDir, 'test.txt');
      writeFileSync(testFile, 'hello');

      // Wait for event
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(changes.length).toBeGreaterThan(0);
      expect(changes[0].type).toBe('create');
      expect(changes[0].relativePath).toBe('test.txt');
    });

    it('should detect file update', async () => {
      // Create file before watching
      const testFile = join(testDir, 'test.txt');
      writeFileSync(testFile, 'hello');

      watcher = new FileWatcher({
        paths: testDir,
        debounceMs: 10,
      });

      const changes: FileChangeEvent[] = [];
      watcher.on('change', (event: FileChangeEvent) => {
        changes.push(event);
      });

      await watcher.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Update file
      writeFileSync(testFile, 'world');

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(changes.length).toBeGreaterThan(0);
      expect(changes[0].type).toBe('update');
    });

    it('should detect file deletion', async () => {
      // Create file before watching
      const testFile = join(testDir, 'test.txt');
      writeFileSync(testFile, 'hello');

      watcher = new FileWatcher({
        paths: testDir,
        debounceMs: 10,
      });

      const changes: FileChangeEvent[] = [];
      watcher.on('change', (event: FileChangeEvent) => {
        changes.push(event);
      });

      await watcher.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Delete file
      rmSync(testFile);

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(changes.length).toBeGreaterThan(0);
      expect(changes[0].type).toBe('delete');
    });
  });

  describe('recursive watching', () => {
    it('should watch subdirectories when recursive is true', async () => {
      watcher = new FileWatcher({
        paths: testDir,
        recursive: true,
        debounceMs: 10,
      });

      const changes: FileChangeEvent[] = [];
      watcher.on('change', (event: FileChangeEvent) => {
        changes.push(event);
      });

      await watcher.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create subdirectory and file
      const subDir = join(testDir, 'subdir');
      mkdirSync(subDir);
      writeFileSync(join(subDir, 'test.txt'), 'hello');

      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(changes.length).toBeGreaterThan(0);
      expect(changes.some((c) => c.relativePath.includes('subdir'))).toBe(true);
    });

    it('should not watch subdirectories when recursive is false', async () => {
      watcher = new FileWatcher({
        paths: testDir,
        recursive: false,
        debounceMs: 10,
      });

      const changes: FileChangeEvent[] = [];
      watcher.on('change', (event: FileChangeEvent) => {
        changes.push(event);
      });

      await watcher.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create subdirectory and file
      const subDir = join(testDir, 'subdir');
      mkdirSync(subDir);
      writeFileSync(join(subDir, 'test.txt'), 'hello');

      await new Promise((resolve) => setTimeout(resolve, 300));

      // Should only see the directory creation, not the file in subdirectory
      const subdirFileChanges = changes.filter((c) =>
        c.relativePath.includes('subdir/') || c.relativePath.includes('subdir\\')
      );
      expect(subdirFileChanges.length).toBe(0);
    });
  });

  describe('ignore patterns', () => {
    it('should ignore files matching ignore patterns', async () => {
      watcher = new FileWatcher({
        paths: testDir,
        ignore: ['*.log'],
        debounceMs: 10,
      });

      const changes: FileChangeEvent[] = [];
      watcher.on('change', (event: FileChangeEvent) => {
        changes.push(event);
      });

      await watcher.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create ignored file
      writeFileSync(join(testDir, 'test.log'), 'log content');

      // Create non-ignored file
      writeFileSync(join(testDir, 'test.txt'), 'text content');

      await new Promise((resolve) => setTimeout(resolve, 300));

      // Should only detect the .txt file
      expect(changes.some((c) => c.relativePath.endsWith('.log'))).toBe(false);
      expect(changes.some((c) => c.relativePath.endsWith('.txt'))).toBe(true);
    });
  });

  describe('dynamic path management', () => {
    it('should add path dynamically', async () => {
      watcher = new FileWatcher({
        paths: testDir,
      });

      await watcher.start();

      const newDir = mkdtempSync(join(tmpdir(), 'file-watcher-test-new-'));

      await watcher.addPath(newDir);

      expect(watcher.getWatchedPaths()).toContain(newDir);

      rmSync(newDir, { recursive: true, force: true });
    });

    it('should remove path dynamically', async () => {
      const dir2 = mkdtempSync(join(tmpdir(), 'file-watcher-test-2-'));

      watcher = new FileWatcher({
        paths: [testDir, dir2],
      });

      await watcher.start();

      await watcher.removePath(dir2);

      expect(watcher.getWatchedPaths()).not.toContain(dir2);

      rmSync(dir2, { recursive: true, force: true });
    });
  });

  describe('debouncing', () => {
    it('should debounce rapid changes', async () => {
      watcher = new FileWatcher({
        paths: testDir,
        debounceMs: 100,
      });

      const changes: FileChangeEvent[] = [];
      watcher.on('change', (event: FileChangeEvent) => {
        changes.push(event);
      });

      await watcher.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const testFile = join(testDir, 'test.txt');

      // Make rapid changes
      for (let i = 0; i < 10; i++) {
        writeFileSync(testFile, `content ${i}`);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Should receive fewer events than changes made (due to debouncing)
      expect(changes.length).toBeLessThan(10);
    });
  });
});
