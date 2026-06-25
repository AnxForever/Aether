/**
 * Theme Manager - Appearance and theme customization
 */

import { createLogger } from '../utils/logger';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { EventEmitter } from 'events';

const logger = createLogger('ThemeManager');

/**
 * Theme mode
 */
export type ThemeMode = 'light' | 'dark' | 'auto';

/**
 * Theme configuration
 */
export interface ThemeConfig {
  mode: ThemeMode;
  primaryColor: string;
  accentColor: string;
  customCSS?: string;
  fontSize?: number;
  fontFamily?: string;
}

/**
 * Default themes
 */
const DEFAULT_THEMES = {
  light: {
    mode: 'light' as ThemeMode,
    primaryColor: '#1a73e8',
    accentColor: '#34a853',
    fontSize: 14,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  dark: {
    mode: 'dark' as ThemeMode,
    primaryColor: '#8ab4f8',
    accentColor: '#81c995',
    fontSize: 14,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  }
};

/**
 * Theme Manager
 */
export class ThemeManager extends EventEmitter {
  private currentTheme: ThemeConfig;
  private themePath: string;

  constructor(dataDir: string) {
    super();
    this.themePath = join(dataDir, 'theme.json');
    this.currentTheme = DEFAULT_THEMES.light;
  }

  /**
   * Initialize theme manager
   */
  async initialize(): Promise<void> {
    await this.loadTheme();
    logger.info('Theme manager initialized');
  }

  /**
   * Load theme from disk
   */
  async loadTheme(): Promise<ThemeConfig> {
    try {
      const data = await readFile(this.themePath, 'utf-8');
      this.currentTheme = JSON.parse(data);
      logger.info(`Theme loaded: ${this.currentTheme.mode} mode`);
    } catch (error) {
      // Use default theme
      this.currentTheme = DEFAULT_THEMES.light;
      await this.saveTheme();
      logger.info('Using default theme');
    }

    return this.currentTheme;
  }

  /**
   * Save theme to disk
   */
  async saveTheme(): Promise<void> {
    await writeFile(this.themePath, JSON.stringify(this.currentTheme, null, 2), 'utf-8');
    logger.info('Theme saved');
  }

  /**
   * Get current theme
   */
  getTheme(): ThemeConfig {
    return { ...this.currentTheme };
  }

  /**
   * Set theme mode
   */
  async setMode(mode: ThemeMode): Promise<void> {
    this.currentTheme.mode = mode;

    // Apply default colors for the mode
    if (mode === 'light') {
      this.currentTheme.primaryColor = DEFAULT_THEMES.light.primaryColor;
      this.currentTheme.accentColor = DEFAULT_THEMES.light.accentColor;
    } else if (mode === 'dark') {
      this.currentTheme.primaryColor = DEFAULT_THEMES.dark.primaryColor;
      this.currentTheme.accentColor = DEFAULT_THEMES.dark.accentColor;
    }

    await this.saveTheme();
    this.emit('theme-changed', this.currentTheme);
    logger.info(`Theme mode changed: ${mode}`);
  }

  /**
   * Set primary color
   */
  async setPrimaryColor(color: string): Promise<void> {
    if (!this.isValidColor(color)) {
      throw new Error('Invalid color format');
    }

    this.currentTheme.primaryColor = color;
    await this.saveTheme();
    this.emit('theme-changed', this.currentTheme);
    logger.info(`Primary color changed: ${color}`);
  }

  /**
   * Set accent color
   */
  async setAccentColor(color: string): Promise<void> {
    if (!this.isValidColor(color)) {
      throw new Error('Invalid color format');
    }

    this.currentTheme.accentColor = color;
    await this.saveTheme();
    this.emit('theme-changed', this.currentTheme);
    logger.info(`Accent color changed: ${color}`);
  }

  /**
   * Set custom CSS
   */
  async setCustomCSS(css: string): Promise<void> {
    this.currentTheme.customCSS = css;
    await this.saveTheme();
    this.emit('theme-changed', this.currentTheme);
    logger.info('Custom CSS updated');
  }

  /**
   * Set font size
   */
  async setFontSize(size: number): Promise<void> {
    if (size < 10 || size > 24) {
      throw new Error('Font size must be between 10 and 24');
    }

    this.currentTheme.fontSize = size;
    await this.saveTheme();
    this.emit('theme-changed', this.currentTheme);
    logger.info(`Font size changed: ${size}px`);
  }

  /**
   * Set font family
   */
  async setFontFamily(family: string): Promise<void> {
    this.currentTheme.fontFamily = family;
    await this.saveTheme();
    this.emit('theme-changed', this.currentTheme);
    logger.info(`Font family changed: ${family}`);
  }

  /**
   * Update theme configuration
   */
  async updateTheme(config: Partial<ThemeConfig>): Promise<void> {
    this.currentTheme = {
      ...this.currentTheme,
      ...config
    };

    await this.saveTheme();
    this.emit('theme-changed', this.currentTheme);
    logger.info('Theme configuration updated');
  }

  /**
   * Reset to default theme
   */
  async resetTheme(): Promise<void> {
    this.currentTheme = DEFAULT_THEMES.light;
    await this.saveTheme();
    this.emit('theme-changed', this.currentTheme);
    logger.info('Theme reset to default');
  }

  /**
   * Get CSS variables for current theme
   */
  getCSSVariables(): Record<string, string> {
    return {
      '--primary-color': this.currentTheme.primaryColor,
      '--accent-color': this.currentTheme.accentColor,
      '--font-size': `${this.currentTheme.fontSize || 14}px`,
      '--font-family': this.currentTheme.fontFamily || 'system-ui'
    };
  }

  /**
   * Generate theme stylesheet
   */
  generateStylesheet(): string {
    const vars = this.getCSSVariables();
    const cssVars = Object.entries(vars)
      .map(([key, value]) => `  ${key}: ${value};`)
      .join('\n');

    let stylesheet = `:root {\n${cssVars}\n}\n`;

    if (this.currentTheme.customCSS) {
      stylesheet += `\n${this.currentTheme.customCSS}`;
    }

    return stylesheet;
  }

  /**
   * Validate color format
   */
  private isValidColor(color: string): boolean {
    // Support hex colors (#RGB, #RRGGBB, #RRGGBBAA)
    const hexPattern = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
    if (hexPattern.test(color)) return true;

    // Support rgb/rgba
    const rgbPattern = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/;
    if (rgbPattern.test(color)) return true;

    // Support hsl/hsla
    const hslPattern = /^hsla?\(\s*\d+\s*,\s*[\d.]+%\s*,\s*[\d.]+%\s*(,\s*[\d.]+\s*)?\)$/;
    if (hslPattern.test(color)) return true;

    return false;
  }
}
