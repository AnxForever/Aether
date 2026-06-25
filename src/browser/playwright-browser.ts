/**
 * Playwright Browser - Browser automation with Playwright
 *
 * 替换原有的 sandboxed-browser，提供更强大的浏览器自动化能力
 */

import { chromium, firefox, webkit, type Browser, type Page, type BrowserContext } from 'playwright-core';
import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';

const logger = createLogger('Browser:Playwright');

/**
 * 浏览器类型
 */
export type BrowserType = 'chromium' | 'firefox' | 'webkit';

/**
 * 浏览器配置
 */
export interface PlaywrightBrowserConfig {
  /** 浏览器类型 */
  browserType?: BrowserType;
  /** 是否无头模式 */
  headless?: boolean;
  /** 视口大小 */
  viewport?: { width: number; height: number };
  /** 用户代理 */
  userAgent?: string;
  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * 页面截图选项
 */
export interface ScreenshotOptions {
  /** 完整页面 */
  fullPage?: boolean;
  /** 路径 */
  path?: string;
  /** 格式 */
  type?: 'png' | 'jpeg';
  /** 质量 (0-100) */
  quality?: number;
}

/**
 * Playwright 浏览器管理器
 */
export class PlaywrightBrowser extends EventEmitter {
  private browser?: Browser;
  private context?: BrowserContext;
  private pages: Map<string, Page> = new Map();
  private config: PlaywrightBrowserConfig;

  constructor(config: PlaywrightBrowserConfig = {}) {
    super();
    this.config = {
      browserType: 'chromium',
      headless: true,
      timeout: 30000,
      ...config,
    };
  }

  /**
   * 启动浏览器
   */
  async launch(): Promise<void> {
    if (this.browser) {
      logger.warn('Browser already launched');
      return;
    }

    logger.info(`Launching ${this.config.browserType} browser`);

    // 选择浏览器
    const browserLauncher =
      this.config.browserType === 'firefox'
        ? firefox
        : this.config.browserType === 'webkit'
        ? webkit
        : chromium;

    // 启动浏览器
    this.browser = await browserLauncher.launch({
      headless: this.config.headless,
      timeout: this.config.timeout,
    });

    // 创建上下文
    this.context = await this.browser.newContext({
      viewport: this.config.viewport || { width: 1280, height: 720 },
      userAgent: this.config.userAgent,
    });

    logger.info('Browser launched successfully');
    this.emit('launched');
  }

  /**
   * 关闭浏览器
   */
  async close(): Promise<void> {
    logger.info('Closing browser');

    if (this.browser) {
      // 关闭所有页面
      for (const page of this.pages.values()) {
        await page.close().catch(() => {});
      }
      this.pages.clear();

      // 关闭上下文
      if (this.context) {
        await this.context.close();
        this.context = undefined;
      }

      // 关闭浏览器
      await this.browser.close();
      this.browser = undefined;
    }

    // 清理所有事件监听器，防止内存泄漏
    this.removeAllListeners();

    logger.info('Browser closed');
  }

  /**
   * 创建新页面
   */
  async newPage(): Promise<Page> {
    if (!this.context) {
      await this.launch();
    }

    const page = await this.context!.newPage();
    const pageId = `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.pages.set(pageId, page);

    logger.debug(`New page created: ${pageId}`);
    this.emit('page-created', pageId, page);

    return page;
  }

  /**
   * 导航到 URL
   */
  async navigate(url: string, pageId?: string): Promise<Page> {
    let page: Page;

    if (pageId && this.pages.has(pageId)) {
      page = this.pages.get(pageId)!;
    } else {
      page = await this.newPage();
    }

    logger.info(`Navigating to: ${url}`);

    await page.goto(url, {
      timeout: this.config.timeout,
      waitUntil: 'domcontentloaded',
    });

    this.emit('navigated', url, page);

    return page;
  }

  /**
   * 点击元素
   */
  async click(selector: string, page: Page): Promise<void> {
    logger.debug(`Clicking: ${selector}`);

    await page.click(selector, {
      timeout: this.config.timeout,
    });

    this.emit('clicked', selector);
  }

  /**
   * 填写表单
   */
  async fill(selector: string, value: string, page: Page): Promise<void> {
    logger.debug(`Filling ${selector} with: ${value}`);

    await page.fill(selector, value, {
      timeout: this.config.timeout,
    });

    this.emit('filled', selector, value);
  }

  /**
   * 截图
   */
  async screenshot(page: Page, options?: ScreenshotOptions): Promise<Buffer> {
    logger.debug('Taking screenshot');

    const screenshot = await page.screenshot({
      fullPage: options?.fullPage,
      path: options?.path,
      type: options?.type || 'png',
      quality: options?.quality,
    });

    this.emit('screenshot', screenshot);

    return screenshot;
  }

  /**
   * 获取页面内容
   */
  async getContent(page: Page): Promise<string> {
    const content = await page.content();
    return content;
  }

  /**
   * 获取页面文本
   */
  async getText(selector: string, page: Page): Promise<string> {
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    const text = await element.textContent();
    return text || '';
  }

  /**
   * 执行 JavaScript
   */
  async evaluate<T>(script: string, page: Page): Promise<T> {
    logger.debug('Evaluating script');

    const result = await page.evaluate(script);
    return result as T;
  }

  /**
   * 等待选择器
   */
  async waitForSelector(selector: string, page: Page, timeout?: number): Promise<void> {
    logger.debug(`Waiting for: ${selector}`);

    await page.waitForSelector(selector, {
      timeout: timeout || this.config.timeout,
    });
  }

  /**
   * 等待导航
   */
  async waitForNavigation(page: Page, timeout?: number): Promise<void> {
    logger.debug('Waiting for navigation');

    await page.waitForLoadState('domcontentloaded', {
      timeout: timeout || this.config.timeout,
    });
  }

  /**
   * 获取所有页面
   */
  getPages(): Page[] {
    return Array.from(this.pages.values());
  }

  /**
   * 关闭页面
   */
  async closePage(pageId: string): Promise<void> {
    const page = this.pages.get(pageId);
    if (page) {
      await page.close();
      this.pages.delete(pageId);
      logger.debug(`Page closed: ${pageId}`);
    }
  }
}

/**
 * 简化的浏览器工具（兼容旧接口）
 */
export class BrowserTool {
  private browser: PlaywrightBrowser;
  private currentPage?: Page;

  constructor(config?: PlaywrightBrowserConfig) {
    this.browser = new PlaywrightBrowser(config);
  }

  /**
   * 导航
   */
  async navigate(url: string): Promise<string> {
    this.currentPage = await this.browser.navigate(url);
    return url;
  }

  /**
   * 点击
   */
  async click(selector: string): Promise<void> {
    if (!this.currentPage) {
      throw new Error('No active page');
    }

    await this.browser.click(selector, this.currentPage);
  }

  /**
   * 填写
   */
  async fill(selector: string, value: string): Promise<void> {
    if (!this.currentPage) {
      throw new Error('No active page');
    }

    await this.browser.fill(selector, value, this.currentPage);
  }

  /**
   * 截图
   */
  async screenshot(options?: ScreenshotOptions): Promise<Buffer> {
    if (!this.currentPage) {
      throw new Error('No active page');
    }

    return this.browser.screenshot(this.currentPage, options);
  }

  /**
   * 获取内容
   */
  async getContent(): Promise<string> {
    if (!this.currentPage) {
      throw new Error('No active page');
    }

    return this.browser.getContent(this.currentPage);
  }

  /**
   * 关闭
   */
  async close(): Promise<void> {
    await this.browser.close();
  }
}
