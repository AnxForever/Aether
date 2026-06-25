/**
 * i18n Manager
 *
 * Main entry point for internationalization using i18next
 * Inherits from EventEmitter for event-driven language switching
 */

import i18next, { TFunction } from 'i18next';
import Backend from 'i18next-fs-backend';
import { EventEmitter } from 'eventemitter3';
import * as path from 'path';
import type {
  SupportedLocale,
  I18nNamespace,
  I18nConfig,
  TranslationOptions,
  I18nManagerInterface,
  I18nEvents,
} from './types';
import { LocaleLoader } from './locale-loader';

export class I18nManager extends EventEmitter<I18nEvents> implements I18nManagerInterface {
  private config: I18nConfig;
  private localeLoader: LocaleLoader;
  private initialized = false;
  private currentLocale: SupportedLocale;

  constructor(config?: Partial<I18nConfig>) {
    super();

    // Default configuration
    this.config = {
      defaultLocale: (process.env.NEXUS_LOCALE as SupportedLocale) || 'en',
      fallbackLocale: (process.env.NEXUS_FALLBACK_LOCALE as SupportedLocale) || 'en',
      supportedLocales: ['en', 'zh'],
      namespaces: ['common', 'errors', 'skills'],
      localesDir: path.join(__dirname, 'locales'),
      ...config,
    };

    this.currentLocale = this.config.defaultLocale;

    // Initialize locale loader
    this.localeLoader = new LocaleLoader({
      localesDir: this.config.localesDir,
      supportedLocales: this.config.supportedLocales,
      namespaces: this.config.namespaces,
      enableHotReload: process.env.NODE_ENV !== 'production',
    });
  }

  /**
   * Initialize i18next
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('[I18nManager] Already initialized');
      return;
    }

    try {
      // Load all resources
      const resources = await this.localeLoader.loadAll();

      // Initialize i18next
      await i18next.use(Backend).init({
        lng: this.currentLocale,
        fallbackLng: this.config.fallbackLocale,
        supportedLngs: this.config.supportedLocales,
        ns: this.config.namespaces,
        defaultNS: 'common',
        resources,
        interpolation: {
          escapeValue: false, // React already escapes
        },
        returnNull: false,
        returnEmptyString: false,
        returnObjects: false,
      });

      this.initialized = true;

      // Enable hot reload in development
      if (process.env.NODE_ENV !== 'production') {
        await this.localeLoader.enableHotReload((locale, namespace) => {
          this.handleResourceReload(locale, namespace);
        });
      }

      this.emit('initialized');
      console.log(`[I18nManager] Initialized with locale: ${this.currentLocale}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', err);
      throw new Error(`Failed to initialize i18n: ${err.message}`);
    }
  }

  /**
   * Handle resource reload (hot reload)
   */
  private async handleResourceReload(locale: SupportedLocale, namespace: I18nNamespace): Promise<void> {
    try {
      const newContent = await this.localeLoader.loadLocaleFile(locale, namespace);

      // Add resource bundle to i18next
      i18next.addResourceBundle(locale, namespace, newContent, true, true);

      this.emit('resourcesLoaded', locale, namespace);
      console.log(`[I18nManager] Hot reloaded: ${locale}/${namespace}`);
    } catch (error) {
      console.error(`[I18nManager] Failed to hot reload ${locale}/${namespace}:`, error);
    }
  }

  /**
   * Get current locale
   */
  getCurrentLocale(): SupportedLocale {
    return this.currentLocale;
  }

  /**
   * Change language
   */
  async changeLanguage(locale: SupportedLocale): Promise<void> {
    if (!this.config.supportedLocales.includes(locale)) {
      throw new Error(`Unsupported locale: ${locale}`);
    }

    if (!this.initialized) {
      throw new Error('I18nManager not initialized');
    }

    try {
      await i18next.changeLanguage(locale);
      this.currentLocale = locale;
      this.emit('languageChanged', locale);
      console.log(`[I18nManager] Language changed to: ${locale}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', err);
      throw new Error(`Failed to change language: ${err.message}`);
    }
  }

  /**
   * Translate a key (default namespace: common)
   */
  t(key: string, options?: TranslationOptions): string {
    if (!this.initialized) {
      console.warn('[I18nManager] Not initialized, returning key');
      return key;
    }

    return i18next.t(key, options);
  }

  /**
   * Translate with specific namespace
   */
  tn(namespace: I18nNamespace, key: string, options?: TranslationOptions): string {
    if (!this.initialized) {
      console.warn('[I18nManager] Not initialized, returning key');
      return key;
    }

    return i18next.t(`${namespace}:${key}`, options);
  }

  /**
   * Check if translation key exists
   */
  exists(key: string, namespace?: I18nNamespace): boolean {
    if (!this.initialized) {
      return false;
    }

    const fullKey = namespace ? `${namespace}:${key}` : key;
    return i18next.exists(fullKey);
  }

  /**
   * Get available locales
   */
  getAvailableLocales(): SupportedLocale[] {
    return this.config.supportedLocales;
  }

  /**
   * Reload all resources
   */
  async reload(): Promise<void> {
    if (!this.initialized) {
      throw new Error('I18nManager not initialized');
    }

    try {
      const resources = await this.localeLoader.loadAll();

      // Clear and reload all resources
      for (const locale of this.config.supportedLocales) {
        for (const namespace of this.config.namespaces) {
          if (resources[locale]?.[namespace]) {
            i18next.addResourceBundle(locale, namespace, resources[locale][namespace], true, true);
          }
        }
      }

      console.log('[I18nManager] All resources reloaded');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', err);
      throw new Error(`Failed to reload resources: ${err.message}`);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.localeLoader.disableHotReload();
    this.removeAllListeners();
    this.initialized = false;
  }
}

// Singleton instance
let instance: I18nManager | null = null;

/**
 * Get singleton i18n manager instance
 */
export function getI18nManager(): I18nManager {
  if (!instance) {
    instance = new I18nManager();
  }
  return instance;
}

/**
 * Initialize i18n system
 */
export async function initializeI18n(config?: Partial<I18nConfig>): Promise<I18nManager> {
  if (!instance) {
    instance = new I18nManager(config);
  }
  await instance.initialize();
  return instance;
}
