/**
 * Nexus Render Optimizer - Usage Examples
 *
 * This file demonstrates how to use the RenderOptimizer in your Electron app.
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import { createRenderOptimizer, RenderOptimizer, PerformanceMetrics } from './render-optimizer';

// ============================================================================
// Example 1: Basic Setup in Main Process
// ============================================================================

let renderOptimizer: RenderOptimizer;
let mainWindow: BrowserWindow | null = null;

function initializeRenderOptimizer() {
  // Create the optimizer instance
  renderOptimizer = createRenderOptimizer();

  // Decide which render mode to use
  const decision = renderOptimizer.decideRenderMode(
    process.argv,
    process.env,
    {
      appVersion: app.getVersion(),
      hardwareAccelerationEnabled: true // from user settings
    }
  );

  console.log(`[Nexus] Render mode: ${decision.mode} (${decision.source})`);
  if (decision.reason) {
    console.log(`[Nexus] Reason: ${decision.reason}`);
  }

  // Apply Electron switches
  renderOptimizer.applyElectronSwitches(decision);

  // Start watchdog timer (only in GPU mode)
  renderOptimizer.startRendererReadyWatchdog(() => {
    // Renderer didn't report ready in time
    renderOptimizer.relaunchInSoftwareMode(
      'Renderer did not report readiness within 15 seconds'
    );
  });
}

// ============================================================================
// Example 2: Creating the Main Window
// ============================================================================

function createMainWindow() {
  const decision = renderOptimizer.getCurrentDecision();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: decision?.mode === 'software', // Show immediately in software mode
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Handle renderer process crashes
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    const { reason, exitCode } = details;

    console.error(`[Nexus] Renderer process gone: ${reason} (exit ${exitCode})`);

    // Only handle GPU mode failures
    if (decision?.mode === 'gpu' && !renderOptimizer.isReady()) {
      renderOptimizer.handleRendererFailure(
        `Renderer process exited during startup: ${reason}`
      );
      renderOptimizer.relaunchInSoftwareMode(
        `Renderer crash: ${reason}`
      );
    }
  });

  // In software mode, show after a timeout
  if (decision?.mode === 'software') {
    setTimeout(() => {
      mainWindow?.show();
    }, 2000);
  }

  mainWindow.loadFile('index.html');
}

// ============================================================================
// Example 3: IPC Handlers
// ============================================================================

function setupIPCHandlers() {
  // Renderer reports it's ready
  ipcMain.handle('render:renderer-ready', () => {
    const result = renderOptimizer.markRendererReady();

    console.log(`[Nexus] Renderer ready: mode=${result.mode}, source=${result.source}`);

    // Show window now that renderer is ready (GPU mode only)
    if (result.mode === 'gpu' && mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }

    // Return info to renderer
    return {
      mode: result.mode,
      source: result.source,
      notice: result.notice
    };
  });

  // Get current render mode
  ipcMain.handle('render:get-mode', () => {
    const decision = renderOptimizer.getCurrentDecision();
    return {
      mode: decision?.mode || 'gpu',
      source: decision?.source || 'default'
    };
  });

  // Record performance metrics from renderer
  ipcMain.handle('render:record-metrics', (event, metrics: PerformanceMetrics) => {
    renderOptimizer.recordPerformanceMetrics(metrics);
  });

  // Get performance statistics
  ipcMain.handle('render:get-stats', () => {
    return renderOptimizer.getPerformanceStats();
  });

  // Clear auto-fallback (when user manually changes settings)
  ipcMain.handle('render:clear-fallback', () => {
    renderOptimizer.clearAutoFallback();
  });

  // Get configuration
  ipcMain.handle('render:get-config', () => {
    return renderOptimizer.getConfig();
  });
}

// ============================================================================
// Example 4: App Lifecycle
// ============================================================================

// Before app is ready
app.on('will-finish-launching', () => {
  initializeRenderOptimizer();
});

app.on('ready', () => {
  setupIPCHandlers();
  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============================================================================
// Example 5: Renderer Process (preload.js)
// ============================================================================

/*
// In your preload.js:

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nexusRender', {
  // Report renderer is ready
  reportReady: () => ipcRenderer.invoke('render:renderer-ready'),

  // Get current render mode
  getMode: () => ipcRenderer.invoke('render:get-mode'),

  // Record performance metrics
  recordMetrics: (metrics) => ipcRenderer.invoke('render:record-metrics', metrics),

  // Get performance stats
  getStats: () => ipcRenderer.invoke('render:get-stats'),

  // Clear auto-fallback
  clearFallback: () => ipcRenderer.invoke('render:clear-fallback'),

  // Get configuration
  getConfig: () => ipcRenderer.invoke('render:get-config')
});
*/

// ============================================================================
// Example 6: Renderer Process (index.html / React component)
// ============================================================================

