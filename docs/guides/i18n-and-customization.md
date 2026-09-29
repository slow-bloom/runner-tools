# Internationalization & Custom Dictionary Guide

`@slow-bloom/runner-tools` provides a robust, zero-dependency localization architecture designed for global multi-language running applications.

---

## Architecture Overview

1. **Zero Runtime Dependencies**: The i18n resolver does not rely on external frameworks.
2. **Hierarchical Locale Fallback**:
   $$\text{Exact Tag (e.g. 'zh-Hans')} \longrightarrow \text{Base Language (e.g. 'zh')} \longrightarrow \text{English Default ('en')}$$
3. **Deep Dictionary Merging**: Consumers can override individual terminology keys (e.g., custom unit formats, level descriptions) without replacing the entire dictionary.
4. **Strict Resolution Contract**: All user-facing strings (units, status tags, timeline summaries, level badges) are resolved through the locale dictionary rather than being hardcoded in formulas.

---

## Built-In Locales

The library currently ships with complete dictionaries for:
- `en` (English - default fallback)
- `zh` / `zh-Hans` / `zh-CN` (Simplified Chinese)

---

## Using Locales

Depending on the function signature, locale inputs (`LocaleInput`: language tag string or custom partial dictionary object) are provided either via `params.lang` or via an optional `options` argument (`{ locale }`):

### 1. Parameter Property (`params.lang`)

Modules using single-parameter configuration objects accept `lang`:

```typescript
import { calculateVDOT, solvePace } from '@slow-bloom/runner-tools';

// Formatted in Simplified Chinese via params.lang
const vdotZh = calculateVDOT({
  distanceMeters: 5000,
  timeSeconds: 1200,
  lang: 'zh-CN',
});

// Formatted in English via params.lang
const paceEn = solvePace({
  distance: 10,
  timeSeconds: 2700,
  lang: 'en',
});
```

*Applicable functions*: `calculateVDOT`, `calculateRacePredictions`, `solvePace`, `calculateWeeklyMileagePlan`.

### 2. Options Argument (`{ locale }`)

Modules that separate numerical parameters from presentation options take `{ locale }` as a second argument:

```typescript
import {
  calculateHeartRateZones,
  calculateAgeGrading,
  calculateRunningEfficiency,
  convertPace,
} from '@slow-bloom/runner-tools';

// Heart rate zones with Chinese localization
const hrZh = calculateHeartRateZones(
  { method: 'karvonen', maxHR: 190, restingHR: 55 },
  { locale: 'zh' }
);

// Age grading with Chinese localization
const ageZh = calculateAgeGrading(
  { gender: 'M', age: 40, distance: 10000, timeSeconds: 2400 },
  { locale: 'zh' }
);

// Running efficiency report with Chinese localization
const effZh = calculateRunningEfficiency(
  { verticalOscillationCm: 8.4, strideLengthM: 1.18, cadenceSpm: 178, groundContactTimeMs: 230 },
  { locale: 'zh' }
);

// Pace conversion with Chinese localization
const paceConvZh = convertPace(
  { paceSeconds: 300, paceUnit: 'km' },
  { locale: 'zh' }
);
```

---

## Customizing and Extending Dictionaries

You can register new languages or override existing terms using `registerLocale`. In accordance with the library's localization contract, `registerLocale` automatically merges partial dictionaries with English (`enLocale`) defaults for any omitted keys (such as `pace.distances.k5`), preventing runtime crashes.

```typescript
import { registerLocale, solvePace } from '@slow-bloom/runner-tools';

// 1. Register a French locale or override specific fields
// Omitted fields automatically fall back to the English baseline
registerLocale('fr', {
  pace: {
    units: {
      km: 'km',
      mi: 'mi',
      minPerKm: 'min/km',
      minPerMi: 'min/mi',
    },
    labels: {
      pace: 'Allure',
      distance: 'Distance',
      time: 'Temps',
    },
  },
});

// 2. Use the registered locale
const result = solvePace({
  distance: 10,
  timeSeconds: 2700,
  lang: 'fr',
});
```

---

## Locale Schema Reference

A complete `RunnerToolsLocale` structure covers:
- `locale`: Language identifier tag (e.g. `'en'`, `'zh'`)
- `vdot`: Training zone names (`E`, `M`, `T`, `I`, `R`), descriptions, distance labels, and unit strings
- `racePredictor`: Standard distance labels (5K, 10K, Half, Full) and fatigue exponent descriptions
- `heartRateZones`: Zone labels, category names, method descriptions, and percentage basis strings
- `ageGrading`: Master performance tiers (`worldClass`, `nationalClass`, etc.) and validation error messages
- `runningEfficiency`: Vertical Ratio tiers, Duty Factor tiers, Efficiency Factor ratings, and speed unit labels
- `pace`: Unit labels (`minPerKm`, `minPerMi`, `kmPerHour`, `milesPerHour`, `metersPerSec`, `km`, `mi`), field labels, and standard distance labels
- `weeklyMileage`: Status tags (`base`, `build`, `deload`, `target`), unit labels (`km`, `mi`), and timeline summary labels (`week`, `weeks`, etc.)
