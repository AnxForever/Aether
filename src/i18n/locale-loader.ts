import { createLogger } from '../utils/logger';

const logger = createLogger('LocaleLoader');

/**
 * Locale Loader
 *
 * Handles loading and watching locale files
 */

import * as fs from 'fs';
import * as path from 'path';
import * as watcher from '@parcel/watcher';
import type { SupportedLocale, I18nNamespace } from './types';

export interface LocaleLoaderConfig {
  localesDir: string;
  supportedLocales: SupportedLocale[];
  namespaces: I18nNamespace[];
  enableHotReload?: boolean;
}

export interface LocaleResources {
  [locale: string]: {
    [namespace: string]: Record<string, any>;
  };
}

export class LocaleLoader {
  private config: LocaleLoaderConfig;
  private resources: LocaleResources = {};
  private watchers: Array<{ unsubscribe: () => Promise<void> }> = [];
  private onReloadCallback?: (locale: SupportedLocale, namespace: I18nNamespace) => void;

  constructor(config: LocaleLoaderConfig) {
    this.config = config;
  }

  /**
   * Load all locale resources
   */
  async loadAll(): Promise<LocaleResources> {
    this.resources = {};

    for (const locale of this.config.supportedLocales) {
      this.resources[locale] = {};

      for (const namespace of this.config.namespaces) {
        const filePath = this.getLocaleFilePath(locale, namespace);

        try {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          this.resources[locale][namespace] = JSON.parse(content);
        } catch (error) {
          logger.warn(`Failed to load ${locale}/${namespace}.json:`, error as Error);
          this.resources[locale][namespace] = {};
        }
      }
    }

    return this.resources;
  }

  /**
   * Load single locale file
   */
  async loadLocaleFile(locale: SupportedLocale, namespace: I18nNamespace): Promise<Record<string, any>> {
    const filePath = this.getLocaleFilePath(locale, namespace);

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.error(`Failed to load ${locale}/${namespace}.json:`, error as Error);
      return {};
    }
  }

  /**
   * Get locale file path
   */
  private getLocaleFilePath(locale: SupportedLocale, namespace: I18nNamespace): string {
    return path.join(this.config.localesDir, locale, `${namespace}.json`);
  }

  /**
   * Enable hot reload - watch locale files for changes
   */
  async enableHotReload(onReload: (locale: SupportedLocale, namespace: I18nNamespace) => void): Promise<void> {
    this.onReloadCallback = onReload;

    for (const locale of this.config.supportedLocales) {
      const localeDir = path.join(this.config.localesDir, locale);

      try {
        const subscription = await watcher.subscribe(
          localeDir,
          async (err: Error | null, events: watcher.Event[]) => {
            if (err) {
              logger.error(`Watch error for ${locale}:`, err as Error);
              return;
            }

            for (const event of events) {
              if (event.type === 'update' || event.type === 'create') {
                const filename = path.basename(event.path, '.json');
                if (this.config.namespaces.includes(filename as I18nNamespace)) {
                  logger.info(`Detected change: ${locale}/${filename}.json`);

                  // Reload the changed file
                  const newContent = await this.loadLocaleFile(locale, filename as I18nNamespace);

                  // Update resources
                  if (!this.resources[locale]) {
                    this.resources[locale] = {};
                  }
                  this.resources[locale][filename] = newContent;

                  // Notify callback
                  if (this.onReloadCallback) {
                    this.onReloadCallback(locale, filename as I18nNamespace);
                  }
                }
              }
            }
          }
        );

        this.watchers.push(subscription);
      } catch (error) {
        logger.error(`Failed to watch ${localeDir}:`, error as Error);
      }
    }
  }

  /**
   * Disable hot reload - stop watching files
   */
  async disableHotReload(): Promise<void> {
    for (const watcher of this.watchers) {
      try {
        await watcher.unsubscribe();
      } catch (error) {
        logger.error('Failed to unsubscribe watcher:', error as Error);
      }
    }
    this.watchers = [];
    this.onReloadCallback = undefined;
  }

  /**
   * Get current resources
   */
  getResources(): LocaleResources {
    return this.resources;
  }
}