/*
// In your renderer code:

async function initializeRenderer() {
  // Report that renderer is ready
  const result = await window.nexusRender.reportReady();

  console.log(`Running in ${result.mode} mode`);

  // Show notice if there is one
  if (result.notice) {
    showNotification(result.notice.level, result.notice.message);
  }

  // Start performance monitoring
  startPerformanceMonitoring();
}

function startPerformanceMonitoring() {
  setInterval(async () => {
    // Measure FPS (simplified example)
    const fps = measureFPS();

    // Get memory usage
    const memoryInfo = performance.memory;
    const memoryUsageMB = memoryInfo.usedJSHeapSize / (1024 * 1024);

    // Measure render latency
    const renderLatencyMs = measureRenderLatency();

    // Send metrics to main process
    await window.nexusRender.recordMetrics({
      fps,
      memoryUsageMB,
      gpuUsagePercent: 0, // Would need WebGL extension to measure
      renderLatencyMs,
      timestamp: Date.now()
    });
  }, 5000); // Every 5 seconds
}

function measureFPS() {
  // Simple FPS counter
  let lastTime = performance.now();
  let frames = 0;

  requestAnimationFrame(function count() {
    frames++;
    const now = performance.now();
    if (now >= lastTime + 1000) {
      const fps = Math.round((frames * 1000) / (now - lastTime));
      frames = 0;
      lastTime = now;
      return fps;
    }
    requestAnimationFrame(count);
  });
}

function measureRenderLatency() {
  const start = performance.now();
  // Force a layout recalc
  document.body.offsetHeight;
  return performance.now() - start;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeRenderer);
*/

// ============================================================================
// Example 7: Command-line Usage
// ============================================================================

/*
# Force GPU mode
nexus --render-mode=gpu

# Force software rendering
nexus --render-mode=software

# Force hybrid mode
nexus --render-mode=hybrid

# Disable GPU (equivalent to software mode)
nexus --disable-gpu

# Use environment variable
NEXUS_RENDER_MODE=software nexus

# Auto mode (let system decide)
nexus --render-mode=auto
*/

// ============================================================================
// Example 8: Configuration File Format
// ============================================================================

/*
// ~/.nexus/desktop-render-mode.json

{
  "version": 1,
  "lastLaunch": {
    "startedAt": 1703001234567,
    "appVersion": "1.0.0",
    "mode": "gpu",
    "source": "default",
    "rendererReady": true,
    "performanceScore": 85
  },
  "gpuCapability": {
    "vendor": "NVIDIA Corporation",
    "renderer": "GeForce RTX 3080",
    "vramMB": 10240,
    "supportsWebGL2": true,
    "supportsWebGPU": true,
    "driverVersion": "535.98"
  },
  "performanceHistory": [
    {
      "fps": 60,
      "memoryUsageMB": 245,
      "gpuUsagePercent": 45,
      "renderLatencyMs": 2.5,
      "timestamp": 1703001234567
    }
  ]
}
*/

// ============================================================================
// Example 9: User Settings Integration
// ============================================================================

/*
// In your settings UI:

async function onHardwareAccelerationToggle(enabled: boolean) {
  // Save to user settings
  await saveUserSetting('hardwareAcceleration', enabled);

  // Clear auto-fallback when user manually changes
  await window.nexusRender.clearFallback();

  // Prompt restart
  const shouldRestart = await showDialog({
    title: 'Restart Required',
    message: 'Hardware acceleration setting requires a restart to take effect.',
    buttons: ['Restart Now', 'Later']
  });

  if (shouldRestart === 'Restart Now') {
    // Trigger app restart
    ipcRenderer.invoke('app:relaunch');
  }
}

// Display current render mode in settings
async function displayRenderMode() {
  const mode = await window.nexusRender.getMode();
  const stats = await window.nexusRender.getStats();

  document.getElementById('render-mode').textContent = mode.mode;
  document.getElementById('render-source').textContent = mode.source;

  if (stats) {
    document.getElementById('avg-fps').textContent = `${stats.avgFps.toFixed(1)} FPS`;
    document.getElementById('avg-memory').textContent = `${stats.avgMemoryMB.toFixed(0)} MB`;
    document.getElementById('performance-score').textContent = `${stats.overallScore}/100`;
  }
}
*/

// ============================================================================
// Example 10: Troubleshooting
// ============================================================================

/*
If you're experiencing rendering issues:

1. Check the configuration file:
   - Location: ~/.nexus/desktop-render-mode.json
   - Look for "autoFallback" section to see if GPU failures occurred

2. Force software rendering:
   nexus --render-mode=software

3. Clear auto-fallback state:
   - Delete ~/.nexus/desktop-render-mode.json
   - Or use the settings UI to clear fallback

4. Check logs:
   - Look for "[RenderOptimizer]" prefixed messages
   - Check for "render-process-gone" events

5. GPU detection:
   - Run with --enable-logging to see GPU info
   - Check chrome://gpu in the renderer for detailed GPU status
*/

export { renderOptimizer, mainWindow };
