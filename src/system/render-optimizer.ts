/**
import { createLogger } from './utils/logger';
 * Nexus Render Optimizer
 *
 * Manages Electron rendering modes with automatic GPU fallback,
 * performance monitoring, and intelligent degradation.
 *
 * Features:
 * - GPU capability detection
 * - Automatic fallback on repeated failures
 * - Performance metrics tracking (FPS, memory)
 * - Multiple rendering modes (gpu/software/hybrid)
 * - Persistent configuration
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Rendering mode options
 */
export type RenderMode = 'gpu' | 'software' | 'hybrid' | 'auto';

/**
 * Configuration source
 */
export type RenderSource =
  | 'default'           // System default (GPU)
  | 'override'          // Command-line override
  | 'auto-fallback'     // Automatic fallback due to failures
  | 'user-setting'      // User preference
  | 'gpu-detection';    // GPU capability detection

/**
 * Auto-fallback configuration
 */
export interface AutoFallbackConfig {
  reason: string;
  activatedAt: number;
  failureCount: number;
  appVersion: string;
}

/**
 * Last launch information
 */
export interface LastLaunchInfo {
  startedAt: number;
  appVersion: string;
  mode: RenderMode;
  source: RenderSource;
  reason?: string;
  rendererReady: boolean;
  performanceScore?: number;
}

/**
 * Pending notice for user
 */
export interface PendingNotice {
  key: string;
  level: 'info' | 'warning' | 'error';
  message: string;
}

/**
 * GPU capability information
 */
export interface GPUCapability {
  vendor: string;
  renderer: string;
  vramMB: number;
  supportsWebGL2: boolean;
  supportsWebGPU: boolean;
  driverVersion?: string;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  fps: number;
  memoryUsageMB: number;
  gpuUsagePercent: number;
  renderLatencyMs: number;
  timestamp: number;
}

/**
 * Render mode configuration file format
 */
export interface RenderModeConfig {
  version: number;
  autoFallback?: AutoFallbackConfig;
  lastLaunch?: LastLaunchInfo;
  pendingNotice?: PendingNotice;
  lastShownNoticeKey?: string;
  gpuCapability?: GPUCapability;
  performanceHistory?: PerformanceMetrics[];
}

/**
 * Render mode decision result
 */
export interface RenderModeDecision {
  mode: RenderMode;
  source: RenderSource;
  reason?: string;
}

// ============================================================================
// Constants
// ============================================================================

const CONFIG_VERSION = 1;
const FALLBACK_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const RENDERER_READY_TIMEOUT_MS = 15000; // 15 seconds
const FAILURE_THRESHOLD = 2; // Auto-fallback after 2 failures
const PERFORMANCE_HISTORY_LIMIT = 100;

// ============================================================================
// RenderOptimizer Class
// ============================================================================

export class RenderOptimizer {
  private configPath: string;
  private config: RenderModeConfig;
  private currentDecision: RenderModeDecision | null = null;
  private rendererReadyTimer: NodeJS.Timeout | null = null;
  private isRendererReady = false;

  constructor(userDataPath: string) {
    this.configPath = path.join(userDataPath, 'desktop-render-mode.json');
    this.config = this.loadConfig();
  }

  // ==========================================================================
  // Configuration Management
  // ==========================================================================

