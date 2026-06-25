/**
 * i18n Module
 *
 * Internationalization support for Aether
 */

export { I18nManager, getI18nManager, initializeI18n } from './i18n-manager';
export { LocaleLoader } from './locale-loader';
export type {
  SupportedLocale,
  I18nNamespace,
  I18nConfig,
  TranslationOptions,
  I18nManagerInterface,
  I18nEvents,
} from './types';
