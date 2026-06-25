/**
 * System Diagnostics - System information and health checks
 */

import { createLogger } from '../utils/logger';
import { totalmem, freemem, cpus, loadavg, uptime, platform, arch, release } from 'os';
import { statfs } from 'fs';
import { promisify } from 'util';

const logger = createLogger('SystemDiagnostics');
const statfsAsync = promisify(statfs);

/**
 * System info
 */
export interface SystemInfo {
  timestamp: number;
  platform: string;
  arch: string;
  release: string;
  uptime: number;
  cpu: {
    model: string;
    cores: number;
    usage: number[];
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  disk?: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  process: {
    pid: number;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
}

/**
 * Health status
 */
export interface HealthStatus {
  healthy: boolean;
  issues: string[];
  warnings: string[];
}

/**
 * System Diagnostics
 */
export class SystemDiagnostics {
  /**
   * Get system information
   */
  async getSystemInfo(): Promise<SystemInfo> {
    const cpuInfo = cpus();

    const info: SystemInfo = {
      timestamp: Date.now(),
      platform: platform(),
      arch: arch(),
      release: release(),
      uptime: uptime(),
      cpu: {
        model: cpuInfo[0]?.model || 'Unknown',
        cores: cpuInfo.length,
        usage: loadavg()
      },
      memory: {
        total: totalmem(),
        free: freemem(),
        used: totalmem() - freemem(),
        usagePercent: ((totalmem() - freemem()) / totalmem()) * 100
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    };

    // Get disk info (Unix-like systems)
    if (platform() !== 'win32') {
      try {
        const diskStats = await statfsAsync('/');
        const blockSize = diskStats.bsize;
        const totalBlocks = diskStats.blocks;
        const freeBlocks = diskStats.bfree;

        info.disk = {
          total: totalBlocks * blockSize,
          free: freeBlocks * blockSize,
          used: (totalBlocks - freeBlocks) * blockSize,
          usagePercent: ((totalBlocks - freeBlocks) / totalBlocks) * 100
        };
      } catch (error) {
        logger.warn('Failed to get disk stats:', error as Record<string, any> | undefined);
      }
    }

    return info;
  }

  /**
   * Check system health
   */
  async checkHealth(): Promise<HealthStatus> {
    const info = await this.getSystemInfo();
    const issues: string[] = [];
    const warnings: string[] = [];

    // Memory checks
    if (info.memory.usagePercent > 90) {
      issues.push(`Critical: Memory usage at ${info.memory.usagePercent.toFixed(1)}%`);
    } else if (info.memory.usagePercent > 75) {
      warnings.push(`Warning: Memory usage at ${info.memory.usagePercent.toFixed(1)}%`);
    }

    // Disk checks
    if (info.disk) {
      if (info.disk.usagePercent > 90) {
        issues.push(`Critical: Disk usage at ${info.disk.usagePercent.toFixed(1)}%`);
      } else if (info.disk.usagePercent > 80) {
        warnings.push(`Warning: Disk usage at ${info.disk.usagePercent.toFixed(1)}%`);
      }
    }

    // CPU load checks (1-minute average)
    const loadPerCore = info.cpu.usage[0] / info.cpu.cores;
    if (loadPerCore > 1.5) {
      warnings.push(`Warning: High CPU load (${loadPerCore.toFixed(2)} per core)`);
    }

    // Process memory checks
    const heapUsed = info.process.memoryUsage.heapUsed;
    const heapTotal = info.process.memoryUsage.heapTotal;
    const heapPercent = (heapUsed / heapTotal) * 100;

    if (heapPercent > 90) {
      warnings.push(`Warning: Process heap usage at ${heapPercent.toFixed(1)}%`);
    }

    const healthy = issues.length === 0;

    if (healthy) {
      logger.info('System health check: OK');
    } else {
      logger.warn(`System health check: ${issues.length} issue(s), ${warnings.length} warning(s)`);
    }

    return { healthy, issues, warnings };
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';

    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Format uptime to human readable
   */
  formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.join(' ') || '0m';
  }

  /**
   * Generate system report
   */
  async generateReport(): Promise<string> {
    const info = await this.getSystemInfo();
    const health = await this.checkHealth();

    const report = [
      '=== System Diagnostics Report ===',
      `Generated: ${new Date(info.timestamp).toISOString()}`,
      '',
      '--- System Information ---',
      `Platform: ${info.platform} ${info.arch}`,
      `Release: ${info.release}`,
      `Uptime: ${this.formatUptime(info.uptime)}`,
      '',
      '--- CPU ---',
      `Model: ${info.cpu.model}`,
      `Cores: ${info.cpu.cores}`,
      `Load Average: ${info.cpu.usage.map(l => l.toFixed(2)).join(', ')}`,
      '',
      '--- Memory ---',
      `Total: ${this.formatBytes(info.memory.total)}`,
      `Free: ${this.formatBytes(info.memory.free)}`,
      `Used: ${this.formatBytes(info.memory.used)} (${info.memory.usagePercent.toFixed(1)}%)`,
      ''
    ];

    if (info.disk) {
      report.push(
        '--- Disk ---',
        `Total: ${this.formatBytes(info.disk.total)}`,
        `Free: ${this.formatBytes(info.disk.free)}`,
        `Used: ${this.formatBytes(info.disk.used)} (${info.disk.usagePercent.toFixed(1)}%)`,
        ''
      );
    }

    report.push(
      '--- Process ---',
      `PID: ${info.process.pid}`,
      `Uptime: ${this.formatUptime(info.process.uptime)}`,
      `Heap Used: ${this.formatBytes(info.process.memoryUsage.heapUsed)}`,
      `Heap Total: ${this.formatBytes(info.process.memoryUsage.heapTotal)}`,
      `RSS: ${this.formatBytes(info.process.memoryUsage.rss)}`,
      '',
      '--- Health Status ---',
      `Status: ${health.healthy ? 'Healthy ✓' : 'Issues Detected ✗'}`
    );

    if (health.issues.length > 0) {
      report.push('', 'Issues:');
      health.issues.forEach(issue => report.push(`  - ${issue}`));
    }

    if (health.warnings.length > 0) {
      report.push('', 'Warnings:');
      health.warnings.forEach(warning => report.push(`  - ${warning}`));
    }

    return report.join('\n');
  }
}