  /**
   * Load configuration from disk
   */
  private loadConfig(): RenderModeConfig {
    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const parsed = JSON.parse(content);

      return {
        version: parsed.version || CONFIG_VERSION,
        autoFallback: parsed.autoFallback,
        lastLaunch: parsed.lastLaunch,
        pendingNotice: parsed.pendingNotice,
        lastShownNoticeKey: parsed.lastShownNoticeKey,
        gpuCapability: parsed.gpuCapability,
        performanceHistory: parsed.performanceHistory || []
      };
    } catch (error) {
      // Config doesn't exist or is corrupted, return default
      return {
        version: CONFIG_VERSION,
        performanceHistory: []
      };
    }
  }

  /**
   * Save configuration to disk
   */
  private saveConfig(): void {
    try {
      fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('[RenderOptimizer] Failed to save config:', error);
    }
  }

  /**
   * Get current configuration (read-only)
   */
  getConfig(): Readonly<RenderModeConfig> {
    return { ...this.config };
  }

  /**
   * Clear auto-fallback state (called when user manually changes settings)
   */
  clearAutoFallback(): void {
    if (this.config.autoFallback) {
      delete this.config.autoFallback;
      this.saveConfig();
    }
  }

  // ==========================================================================
  // Render Mode Decision
  // ==========================================================================

  /**
   * Parse render mode from string
   */
  private parseRenderMode(value: string | undefined): RenderMode | null {
    if (!value) return null;

    const normalized = value.trim().toLowerCase();

    if (normalized === 'gpu' ||
        normalized === 'software' ||
        normalized === 'hybrid' ||
        normalized === 'auto') {
      return normalized as RenderMode;
    }

    return null;
  }

  /**
   * Check if auto-fallback should be active
   */
  private shouldActivateAutoFallback(appVersion: string, now: number): boolean {
    const fallback = this.config.autoFallback;

    if (!fallback) return false;

    // Different app version? Clear fallback
    if (fallback.appVersion !== appVersion) {
      delete this.config.autoFallback;
      return false;
    }

    // Outside 24-hour window? Clear fallback
    if (now - fallback.activatedAt > FALLBACK_WINDOW_MS) {
      delete this.config.autoFallback;
      return false;
    }

    // Need at least 2 failures
    if ((fallback.failureCount || 0) < FAILURE_THRESHOLD) {
      return false;
    }

    return true;
  }

  /**
   * Check previous launch for failures
   */
  private checkPreviousLaunchFailure(appVersion: string, now: number): void {
    const lastLaunch = this.config.lastLaunch;

    // No previous launch or already marked as ready
    if (!lastLaunch || lastLaunch.rendererReady) {
      return;
    }

    // Different app version? Don't count as failure
    if (lastLaunch.appVersion !== appVersion) {
      delete this.config.autoFallback;
      return;
    }

    // Only track failures in GPU mode
    if (lastLaunch.mode !== 'gpu') {
      return;
    }

    // Increment failure count
    const reason = lastLaunch.reason || 'Previous GPU launch did not reach ready state';
    const currentCount = this.config.autoFallback?.failureCount || 0;
    const newCount = currentCount + 1;

    this.config.autoFallback = {
      reason,
      activatedAt: now,
      failureCount: newCount,
      appVersion
    };

    // Add notice if we've crossed the threshold
    if (newCount >= FAILURE_THRESHOLD) {
      this.setPendingNotice({
        key: `fallback:${reason}`,
        level: 'warning',
        message: 'Compatibility rendering is active after repeated GPU startup failures.'
      });
    }
  }

  /**
   * Decide which render mode to use
   */
  decideRenderMode(
    argv: string[],
    env: NodeJS.ProcessEnv,
    options: {
      appVersion: string;
      hardwareAccelerationEnabled: boolean;
    }
  ): RenderModeDecision {
    const { appVersion, hardwareAccelerationEnabled } = options;
    const now = Date.now();

    // Check previous launch for failures
    this.checkPreviousLaunchFailure(appVersion, now);

    // 1. Check command-line arguments
    for (const arg of argv) {
      if (arg === '--disable-gpu') {
        return this.createDecision('software', 'override', 'GPU disabled via --disable-gpu');
      }

      if (arg.startsWith('--render-mode=')) {
        const mode = this.parseRenderMode(arg.slice(14));
        if (mode) {
          return this.createDecision(
            mode,
            'override',
            `Launch override selected ${mode.toUpperCase()} rendering`
          );
        }
      }
    }

    // 2. Check environment variable
    const envMode = this.parseRenderMode(env.NEXUS_RENDER_MODE);
    if (envMode) {
      return this.createDecision(
        envMode,
        'override',
        `Environment variable selected ${envMode.toUpperCase()} rendering`
      );
    }

    // 3. Check auto-fallback
    if (this.shouldActivateAutoFallback(appVersion, now)) {
      const reason = this.config.autoFallback!.reason;
      return this.createDecision('software', 'auto-fallback', reason);
    }

    // 4. Check user settings
    if (!hardwareAccelerationEnabled) {
      return this.createDecision(
        'software',
        'user-setting',
        'Hardware acceleration is disabled in settings'
      );
    }

    // 5. Default to GPU
    return this.createDecision('gpu', 'default');
  }

  /**
   * Create decision and update state
   */
  private createDecision(
    mode: RenderMode,
    source: RenderSource,
    reason?: string
  ): RenderModeDecision {
    const decision: RenderModeDecision = { mode, source, reason };

    // Record this launch
    this.config.lastLaunch = {
      startedAt: Date.now(),
      appVersion: app.getVersion(),
      mode,
      source,
      reason,
      rendererReady: false
    };

    this.saveConfig();
    this.currentDecision = decision;

    return decision;
  }

  // ==========================================================================
  // Electron Command-line Switches
  // ==========================================================================

  /**
   * Apply Electron command-line switches based on render mode
   */
  applyElectronSwitches(decision: RenderModeDecision): void {
    const { mode } = decision;

    if (mode === 'software') {
      // Disable GPU acceleration completely
      app.disableHardwareAcceleration();
      console.log('[RenderOptimizer] Hardware acceleration disabled');
    } else if (mode === 'hybrid') {
      // Use GPU for some tasks, software for others
      app.commandLine.appendSwitch('disable-gpu-vsync');
      app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
      console.log('[RenderOptimizer] Hybrid rendering mode enabled');
    } else if (mode === 'gpu') {
      // Full GPU acceleration (default, no switches needed)
      console.log('[RenderOptimizer] Full GPU acceleration enabled');
    }

    // Additional performance switches
    app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');
    app.commandLine.appendSwitch('disable-features', 'UseChromeOSDirectVideoDecoder');
  }

  // ==========================================================================
  // Renderer Ready Tracking
  // ==========================================================================

  /**
   * Start watchdog timer for renderer ready
   */
  startRendererReadyWatchdog(onTimeout: () => void): void {
    // Only watch in GPU mode
    if (this.currentDecision?.mode !== 'gpu') {
      return;
    }

    this.rendererReadyTimer = setTimeout(() => {
      if (!this.isRendererReady) {
        console.error('[RenderOptimizer] Renderer did not report ready within timeout');
        onTimeout();
      }
    }, RENDERER_READY_TIMEOUT_MS);
  }

  /**
   * Mark renderer as ready (called from renderer process via IPC)
   */
  markRendererReady(): RenderModeDecision & { notice: PendingNotice | null } {
    this.isRendererReady = true;

    // Clear watchdog timer
    if (this.rendererReadyTimer) {
      clearTimeout(this.rendererReadyTimer);
      this.rendererReadyTimer = null;
    }

    // Update config
    if (this.config.lastLaunch) {
      this.config.lastLaunch.rendererReady = true;
    }

    // Clear auto-fallback if we succeeded in GPU mode
    if (this.currentDecision?.mode === 'gpu' && this.config.autoFallback) {
      delete this.config.autoFallback;
    }

    // Generate notice if in software mode due to auto-fallback
    if (this.currentDecision?.mode === 'software' &&
        this.currentDecision.source === 'auto-fallback') {
      this.setPendingNotice({
        key: `fallback:${this.currentDecision.reason || 'gpu-startup-failed'}`,
        level: 'warning',
        message: 'Compatibility rendering is active after a previous GPU startup failure.'
      });
    }

    const notice = this.config.pendingNotice || null;

    // Mark notice as shown
    if (notice) {
      this.config.lastShownNoticeKey = notice.key;
      delete this.config.pendingNotice;
    }

    this.saveConfig();

    return {
      mode: this.currentDecision?.mode || 'gpu',
      source: this.currentDecision?.source || 'default',
      reason: this.currentDecision?.reason,
      notice
    };
  }

  /**
   * Handle renderer failure (crash or unresponsive)
   */
  handleRendererFailure(reason: string): void {
    if (this.currentDecision?.mode !== 'gpu') {
      // Not in GPU mode, nothing to do
      return;
    }

    console.error(`[RenderOptimizer] Renderer failure in GPU mode: ${reason}`);

    // Record failure
    if (this.config.lastLaunch) {
      this.config.lastLaunch.reason = reason;
    }

    this.saveConfig();
  }

  /**
   * Request relaunch in software mode
   */
  relaunchInSoftwareMode(reason: string): void {
    console.log(`[RenderOptimizer] Relaunching in software mode: ${reason}`);

    // Update config with failure reason
    if (this.config.lastLaunch) {
      this.config.lastLaunch.reason = reason;
    }

    // Increment failure count
    const appVersion = app.getVersion();
    const currentCount = this.config.autoFallback?.failureCount || 0;

    this.config.autoFallback = {
      reason,
      activatedAt: Date.now(),
      failureCount: currentCount + 1,
      appVersion
    };

    // Set pending notice
    this.setPendingNotice({
      key: `fallback:${reason}`,
      level: 'warning',
      message: this.config.autoFallback.failureCount >= FAILURE_THRESHOLD
        ? 'Compatibility rendering is active after repeated GPU startup failures.'
        : 'Compatibility rendering is active for this relaunch after a GPU startup failure. Nexus will retry GPU rendering on the next normal launch.'
    });

    this.saveConfig();

    // Relaunch with software rendering
    const args = process.argv.slice(1).filter(arg =>
      !arg.startsWith('--render-mode=') && arg !== '--disable-gpu'
    );
    args.push('--render-mode=software');

    app.relaunch({ args });
    app.exit(0);
  }

  // ==========================================================================
  // Performance Tracking
  // ==========================================================================

  /**
   * Record performance metrics
   */
  recordPerformanceMetrics(metrics: PerformanceMetrics): void {
    if (!this.config.performanceHistory) {
      this.config.performanceHistory = [];
    }

    this.config.performanceHistory.push(metrics);

    // Keep only recent history
    if (this.config.performanceHistory.length > PERFORMANCE_HISTORY_LIMIT) {
      this.config.performanceHistory = this.config.performanceHistory.slice(-PERFORMANCE_HISTORY_LIMIT);
    }

    // Update last launch performance score
    if (this.config.lastLaunch) {
      this.config.lastLaunch.performanceScore = this.calculatePerformanceScore(metrics);
    }

    this.saveConfig();
  }

  /**
   * Calculate overall performance score (0-100)
   */
  private calculatePerformanceScore(metrics: PerformanceMetrics): number {
    // Weight factors
    const fpsScore = Math.min(metrics.fps / 60, 1) * 40; // 40% weight
    const memoryScore = Math.max(0, 1 - metrics.memoryUsageMB / 2000) * 30; // 30% weight
    const latencyScore = Math.max(0, 1 - metrics.renderLatencyMs / 100) * 30; // 30% weight

    return Math.round(fpsScore + memoryScore + latencyScore);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    avgFps: number;
    avgMemoryMB: number;
    avgLatencyMs: number;
    overallScore: number;
  } | null {
    const history = this.config.performanceHistory;

    if (!history || history.length === 0) {
      return null;
    }

    const sum = history.reduce(
      (acc, m) => ({
        fps: acc.fps + m.fps,
        memory: acc.memory + m.memoryUsageMB,
        latency: acc.latency + m.renderLatencyMs
      }),
      { fps: 0, memory: 0, latency: 0 }
    );

    const count = history.length;
    const avgFps = sum.fps / count;
    const avgMemoryMB = sum.memory / count;
    const avgLatencyMs = sum.latency / count;

    const overallScore = this.calculatePerformanceScore({
      fps: avgFps,
      memoryUsageMB: avgMemoryMB,
      gpuUsagePercent: 0,
      renderLatencyMs: avgLatencyMs,
      timestamp: Date.now()
    });

    return {
      avgFps,
      avgMemoryMB,
      avgLatencyMs,
      overallScore
    };
  }

  // ==========================================================================
  // GPU Detection
  // ==========================================================================

  /**
   * Detect GPU capabilities
   */
  async detectGPUCapability(): Promise<GPUCapability | null> {
    // Note: This is a placeholder. Actual GPU detection would require
    // native bindings or browser APIs in the renderer process.
    // In production, this would be called from the renderer and sent via IPC.

    return null;
  }

  /**
   * Save detected GPU capability
   */
  saveGPUCapability(capability: GPUCapability): void {
    this.config.gpuCapability = capability;
    this.saveConfig();
  }

  // ==========================================================================
  // Notice Management
  // ==========================================================================

  /**
   * Set pending notice for user
   */
  private setPendingNotice(notice: PendingNotice): void {
    // Don't show same notice twice
    if (this.config.lastShownNoticeKey === notice.key) {
      return;
    }

    this.config.pendingNotice = notice;
  }

  /**
   * Get pending notice (if any)
   */
  getPendingNotice(): PendingNotice | null {
    return this.config.pendingNotice || null;
  }

  /**
   * Clear pending notice
   */
  clearPendingNotice(): void {
    if (this.config.pendingNotice) {
      this.config.lastShownNoticeKey = this.config.pendingNotice.key;
      delete this.config.pendingNotice;
      this.saveConfig();
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get current render mode decision
   */
  getCurrentDecision(): RenderModeDecision | null {
    return this.currentDecision;
  }

  /**
   * Check if renderer is ready
   */
  isReady(): boolean {
    return this.isRendererReady;
  }

  /**
   * Get configuration file path
   */
  getConfigPath(): string {
    return this.configPath;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a RenderOptimizer instance
 */
export function createRenderOptimizer(userDataPath?: string): RenderOptimizer {
  const dataPath = userDataPath || app.getPath('userData');
  return new RenderOptimizer(dataPath);
}

// ============================================================================
// Export
// ============================================================================

export default RenderOptimizer;
