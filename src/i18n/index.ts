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

/**
 * Deep merge helper to combine custom partial locale overrides with baseline enLocale
 */
function mergeLocale(base: RunnerToolsLocale, custom: Partial<RunnerToolsLocale>): RunnerToolsLocale {
  return {
    ...base,
    ...custom,
    vdot: {
      ...base.vdot,
      ...(custom.vdot || {}),
      zones: {
        ...base.vdot.zones,
        ...(custom.vdot?.zones || {}),
      },
      standardDistances: {
        ...base.vdot.standardDistances,
        ...(custom.vdot?.standardDistances || {}),
      },
      units: {
        ...base.vdot.units,
        ...(custom.vdot?.units || {}),
      },
    },
    racePredictor: {
      ...base.racePredictor,
      ...(custom.racePredictor || {}),
      distances: {
        ...base.racePredictor.distances,
        ...(custom.racePredictor?.distances || {}),
      },
      exponents: {
        ...base.racePredictor.exponents,
        ...(custom.racePredictor?.exponents || {}),
      },
    },
  };
}

export type LocaleInput = string | Partial<RunnerToolsLocale> | undefined;

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
  if (typeof input === 'object') {
    return mergeLocale(enLocale, input);
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
