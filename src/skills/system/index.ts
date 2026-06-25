/**
 * System Skill
 *
 * File operations, process management, and system utilities
 */

import { BaseSkill } from '../base-skill';
import type { Tool, ToolResult } from '../../types';
import type { SkillContext } from '../types';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import {
  readdir,
  readFile,
  writeFile,
  mkdir,
  rm,
  stat,
  copyFile,
  rename as renameFile,
  access,
  constants,
} from 'fs/promises';
import { resolve, join, dirname, basename, extname, normalize } from 'path';

const execAsync = promisify(exec);

/**
 * Allowed directories for file operations.
 * File access is restricted to these directories for security.
 */
const ALLOWED_DIRECTORIES = (() => {
  const dirs: string[] = [
    require('os').homedir(),
    process.cwd(),
    // Extend via environment variable (colon-separated paths)
    ...(process.env.AETHER_ALLOWED_PATHS || '').split(':').filter(Boolean),
  ];
  // Normalize all entries
  return dirs.map((d) => normalize(resolve(d)));
})();

/**
 * Validate that the resolved path falls within an allowed directory.
 * Performs a prefix check on the normalized absolute path.
 */
function isPathAllowed(filePath: string): boolean {
  try {
    const resolved = normalize(resolve(filePath));
    return ALLOWED_DIRECTORIES.some((dir) => resolved.startsWith(dir));
  } catch {
    return false;
  }
}

/**
 * Wraps a resolved path with sandbox validation.
 * Returns an error ToolResult if the path is not allowed, or undefined on success.
 */
function assertPathAllowed(filePath: string, operation: string): ToolResult | undefined {
  if (!isPathAllowed(filePath)) {
    return {
      success: false,
      error: `Access denied: path "${filePath}" is outside allowed directories for operation "${operation}"`,
    };
  }
  return undefined;
}

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  isDirectory: boolean;
  isFile: boolean;
  createdAt: string;
  modifiedAt: string;
  permissions: string;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  status: string;
}

export class SystemSkill extends BaseSkill {
  constructor() {
    super({
      id: 'system',
      name: 'System Tools',
      description: 'File operations, process management, and system utilities',
      version: '1.0.0',
      author: 'Nexus Team',
      enabled: true,
      requiresAuth: false,
      dependencies: [],
    });
  }

