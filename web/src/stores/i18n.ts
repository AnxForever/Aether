import { create } from 'zustand';
import zh from '../i18n/zh';
import en from '../i18n/en';

type Locale = 'zh' | 'en';
type Messages = typeof zh;

const messages: Record<Locale, Messages> = { zh, en };

interface I18nState {
  locale: Locale;
  t: Messages;
  setLocale: (locale: Locale) => void;
}

export const useI18n = create<I18nState>((set) => ({
  locale: (localStorage.getItem('aether_locale') as Locale) || 'zh',
  t: messages[(localStorage.getItem('aether_locale') as Locale) || 'zh'],
  setLocale: (locale) => {
    localStorage.setItem('aether_locale', locale);
    set({ locale, t: messages[locale] });
  },
}));
