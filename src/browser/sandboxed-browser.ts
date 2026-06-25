/**
 * Sandboxed Browser - WebContentsView based browser with automation
 */

import { BrowserWindow, WebContentsView, session } from 'electron';
import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';

const logger = createLogger('Browser');

/**
 * Browser tab
 */
export interface BrowserTab {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

/**
 * Navigation event
 */
export interface NavigationEvent {
  url: string;
  title: string;
  timestamp: number;
}

/**
 * Sandboxed Browser Manager
 */
export class SandboxedBrowser extends EventEmitter {
  private window?: BrowserWindow;
  private tabs = new Map<string, WebContentsView>();
  private activeTabId?: string;
  private navigationHistory: NavigationEvent[] = [];

  /**
   * Initialize browser
   */
  async initialize(): Promise<void> {
    this.createWindow();
    await this.setupSession();
    logger.info('Sandboxed browser initialized');
  }

  /**
   * Create browser window
   */
  private createWindow(): void {
    this.window = new BrowserWindow({
      width: 1200,
      height: 800,
      title: 'Aether Browser',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });

    this.window.on('closed', () => {
      this.cleanup();
    });

    logger.info('Browser window created');
  }

  /**
   * Setup isolated session
   */
  private async setupSession(): Promise<void> {
    const browserSession = session.fromPartition('persist:aether-browser', {
      cache: true
    });

    // Block third-party cookies
    await browserSession.cookies.set({
      url: 'https://example.com',
      name: 'samesite-test',
      value: 'test',
      sameSite: 'strict'
    });

    // Enable content blocking
    browserSession.webRequest.onBeforeRequest((details, callback) => {
      const blockedPatterns = [
        /doubleclick\.net/,
        /googlesyndication\.com/,
        /facebook\.com\/tr/,
        /google-analytics\.com/
      ];

      const shouldBlock = blockedPatterns.some(pattern => pattern.test(details.url));

      callback({ cancel: shouldBlock });
    });

    logger.info('Browser session configured');
  }

  /**
   * Create new tab
   */
  createTab(url: string = 'about:blank'): string {
    const tabId = `tab_${Date.now()}`;

    const view = new WebContentsView({
      webPreferences: {
        partition: 'persist:aether-browser',
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        javascript: true,
        images: true
      }
    });

    // Setup event listeners
    this.setupTabEvents(view, tabId);

    // Store tab
    this.tabs.set(tabId, view);

    // Navigate to URL
    if (url !== 'about:blank') {
      view.webContents.loadURL(url);
    }

    // Set as active
    this.setActiveTab(tabId);

    logger.info(`Tab created: ${tabId}`);
    this.emit('tab-created', { id: tabId, url });

    return tabId;
  }

  /**
   * Setup tab event listeners
   */
  private setupTabEvents(view: WebContentsView, tabId: string): void {
    const { webContents } = view;

    // Navigation events
    webContents.on('did-start-loading', () => {
      this.emit('tab-loading', { id: tabId, isLoading: true });
    });

    webContents.on('did-stop-loading', () => {
      this.emit('tab-loading', { id: tabId, isLoading: false });
    });

    webContents.on('did-navigate', (event, url) => {
      const navigationEvent: NavigationEvent = {
        url,
        title: webContents.getTitle(),
        timestamp: Date.now()
      };

      this.navigationHistory.push(navigationEvent);
      this.emit('tab-navigated', { id: tabId, ...navigationEvent });

      logger.info(`Tab navigated: ${url}`);
    });

    webContents.on('page-title-updated', (event, title) => {
      this.emit('tab-title-updated', { id: tabId, title });
    });

    // Console messages
    webContents.on('console-message', (event, level, message, line, sourceId) => {
      logger.info(`[Tab ${tabId}] ${message}`);
    });

    // Download handling
    webContents.session.on('will-download', (event, item) => {
      this.emit('download-started', {
        tabId,
        filename: item.getFilename(),
        url: item.getURL()
      });
    });
  }

