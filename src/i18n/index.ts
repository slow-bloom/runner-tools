import { enLocale, type RunnerToolsLocale, type VDOTZoneI18n } from './en.js';
import { zhLocale } from './zh.js';

export type { RunnerToolsLocale, VDOTZoneI18n };
export { enLocale, zhLocale };

const locales: Record<string, RunnerToolsLocale> = {
  en: enLocale,
  zh: zhLocale,
};

/**
 * Get locale strings by language code ('en' | 'zh', defaults to 'en')
 */
export function getLocale(lang: string = 'en'): RunnerToolsLocale {
  const normalized = lang.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  return locales[normalized] || enLocale;
}
