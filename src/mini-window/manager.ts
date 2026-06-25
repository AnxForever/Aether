/**
 * Mini Window Manager - Floating mini window (280x42 pixels)
 */

import { BrowserWindow, globalShortcut, screen } from 'electron';
import { join } from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('MiniWindow');

/**
 * Mini Window Position
 */
export type MiniWindowPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

/**
 * Mini Window Manager
 */
export class MiniWindowManager {
  private window?: BrowserWindow;
  private position: MiniWindowPosition = 'top-right';
  private shortcut = 'CommandOrControl+Shift+Space';
  private isVisible = false;

  /**
   * Initialize mini window
   */
  initialize(): void {
    this.createWindow();
    this.registerShortcut();
    logger.info('Mini window initialized');
  }

  /**
   * Create mini window
   */
  private createWindow(): void {
    const { x, y } = this.calculatePosition();

    this.window = new BrowserWindow({
      width: 280,
      height: 42,
      x,
      y,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      hasShadow: true,
      vibrancy: 'under-window', // macOS vibrancy
      backgroundMaterial: 'acrylic', // Windows acrylic
      webPreferences: {
        preload: join(__dirname, '../preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    // Load mini window UI
    if (process.env.NODE_ENV === 'development') {
      this.window.loadURL('http://localhost:5173/mini');
    } else {
      this.window.loadFile(join(__dirname, '../../renderer/mini.html'));
    }

    // Hide by default
    this.window.hide();

    // Prevent window from closing
    this.window.on('close', (e) => {
      e.preventDefault();
      this.hide();
    });

    logger.info('Mini window created at position:', this.position as any);
  }

  /**
   * Calculate window position
   */
  private calculatePosition(): { x: number; y: number } {
    const display = screen.getPrimaryDisplay();
    const { width, height } = display.workAreaSize;

    const margin = 20;
    const windowWidth = 280;
    const windowHeight = 42;

    const positions = {
      'top-left': { x: margin, y: margin },
      'top-center': { x: Math.floor((width - windowWidth) / 2), y: margin },
      'top-right': { x: width - windowWidth - margin, y: margin },
      'bottom-left': { x: margin, y: height - windowHeight - margin },
      'bottom-center': { x: Math.floor((width - windowWidth) / 2), y: height - windowHeight - margin },
      'bottom-right': { x: width - windowWidth - margin, y: height - windowHeight - margin }
    };

    return positions[this.position];
  }

  /**
   * Register global shortcut
   */
  private registerShortcut(): void {
    globalShortcut.register(this.shortcut, () => {
      this.toggle();
    });

    logger.info(`Global shortcut registered: ${this.shortcut}`);
  }

  /**
   * Show mini window
   */
  show(): void {
    if (!this.window) return;

    this.window.show();
    this.window.focus();
    this.isVisible = true;

    logger.info('Mini window shown');
  }

  /**
   * Hide mini window
   */
  hide(): void {
    if (!this.window) return;

    this.window.hide();
    this.isVisible = false;

    logger.info('Mini window hidden');
  }

  /**
   * Toggle mini window visibility
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Set window position
   */
  setPosition(position: MiniWindowPosition): void {
    this.position = position;

    if (this.window) {
      const { x, y } = this.calculatePosition();
      this.window.setPosition(x, y);
      logger.info(`Mini window moved to: ${position}`);
    }
  }

  /**
   * Update global shortcut
   */
  setShortcut(shortcut: string): void {
    globalShortcut.unregister(this.shortcut);
    this.shortcut = shortcut;
    this.registerShortcut();
    logger.info(`Global shortcut updated: ${shortcut}`);
  }

  /**
   * Destroy mini window
   */
  destroy(): void {
    globalShortcut.unregister(this.shortcut);

    if (this.window) {
      this.window.destroy();
      this.window = undefined;
    }

    logger.info('Mini window destroyed');
  }

  /**
   * Get current visibility
   */
  getVisibility(): boolean {
    return this.isVisible;
  }
}