  getTools(): Tool[] {
    return [
      // File Operations
      {
        name: 'file_read',
        description: 'Read content from a file',
        parameters: [
          {
            name: 'filePath',
            type: 'string',
            description: 'Path to the file to read',
            required: true,
          },
          {
            name: 'encoding',
            type: 'string',
            description: 'File encoding (default: utf-8)',
            required: false,
          },
        ],
        handler: async (params) => this.readFile(params),
      },
      {
        name: 'file_write',
        description: 'Write content to a file',
        parameters: [
          {
            name: 'filePath',
            type: 'string',
            description: 'Path to the file to write',
            required: true,
          },
          {
            name: 'content',
            type: 'string',
            description: 'Content to write to the file',
            required: true,
          },
          {
            name: 'encoding',
            type: 'string',
            description: 'File encoding (default: utf-8)',
            required: false,
          },
        ],
        handler: async (params) => this.writeFile(params),
      },
      {
        name: 'file_append',
        description: 'Append content to a file',
        parameters: [
          {
            name: 'filePath',
            type: 'string',
            description: 'Path to the file',
            required: true,
          },
          {
            name: 'content',
            type: 'string',
            description: 'Content to append',
            required: true,
          },
        ],
        handler: async (params) => this.appendFile(params),
      },
      {
        name: 'file_delete',
        description: 'Delete a file or directory',
        parameters: [
          {
            name: 'path',
            type: 'string',
            description: 'Path to the file or directory to delete',
            required: true,
          },
          {
            name: 'recursive',
            type: 'boolean',
            description: 'Recursively delete directories',
            required: false,
          },
        ],
        handler: async (params) => this.deleteFile(params),
      },
      {
        name: 'file_copy',
        description: 'Copy a file',
        parameters: [
          {
            name: 'source',
            type: 'string',
            description: 'Source file path',
            required: true,
          },
          {
            name: 'destination',
            type: 'string',
            description: 'Destination file path',
            required: true,
          },
        ],
        handler: async (params) => this.copyFile(params),
      },
      {
        name: 'file_move',
        description: 'Move or rename a file',
        parameters: [
          {
            name: 'source',
            type: 'string',
            description: 'Source file path',
            required: true,
          },
          {
            name: 'destination',
            type: 'string',
            description: 'Destination file path',
            required: true,
          },
        ],
        handler: async (params) => this.moveFile(params),
      },
      {
        name: 'file_exists',
        description: 'Check if a file or directory exists',
        parameters: [
          {
            name: 'path',
            type: 'string',
            description: 'Path to check',
            required: true,
          },
        ],
        handler: async (params) => this.fileExists(params),
      },
      {
        name: 'file_info',
        description: 'Get detailed information about a file or directory',
        parameters: [
          {
            name: 'path',
            type: 'string',
            description: 'Path to the file or directory',
            required: true,
          },
        ],
        handler: async (params) => this.getFileInfo(params),
      },
      {
        name: 'directory_list',
        description: 'List contents of a directory',
        parameters: [
          {
            name: 'path',
            type: 'string',
            description: 'Directory path',
            required: true,
          },
          {
            name: 'recursive',
            type: 'boolean',
            description: 'Recursively list subdirectories',
            required: false,
          },
        ],
        handler: async (params) => this.listDirectory(params),
      },
      {
        name: 'directory_create',
        description: 'Create a new directory',
        parameters: [
          {
            name: 'path',
            type: 'string',
            description: 'Directory path to create',
            required: true,
          },
          {
            name: 'recursive',
            type: 'boolean',
            description: 'Create parent directories if needed',
            required: false,
          },
        ],
        handler: async (params) => this.createDirectory(params),
      },
      // Process Management
      {
        name: 'process_execute',
        description: 'Execute a shell command',
        parameters: [
          {
            name: 'command',
            type: 'string',
            description: 'Command to execute',
            required: true,
          },
          {
            name: 'cwd',
            type: 'string',
            description: 'Working directory for the command',
            required: false,
          },
          {
            name: 'timeout',
            type: 'number',
            description: 'Command timeout in milliseconds',
            required: false,
          },
        ],
        handler: async (params) => this.executeCommand(params),
      },
      {
        name: 'process_spawn',
        description: 'Spawn a long-running process',
        parameters: [
          {
            name: 'command',
            type: 'string',
            description: 'Command to spawn',
            required: true,
          },
          {
            name: 'args',
            type: 'array',
            description: 'Command arguments',
            required: false,
          },
          {
            name: 'cwd',
            type: 'string',
            description: 'Working directory',
            required: false,
          },
        ],
        handler: async (params) => this.spawnProcess(params),
      },
      {
        name: 'process_list',
        description: 'List running processes',
        parameters: [
          {
            name: 'filter',
            type: 'string',
            description: 'Filter processes by name',
            required: false,
          },
        ],
        handler: async (params) => this.listProcesses(params),
      },
      {
        name: 'process_kill',
        description: 'Kill a process by PID',
        parameters: [
          {
            name: 'pid',
            type: 'number',
            description: 'Process ID to kill',
            required: true,
          },
          {
            name: 'signal',
            type: 'string',
            description: 'Signal to send (default: SIGTERM)',
            required: false,
          },
        ],
        handler: async (params) => this.killProcess(params),
      },
      // System Information
      {
        name: 'system_info',
        description: 'Get system information',
        parameters: [],
        handler: async (params) => this.getSystemInfo(params),
      },
      {
        name: 'env_get',
        description: 'Get environment variable value',
        parameters: [
          {
            name: 'name',
            type: 'string',
            description: 'Environment variable name',
            required: true,
          },
        ],
        handler: async (params) => this.getEnvVar(params),
      },
      {
        name: 'env_set',
        description: 'Set environment variable (for current process)',
        parameters: [
          {
            name: 'name',
            type: 'string',
            description: 'Environment variable name',
            required: true,
          },
          {
            name: 'value',
            type: 'string',
            description: 'Environment variable value',
            required: true,
          },
        ],
        handler: async (params) => this.setEnvVar(params),
      },
    ];
  }

  async isConfigured(context: SkillContext): Promise<boolean> {
    // System operations don't require special configuration
    return true;
  }

  // File Operations
  private async readFile(params: unknown): Promise<ToolResult> {
    try {
      const { filePath, encoding = 'utf-8' } = params as {
        filePath: string;
        encoding?: BufferEncoding;
      };

      if (!filePath) {
        return this.createError('filePath is required');
      }

      const denied = assertPathAllowed(filePath, 'readFile');
      if (denied) return denied;

      const content = await readFile(resolve(filePath), encoding);

      return this.createSuccess(content, {
        filePath,
        size: content.length,
      });
    } catch (error) {
      return this.handleError(error, 'File read');
    }
  }

  private async writeFile(params: unknown): Promise<ToolResult> {
    try {
      const { filePath, content, encoding = 'utf-8' } = params as {
        filePath: string;
        content: string;
        encoding?: BufferEncoding;
      };

      if (!filePath || content === undefined) {
        return this.createError('filePath and content are required');
      }

      const denied = assertPathAllowed(filePath, 'writeFile');
      if (denied) return denied;

      const resolvedPath = resolve(filePath);
      await mkdir(dirname(resolvedPath), { recursive: true });
      await writeFile(resolvedPath, content, encoding);

      return this.createSuccess(
        { filePath: resolvedPath, size: content.length },
        { encoding }
      );
    } catch (error) {
      return this.handleError(error, 'File write');
    }
  }

