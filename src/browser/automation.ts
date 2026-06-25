/**
 * Browser Automation - Puppeteer-like automation API
 */

import { SandboxedBrowser } from './sandboxed-browser';
import { createLogger } from '../utils/logger';

const logger = createLogger('Browser:Automation');

/**
 * Selector options
 */
export interface SelectorOptions {
  timeout?: number;
  visible?: boolean;
}

/**
 * Click options
 */
export interface ClickOptions {
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  delay?: number;
}

/**
 * Type options
 */
export interface TypeOptions {
  delay?: number;
}

/**
 * Browser Automation
 */
export class BrowserAutomation {
  constructor(private browser: SandboxedBrowser, private tabId: string) {}

  /**
   * Wait for selector
   */
  async waitForSelector(selector: string, options: SelectorOptions = {}): Promise<void> {
    const timeout = options.timeout || 30000;
    const visible = options.visible !== false;

    const script = `
      new Promise((resolve, reject) => {
        const startTime = Date.now();
        const checkElement = () => {
          const element = document.querySelector('${selector}');

          if (element) {
            if (${visible}) {
              const rect = element.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                resolve(true);
                return;
              }
            } else {
              resolve(true);
              return;
            }
          }

          if (Date.now() - startTime > ${timeout}) {
            reject(new Error('Timeout waiting for selector: ${selector}'));
            return;
          }

          setTimeout(checkElement, 100);
        };

        checkElement();
      });
    `;

    await this.browser.executeScript(this.tabId, script);
    logger.info(`Selector found: ${selector}`);
  }

  /**
   * Click element
   */
  async click(selector: string, options: ClickOptions = {}): Promise<void> {
    await this.waitForSelector(selector);

    const script = `
      (() => {
        const element = document.querySelector('${selector}');
        if (!element) throw new Error('Element not found: ${selector}');

        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        element.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y
        }));

        return true;
      })();
    `;

    await this.browser.executeScript(this.tabId, script);
    logger.info(`Clicked: ${selector}`);
  }

  /**
   * Type text
   */
  async type(selector: string, text: string, options: TypeOptions = {}): Promise<void> {
    await this.waitForSelector(selector);

    const delay = options.delay || 0;

    const script = `
      (() => {
        const element = document.querySelector('${selector}');
        if (!element) throw new Error('Element not found: ${selector}');

        element.focus();
        element.value = '${text.replace(/'/g, "\\'")}';

        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        return true;
      })();
    `;

    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    await this.browser.executeScript(this.tabId, script);
    logger.info(`Typed into: ${selector}`);
  }

  /**
   * Get element text
   */
  async getText(selector: string): Promise<string> {
    await this.waitForSelector(selector);

    const script = `
      (() => {
        const element = document.querySelector('${selector}');
        if (!element) throw new Error('Element not found: ${selector}');
        return element.textContent || '';
      })();
    `;

    return this.browser.executeScript(this.tabId, script);
  }

  /**
   * Get element attribute
   */
  async getAttribute(selector: string, attribute: string): Promise<string | null> {
    await this.waitForSelector(selector);

    const script = `
      (() => {
        const element = document.querySelector('${selector}');
        if (!element) throw new Error('Element not found: ${selector}');
        return element.getAttribute('${attribute}');
      })();
    `;

    return this.browser.executeScript(this.tabId, script);
  }

  /**
   * Check if element exists
   */
  async exists(selector: string): Promise<boolean> {
    const script = `
      (() => {
        const element = document.querySelector('${selector}');
        return element !== null;
      })();
    `;

    return this.browser.executeScript(this.tabId, script);
  }

  /**
   * Get all elements matching selector
   */
  async querySelectorAll(selector: string): Promise<string[]> {
    const script = `
      (() => {
        const elements = document.querySelectorAll('${selector}');
        return Array.from(elements).map(el => el.outerHTML);
      })();
    `;

    return this.browser.executeScript(this.tabId, script);
  }

  /**
   * Evaluate JavaScript
   */
  async evaluate<T>(fn: () => T): Promise<T> {
    const script = `(${fn.toString()})()`;
    return this.browser.executeScript(this.tabId, script);
  }

  /**
   * Wait for navigation
   */
  async waitForNavigation(timeout: number = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Navigation timeout'));
      }, timeout);

      this.browser.once('tab-navigated', (event) => {
        if (event.id === this.tabId) {
          clearTimeout(timer);
          resolve();
        }
      });
    });
  }

  /**
   * Take screenshot
   */
  async screenshot(): Promise<Buffer> {
    return this.browser.takeScreenshot(this.tabId);
  }

  /**
   * Get page HTML
   */
  async getHTML(): Promise<string> {
    const script = `document.documentElement.outerHTML`;
    return this.browser.executeScript(this.tabId, script);
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    const script = `document.title`;
    return this.browser.executeScript(this.tabId, script);
  }

  /**
   * Get current URL
   */
  async getURL(): Promise<string> {
    const script = `window.location.href`;
    return this.browser.executeScript(this.tabId, script);
  }
}
