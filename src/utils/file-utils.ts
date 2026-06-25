/**
 * File Utils - File system utilities
 */

import { readFile, writeFile, mkdir, readdir, stat, unlink, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { homedir } from 'os';

/**
 * Ensure directory exists
 */
export async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

/**
 * Read JSON file
 */
export async function readJson<T = any>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Write JSON file
 */
export async function writeJson(filePath: string, data: any, indent: number = 2): Promise<void> {
  await ensureDir(dirname(filePath));
  const content = JSON.stringify(data, null, indent);
  await writeFile(filePath, content, 'utf-8');
}

/**
 * Check if file exists
 */
export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

/**
 * Get file size in bytes
 */
export async function getFileSize(filePath: string): Promise<number> {
  const stats = await stat(filePath);
  return stats.size;
}

/**
 * Get file modified time
 */
export async function getModifiedTime(filePath: string): Promise<number> {
  const stats = await stat(filePath);
  return stats.mtimeMs;
}

/**
 * List files in directory
 */
export async function listFiles(dirPath: string, extension?: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });

  let files = entries
    .filter(entry => entry.isFile())
    .map(entry => entry.name);

  if (extension) {
    files = files.filter(name => extname(name) === extension);
  }

  return files;
}

/**
 * List directories
 */
export async function listDirs(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
}

/**
 * Delete file
 */
export async function deleteFile(filePath: string): Promise<void> {
  if (existsSync(filePath)) {
    await unlink(filePath);
  }
}

/**
 * Delete directory recursively
 */
export async function deleteDir(dirPath: string): Promise<void> {
  if (existsSync(dirPath)) {
    await rm(dirPath, { recursive: true, force: true });
  }
}

/**
 * Copy file
 */
export async function copyFile(source: string, dest: string): Promise<void> {
  await ensureDir(dirname(dest));
  const content = await readFile(source);
  await writeFile(dest, content);
}

/**
 * Resolve home directory path
 */
export function resolveHome(path: string): string {
  if (path.startsWith('~/') || path === '~') {
    return path.replace('~', homedir());
  }
  return path;
}

/**
 * Get data directory
 */
export function getDataDir(appName: string = 'aether'): string {
  const home = homedir();
  const platform = process.platform;

  if (platform === 'darwin') {
    return join(home, 'Library', 'Application Support', appName);
  } else if (platform === 'win32') {
    return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), appName);
  } else {
    return join(home, `.${appName}`);
  }
}

/**
 * Get safe filename
 */
export function safeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9-_.]/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
}

/**
 * Get file extension
 */
export function getExtension(filePath: string): string {
  return extname(filePath).toLowerCase();
}

/**
 * Get filename without extension
 */
export function getBasename(filePath: string): string {
  return basename(filePath, extname(filePath));
}
