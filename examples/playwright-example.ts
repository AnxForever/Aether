/**
 * Playwright Browser Example
 *
 * 演示 Playwright 浏览器自动化功能
 */

import { PlaywrightBrowser, BrowserTool, type PlaywrightBrowserConfig } from './playwright-browser';
import { createLogger } from '../utils/logger';

const logger = createLogger('PlaywrightExample');

/**
 * 示例 1：基础导航和截图
 */
export async function exampleBasicNavigation() {
  logger.info('=== Example 1: Basic Navigation ===');

  const browser = new PlaywrightBrowser({
    headless: true,
    viewport: { width: 1920, height: 1080 },
  });

  try {
    await browser.launch();

    const page = await browser.navigate('https://example.com');
    logger.info('Navigated to example.com');

    const content = await browser.getContent(page);
    logger.info(`Page content length: ${content.length}`);

    const screenshot = await browser.screenshot(page, {
      fullPage: true,
      type: 'png',
    });
    logger.info(`Screenshot taken: ${screenshot.length} bytes`);

    await browser.close();
  } catch (error: any) {
    logger.error('Example 1 failed:', error);
  }
}

/**
 * 示例 2：表单填写和提交
 */
export async function exampleFormFilling() {
  logger.info('\n=== Example 2: Form Filling ===');

  const browser = new PlaywrightBrowser({
    headless: true,
  });

  try {
    await browser.launch();

    const page = await browser.navigate('https://www.google.com');

    // 填写搜索框
    await browser.fill('input[name="q"]', 'Playwright automation', page);
    logger.info('Search input filled');

    // 点击搜索按钮
    await browser.click('input[name="btnK"]', page);
    logger.info('Search button clicked');

    // 等待导航
    await browser.waitForNavigation(page);
    logger.info('Navigation completed');

    await browser.close();
  } catch (error: any) {
    logger.error('Example 2 failed:', error);
  }
}

/**
 * 示例 3：多页面管理
 */
export async function exampleMultiplePages() {
  logger.info('\n=== Example 3: Multiple Pages ===');

  const browser = new PlaywrightBrowser({
    headless: true,
  });

  try {
    await browser.launch();

    // 创建多个页面
    const page1 = await browser.navigate('https://example.com');
    const page2 = await browser.navigate('https://github.com');
    const page3 = await browser.navigate('https://stackoverflow.com');

    logger.info(`Total pages: ${browser.getPages().length}`);

    // 分别操作
    const content1 = await browser.getContent(page1);
    const content2 = await browser.getContent(page2);
    const content3 = await browser.getContent(page3);

    logger.info(`Page 1: ${content1.length} bytes`);
    logger.info(`Page 2: ${content2.length} bytes`);
    logger.info(`Page 3: ${content3.length} bytes`);

    await browser.close();
  } catch (error: any) {
    logger.error('Example 3 failed:', error);
  }
}

/**
 * 示例 4：JavaScript 执行
 */
export async function exampleJavaScriptExecution() {
  logger.info('\n=== Example 4: JavaScript Execution ===');

  const browser = new PlaywrightBrowser({
    headless: true,
  });

  try {
    await browser.launch();

    const page = await browser.navigate('https://example.com');

    // 执行 JavaScript
    const title = await browser.evaluate<string>('document.title', page);
    logger.info(`Page title: ${title}`);

    const url = await browser.evaluate<string>('window.location.href', page);
    logger.info(`Current URL: ${url}`);

    const linksCount = await browser.evaluate<number>(
      'document.querySelectorAll("a").length',
      page
    );
    logger.info(`Links count: ${linksCount}`);

    await browser.close();
  } catch (error: any) {
    logger.error('Example 4 failed:', error);
  }
}

/**
 * 示例 5：简化工具接口
 */
export async function exampleBrowserTool() {
  logger.info('\n=== Example 5: Browser Tool ===');

  const tool = new BrowserTool({
    headless: true,
  });

  try {
    await tool.navigate('https://example.com');
    logger.info('Navigated to example.com');

    const content = await tool.getContent();
    logger.info(`Content length: ${content.length}`);

    const screenshot = await tool.screenshot({
      fullPage: true,
    });
    logger.info(`Screenshot: ${screenshot.length} bytes`);

    await tool.close();
  } catch (error: any) {
    logger.error('Example 5 failed:', error);
  }
}

/**
 * 示例 6：事件监听
 */
export async function exampleEventListeners() {
  logger.info('\n=== Example 6: Event Listeners ===');

  const browser = new PlaywrightBrowser({
    headless: true,
  });

  // 监听事件
  browser.on('launched', () => {
    logger.info('Event: Browser launched');
  });

  browser.on('navigated', (url) => {
    logger.info(`Event: Navigated to ${url}`);
  });

  browser.on('screenshot', (data) => {
    logger.info(`Event: Screenshot taken (${data.length} bytes)`);
  });

  browser.on('closed', () => {
    logger.info('Event: Browser closed');
  });

  try {
    await browser.launch();

    const page = await browser.navigate('https://example.com');
    await browser.screenshot(page);

    await browser.close();
  } catch (error: any) {
    logger.error('Example 6 failed:', error);
  }
}

/**
 * 运行所有示例
 */
export async function runAllPlaywrightExamples() {
  await exampleBasicNavigation();
  await exampleFormFilling();
  await exampleMultiplePages();
  await exampleJavaScriptExecution();
  await exampleBrowserTool();
  await exampleEventListeners();

  logger.info('\n=== All Playwright examples completed ===');
}

// 如果直接运行此文件
if (require.main === module) {
  runAllPlaywrightExamples().catch((error) => {
    logger.error('Playwright examples failed:', error);
    process.exit(1);
  });
}