  private async appendFile(params: unknown): Promise<ToolResult> {
    try {
      const { filePath, content } = params as {
        filePath: string;
        content: string;
      };

      if (!filePath || content === undefined) {
        return this.createError('filePath and content are required');
      }

      const denied = assertPathAllowed(filePath, 'appendFile');
      if (denied) return denied;

      const resolvedPath = resolve(filePath);
      const existing = await readFile(resolvedPath, 'utf-8').catch(() => '');
      await writeFile(resolvedPath, existing + content, 'utf-8');

      return this.createSuccess({ filePath: resolvedPath });
    } catch (error) {
      return this.handleError(error, 'File append');
    }
  }

  private async deleteFile(params: unknown): Promise<ToolResult> {
    try {
      const { path, recursive = false } = params as {
        path: string;
        recursive?: boolean;
      };

      if (!path) {
        return this.createError('path is required');
      }

      const denied = assertPathAllowed(path, 'deleteFile');
      if (denied) return denied;

      await rm(resolve(path), { recursive, force: true });

      return this.createSuccess(undefined, { path, recursive });
    } catch (error) {
      return this.handleError(error, 'File delete');
    }
  }

  private async copyFile(params: unknown): Promise<ToolResult> {
    try {
      const { source, destination } = params as {
        source: string;
        destination: string;
      };

      if (!source || !destination) {
        return this.createError('source and destination are required');
      }

      const sourceDenied = assertPathAllowed(source, 'copyFile');
      if (sourceDenied) return sourceDenied;
      const destDenied = assertPathAllowed(destination, 'copyFile');
      if (destDenied) return destDenied;

      const destPath = resolve(destination);
      await mkdir(dirname(destPath), { recursive: true });
      await copyFile(resolve(source), destPath);

      return this.createSuccess({ destination: destPath });
    } catch (error) {
      return this.handleError(error, 'File copy');
    }
  }

  private async moveFile(params: unknown): Promise<ToolResult> {
    try {
      const { source, destination } = params as {
        source: string;
        destination: string;
      };

      if (!source || !destination) {
        return this.createError('source and destination are required');
      }

      const sourceDenied = assertPathAllowed(source, 'moveFile');
      if (sourceDenied) return sourceDenied;
      const destDenied = assertPathAllowed(destination, 'moveFile');
      if (destDenied) return destDenied;

      const destPath = resolve(destination);
      await mkdir(dirname(destPath), { recursive: true });
      await renameFile(resolve(source), destPath);

      return this.createSuccess({ destination: destPath });
    } catch (error) {
      return this.handleError(error, 'File move');
    }
  }

  private async fileExists(params: unknown): Promise<ToolResult> {
    try {
      const { path } = params as { path: string };

      if (!path) {
        return this.createError('path is required');
      }

      const denied = assertPathAllowed(path, 'fileExists');
      if (denied) return denied;

      let exists = true;
      try {
        await access(resolve(path), constants.F_OK);
      } catch {
        exists = false;
      }

      return this.createSuccess({ exists }, { path });
    } catch (error) {
      return this.handleError(error, 'File exists check');
    }
  }

  private async getFileInfo(params: unknown): Promise<ToolResult> {
    try {
      const { path } = params as { path: string };

      if (!path) {
        return this.createError('path is required');
      }

      const denied = assertPathAllowed(path, 'getFileInfo');
      if (denied) return denied;

      const resolvedPath = resolve(path);
      const stats = await stat(resolvedPath);

      const fileInfo: FileInfo = {
        path: resolvedPath,
        name: basename(resolvedPath),
        size: stats.size,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString(),
        permissions: stats.mode.toString(8).slice(-3),
      };

      return this.createSuccess(fileInfo);
    } catch (error) {
      return this.handleError(error, 'File info');
    }
  }

  private async listDirectory(params: unknown): Promise<ToolResult> {
    try {
      const { path, recursive = false } = params as {
        path: string;
        recursive?: boolean;
      };

      if (!path) {
        return this.createError('path is required');
      }

      const denied = assertPathAllowed(path, 'listDirectory');
      if (denied) return denied;

      const resolvedPath = resolve(path);
      const entries = await readdir(resolvedPath, { withFileTypes: true });
      const files: FileInfo[] = [];

      for (const entry of entries) {
        const entryPath = join(resolvedPath, entry.name);
        const stats = await stat(entryPath);

        files.push({
          path: entryPath,
          name: entry.name,
          size: stats.size,
          isDirectory: entry.isDirectory(),
          isFile: entry.isFile(),
          createdAt: stats.birthtime.toISOString(),
          modifiedAt: stats.mtime.toISOString(),
          permissions: stats.mode.toString(8).slice(-3),
        });

        if (recursive && entry.isDirectory()) {
          const subFiles = await this.listDirectory({ path: entryPath, recursive });
          if (subFiles.success && subFiles.data) {
            files.push(...subFiles.data);
          }
        }
      }

      return this.createSuccess(files, {
        path: resolvedPath,
        count: files.length,
      });
    } catch (error) {
      return this.handleError(error, 'Directory list');
    }
  }

