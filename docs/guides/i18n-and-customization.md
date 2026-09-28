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

### Passing Language Tag

All top-level presentation formulas accept an optional `lang` parameter:

```typescript
import { calculateVDOT, solvePace } from '@slow-bloom/runner-tools';

// Formatted in Simplified Chinese
const vdotZh = calculateVDOT({
  distanceMeters: 5000,
  timeSeconds: 1200,
  lang: 'zh-CN',
});

// Formatted in English
const paceEn = solvePace({
  distance: 10,
  timeSeconds: 2700,
  lang: 'en',
});
```

---

## Customizing and Extending Dictionaries

You can register new languages or override existing terms using `registerLocale`:

```typescript
import { registerLocale, solvePace } from '@slow-bloom/runner-tools';

// 1. Register a French locale or override specific fields
registerLocale('fr', {
  common: {
    hours: 'h',
    minutes: 'min',
    seconds: 's',
  },
  pace: {
    units: {
      km: 'km',
      mi: 'mi',
      perKm: '/km',
      perMi: '/mi',
    },
  },
  // Deep-merges with English default for any omitted fields
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
- `common`: Time units, ordinal suffixes
- `vdot`: Training zone names (`E`, `M`, `T`, `I`, `R`) and descriptions
- `racePredictor`: Standard distance labels (5K, 10K, Half, Full)
- `heartRateZones`: Zone labels and descriptions across methods
- `ageGrading`: Master performance tiers (`worldClass`, `nationalClass`, etc.)
- `runningEfficiency`: Ratings (`elite`, `good`, `average`) and metric notes
- `pace`: Unit labels and split headers
- `weeklyMileage`: Status tags (`base`, `build`, `deload`, `targetReached`), unit labels, and timeline strings