  /**
   * Set active tab
   */
  setActiveTab(tabId: string): void {
    const view = this.tabs.get(tabId);
    if (!view || !this.window) return;

    // Remove previous view
    if (this.activeTabId) {
      const prevView = this.tabs.get(this.activeTabId);
      if (prevView) {
        this.window.contentView.removeChildView(prevView);
      }
    }

    // Add new view
    this.window.contentView.addChildView(view);

    const bounds = this.window.getBounds();
    view.setBounds({
      x: 0,
      y: 60, // Leave space for toolbar
      width: bounds.width,
      height: bounds.height - 60
    });

    this.activeTabId = tabId;
    this.emit('tab-activated', { id: tabId });

    logger.info(`Tab activated: ${tabId}`);
  }

  /**
   * Close tab
   */
  closeTab(tabId: string): void {
    const view = this.tabs.get(tabId);
    if (!view) return;

    if (this.window && this.activeTabId === tabId) {
      this.window.contentView.removeChildView(view);
    }

    // 清理该 tab 的 webContents 上的所有事件监听器
    view.webContents.removeAllListeners();
    // 也清理 session 级别的监听器（will-download）
    view.webContents.session.removeAllListeners('will-download');

    this.tabs.delete(tabId);
    this.emit('tab-closed', { id: tabId });

    logger.info(`Tab closed: ${tabId}`);
  }

  /**
   * Navigate tab
   */
  navigate(tabId: string, url: string): void {
    const view = this.tabs.get(tabId);
    if (!view) return;

    view.webContents.loadURL(url);
    logger.info(`Tab navigating: ${url}`);
  }

  /**
   * Go back
   */
  goBack(tabId: string): void {
    const view = this.tabs.get(tabId);
    if (view?.webContents.canGoBack()) {
      view.webContents.goBack();
    }
  }

  /**
   * Go forward
   */
  goForward(tabId: string): void {
    const view = this.tabs.get(tabId);
    if (view?.webContents.canGoForward()) {
      view.webContents.goForward();
    }
  }

  /**
   * Reload tab
   */
  reload(tabId: string): void {
    const view = this.tabs.get(tabId);
    if (view) {
      view.webContents.reload();
    }
  }

  /**
   * Execute JavaScript in tab
   */
  async executeScript(tabId: string, script: string): Promise<any> {
    const view = this.tabs.get(tabId);
    if (!view) throw new Error('Tab not found');

    return view.webContents.executeJavaScript(script);
  }

  /**
   * Take screenshot
   */
  async takeScreenshot(tabId: string): Promise<Buffer> {
    const view = this.tabs.get(tabId);
    if (!view) throw new Error('Tab not found');

    const image = await view.webContents.capturePage();
    return image.toPNG();
  }

  /**
   * Get tab info
   */
  getTabInfo(tabId: string): BrowserTab | null {
    const view = this.tabs.get(tabId);
    if (!view) return null;

    const { webContents } = view;

    return {
      id: tabId,
      title: webContents.getTitle(),
      url: webContents.getURL(),
      isLoading: webContents.isLoading(),
      canGoBack: webContents.canGoBack(),
      canGoForward: webContents.canGoForward()
    };
  }

  /**
   * List all tabs
   */
  listTabs(): BrowserTab[] {
    return Array.from(this.tabs.keys())
      .map(id => this.getTabInfo(id))
      .filter((tab): tab is BrowserTab => tab !== null);
  }

  /**
   * Get navigation history
   */
  getHistory(): NavigationEvent[] {
    return this.navigationHistory;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.navigationHistory = [];
    logger.info('Navigation history cleared');
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.tabs.forEach((view, tabId) => {
      this.closeTab(tabId);
    });

    this.tabs.clear();
    this.window = undefined;

    logger.info('Browser cleanup completed');
  }

  /**
   * Destroy browser
   */
  destroy(): void {
    if (this.window) {
      this.window.webContents.removeAllListeners();
      this.window.close();
      this.window = undefined;
    }

    // 清理所有 tab 的事件监听器
    this.tabs.forEach((view) => {
      view.webContents.removeAllListeners();
      view.webContents.session.removeAllListeners('will-download');
    });
    this.tabs.clear();
    this.navigationHistory = [];

    // 清理自身 EventEmitter 的监听器
    this.removeAllListeners();

    logger.info('Browser destroyed');
  }
}