  private async createDirectory(params: unknown): Promise<ToolResult> {
    try {
      const { path, recursive = true } = params as {
        path: string;
        recursive?: boolean;
      };

      if (!path) {
        return this.createError('path is required');
      }

      const denied = assertPathAllowed(path, 'createDirectory');
      if (denied) return denied;

      const resolvedPath = resolve(path);
      await mkdir(resolvedPath, { recursive });

      return this.createSuccess({ path: resolvedPath });
    } catch (error) {
      return this.handleError(error, 'Directory create');
    }
  }

  // Process Management
  private async executeCommand(
    params: unknown
  ): Promise<ToolResult> {
    try {
      const { command, cwd, timeout } = params as {
        command: string;
        cwd?: string;
        timeout?: number;
      };

      if (!command) {
        return this.createError('command is required');
      }

      const { stdout, stderr } = await execAsync(command, {
        cwd: cwd ? resolve(cwd) : undefined,
        timeout,
      });

      return this.createSuccess(
        {
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: 0,
        },
        { command }
      );
    } catch (error: any) {
      return this.createSuccess(
        {
          stdout: error.stdout?.trim() || '',
          stderr: error.stderr?.trim() || '',
          exitCode: error.code || 1,
        },
        { command: (params as any).command, failed: true }
      );
    }
  }

  private async spawnProcess(params: unknown): Promise<ToolResult> {
    try {
      const { command, args = [], cwd } = params as {
        command: string;
        args?: string[];
        cwd?: string;
      };

      if (!command) {
        return this.createError('command is required');
      }

      const child = spawn(command, args, {
        cwd: cwd ? resolve(cwd) : undefined,
        detached: true,
        stdio: 'ignore',
      });

      child.unref();

      return this.createSuccess({ pid: child.pid || 0 }, { command });
    } catch (error) {
      return this.handleError(error, 'Process spawn');
    }
  }

  private async listProcesses(params: unknown): Promise<ToolResult> {
    try {
      const { filter } = params as { filter?: string };

      // Use ps command on Unix-like systems
      const { stdout } = await execAsync('ps aux');
      const lines = stdout.split('\n').slice(1);

      const processes: ProcessInfo[] = lines
        .filter((line) => line.trim())
        .map((line) => {
          const parts = line.trim().split(/\s+/);
          return {
            pid: parseInt(parts[1]),
            name: parts[10],
            cpu: parseFloat(parts[2]),
            memory: parseFloat(parts[3]),
            status: parts[7],
          };
        })
        .filter((p) => !filter || p.name.includes(filter));

      return this.createSuccess(processes, {
        count: processes.length,
        hasFilter: !!filter,
      });
    } catch (error) {
      return this.handleError(error, 'Process list');
    }
  }

  private async killProcess(params: unknown): Promise<ToolResult> {
    try {
      const { pid, signal = 'SIGTERM' } = params as {
        pid: number;
        signal?: string;
      };

      if (!pid) {
        return this.createError('pid is required');
      }

      process.kill(pid, signal as NodeJS.Signals);

      return this.createSuccess(undefined, { pid, signal });
    } catch (error) {
      return this.handleError(error, 'Process kill');
    }
  }

  // System Information
  private async getSystemInfo(params: unknown): Promise<ToolResult> {
    try {
      const os = await import('os');

      const info = {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
        },
        uptime: os.uptime(),
      };

      return this.createSuccess(info);
    } catch (error) {
      return this.handleError(error, 'System info');
    }
  }

  private async getEnvVar(params: unknown): Promise<ToolResult> {
    try {
      const { name } = params as { name: string };

      if (!name) {
        return this.createError('name is required');
      }

      const value = process.env[name];

      return this.createSuccess({ name, value });
    } catch (error) {
      return this.handleError(error, 'Get environment variable');
    }
  }

  private async setEnvVar(params: unknown): Promise<ToolResult> {
    try {
      const { name, value } = params as { name: string; value: string };

      if (!name || value === undefined) {
        return this.createError('name and value are required');
      }

      process.env[name] = value;

      return this.createSuccess(undefined, { name });
    } catch (error) {
      return this.handleError(error, 'Set environment variable');
    }
  }
}
