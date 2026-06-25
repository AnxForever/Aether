/**
 * i18n Types
 *
 * TypeScript type definitions for internationalization
 */

export type SupportedLocale = 'en' | 'zh';

export type I18nNamespace = 'common' | 'errors' | 'skills';

export interface I18nConfig {
  defaultLocale: SupportedLocale;
  fallbackLocale: SupportedLocale;
  supportedLocales: SupportedLocale[];
  namespaces: I18nNamespace[];
  localesDir: string;
}

export interface TranslationOptions {
  [key: string]: any;
}

export interface I18nEvents {
  languageChanged: (locale: SupportedLocale) => void;
  initialized: () => void;
  error: (error: Error) => void;
  resourcesLoaded: (locale: SupportedLocale, namespace: I18nNamespace) => void;
}

export interface I18nManagerInterface {
  /**
   * Get current locale
   */
  getCurrentLocale(): SupportedLocale;

  /**
   * Change language
   */
  changeLanguage(locale: SupportedLocale): Promise<void>;

  /**
   * Translate a key
   */
  t(key: string, options?: TranslationOptions): string;

  /**
   * Translate with specific namespace
   */
  tn(namespace: I18nNamespace, key: string, options?: TranslationOptions): string;

  /**
   * Check if key exists
   */
  exists(key: string, namespace?: I18nNamespace): boolean;

  /**
   * Get available locales
   */
  getAvailableLocales(): SupportedLocale[];

  /**
   * Initialize i18n system
   */
  initialize(): Promise<void>;

  /**
   * Reload resources (for hot reload)
   */
  reload(): Promise<void>;
}
