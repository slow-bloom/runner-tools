import { enLocale, type RunnerToolsLocale, type VDOTZoneI18n } from './en.js';
import { zhLocale } from './zh.js';

export type { RunnerToolsLocale, VDOTZoneI18n };
export { enLocale, zhLocale };

const localeRegistry = new Map<string, RunnerToolsLocale>();

// Register built-in locales
localeRegistry.set('en', enLocale);
localeRegistry.set('zh', zhLocale);

/**
 * Register a new or custom locale into the registry
 * @param langCode Language tag (e.g. 'fr', 'fr-FR', 'es')
 * @param locale Locale dictionary object
 */
export function registerLocale(langCode: string, locale: RunnerToolsLocale): void {
  if (!langCode || typeof langCode !== 'string') return;
  localeRegistry.set(langCode.toLowerCase(), locale);
}

export type DeepPartial<T> = T extends Function
  ? T
  : T extends Array<infer U>
  ? Array<DeepPartial<U>>
  : T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

function isObject(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Deep merge helper to combine custom partial locale overrides with baseline enLocale
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source?: DeepPartial<T> | null
): T {
  if (!source || !isObject(source)) return target;
  const output: any = { ...target };

  for (const key of Object.keys(source)) {
    const targetVal = target[key];
    const sourceVal = (source as any)[key];

    if (isObject(targetVal) && isObject(sourceVal)) {
      output[key] = deepMerge(targetVal, sourceVal);
    } else if (sourceVal !== undefined) {
      output[key] = sourceVal;
    }
  }

  return output;
}

export type LocaleInput = string | DeepPartial<RunnerToolsLocale> | undefined;

/**
 * Resolve locale object with hierarchical fallback:
 * 1. If custom dictionary object is provided, deep merges over enLocale
 * 2. Exact language tag match (e.g. 'zh-cn', 'fr-fr')
 * 3. Base language tag match (e.g. 'zh', 'fr')
 * 4. Fallback to default 'en'
 */
export function getLocale(input?: LocaleInput): RunnerToolsLocale {
  if (!input) {
    return enLocale;
  }

  // Caller passed a custom dictionary object directly
  if (typeof input === 'object' && input !== null) {
    return deepMerge(enLocale as unknown as Record<string, unknown>, input as Record<string, unknown>) as unknown as RunnerToolsLocale;
  }

  const normalized = input.trim().toLowerCase();
  if (!normalized) {
    return enLocale;
  }

  // 1. Exact match
  if (localeRegistry.has(normalized)) {
    return localeRegistry.get(normalized)!;
  }

  // 2. Base language prefix match (e.g. 'zh-CN' -> 'zh', 'en-US' -> 'en')
  const basePrefix = normalized.split('-')[0].split('_')[0];
  if (basePrefix && localeRegistry.has(basePrefix)) {
    return localeRegistry.get(basePrefix)!;
  }

  // 3. Fallback to default English
  return enLocale;
}
