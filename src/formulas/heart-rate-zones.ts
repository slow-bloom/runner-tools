import { getLocale, type LocaleInput } from '../i18n/index.js';

export type HeartRateMethod = 'maxhr' | 'karvonen' | 'lthr';
export type HeartRateZoneKey = 'z1' | 'z2' | 'z3' | 'z4' | 'z5';

export interface ZoneColorDefinition {
  main: string;
  darkMain: string;
}

export const DEFAULT_HEART_RATE_ZONE_COLORS: Record<HeartRateZoneKey, ZoneColorDefinition> = {
  z1: { main: '#007aff', darkMain: '#2f8efd' },
  z2: { main: '#34c759', darkMain: '#30d158' },
  z3: { main: '#ffcc00', darkMain: '#ffd60a' },
  z4: { main: '#ff9500', darkMain: '#ff9f0a' },
  z5: { main: '#ff3b30', darkMain: '#ff453a' },
};

export type HeartRateZonesParams =
  | { method: 'maxhr'; maxHR: number }
  | { method: 'karvonen'; maxHR: number; restingHR: number }
  | { method: 'lthr'; lthr: number };

export interface RawHeartRateZone {
  zone: HeartRateZoneKey;
  low: number;
  high: number | null;
  minPercent: number;
  maxPercent: number | null;
  isLowerOpen?: boolean;
  isUpperOpen?: boolean;
}

export interface FormattedHeartRateZone {
  zone: HeartRateZoneKey;
  name: string;
  categoryName: string;
  description: string;
  low: number;
  high: number | null;
  bpmFormatted: string;
  pctFormatted: string;
  basisFormatted: string;
  color: ZoneColorDefinition;
}

export interface HeartRateZonesResult {
  method: HeartRateMethod;
  zones: FormattedHeartRateZone[];
}

/**
 * Estimate Maximum Heart Rate based on age using standard formulas:
 * - Fox (default): 220 - age
 * - Tanaka: 208 - 0.7 * age
 * - Gellish: 207 - 0.7 * age
 */
export function estimateMaxHR(
  age: number,
  formula: 'fox' | 'tanaka' | 'gellish' = 'fox'
): number | null {
  if (!Number.isFinite(age) || age <= 0 || age > 120) {
    return null;
  }

  switch (formula) {
    case 'tanaka':
      return Math.round(208 - 0.7 * age);
    case 'gellish':
      return Math.round(207 - 0.7 * age);
    case 'fox':
    default:
      return Math.round(220 - age);
  }
}

/**
 * Pure calculation: Computes raw heart rate zone boundaries (BPM and percentages)
 * without localization, formatting or UI strings.
 * 
 * Returns null if parameters are invalid.
 */
export function calculateHeartRateZonesRaw(
  params: HeartRateZonesParams
): RawHeartRateZone[] | null {
  if (!params || typeof params !== 'object') {
    return null;
  }

  const zoneKeys: HeartRateZoneKey[] = ['z1', 'z2', 'z3', 'z4', 'z5'];

  if (params.method === 'maxhr') {
    const { maxHR } = params;
    if (!Number.isFinite(maxHR) || maxHR <= 50 || maxHR > 260) {
      return null;
    }

    const bounds = [
      { low: Math.round(maxHR * 0.50), high: Math.round(maxHR * 0.60), minPct: 50, maxPct: 60 },
      { low: Math.round(maxHR * 0.60) + 1, high: Math.round(maxHR * 0.70), minPct: 60, maxPct: 70 },
      { low: Math.round(maxHR * 0.70) + 1, high: Math.round(maxHR * 0.80), minPct: 70, maxPct: 80 },
      { low: Math.round(maxHR * 0.80) + 1, high: Math.round(maxHR * 0.90), minPct: 80, maxPct: 90 },
      { low: Math.round(maxHR * 0.90) + 1, high: Math.round(maxHR), minPct: 90, maxPct: 100 },
    ];

    return bounds.map((b, idx) => ({
      zone: zoneKeys[idx],
      low: b.low,
      high: b.high,
      minPercent: b.minPct,
      maxPercent: b.maxPct,
    }));
  }

  if (params.method === 'karvonen') {
    const { maxHR, restingHR } = params;
    if (
      !Number.isFinite(maxHR) ||
      !Number.isFinite(restingHR) ||
      restingHR <= 20 ||
      maxHR <= restingHR ||
      maxHR > 260
    ) {
      return null;
    }

    const hrr = maxHR - restingHR;
    const bounds = [
      { low: Math.round(hrr * 0.50 + restingHR), high: Math.round(hrr * 0.60 + restingHR), minPct: 50, maxPct: 60 },
      { low: Math.round(hrr * 0.60 + restingHR) + 1, high: Math.round(hrr * 0.70 + restingHR), minPct: 60, maxPct: 70 },
      { low: Math.round(hrr * 0.70 + restingHR) + 1, high: Math.round(hrr * 0.80 + restingHR), minPct: 70, maxPct: 80 },
      { low: Math.round(hrr * 0.80 + restingHR) + 1, high: Math.round(hrr * 0.90 + restingHR), minPct: 80, maxPct: 90 },
      { low: Math.round(hrr * 0.90 + restingHR) + 1, high: Math.round(maxHR), minPct: 90, maxPct: 100 },
    ];

    return bounds.map((b, idx) => ({
      zone: zoneKeys[idx],
      low: b.low,
      high: b.high,
      minPercent: b.minPct,
      maxPercent: b.maxPct,
    }));
  }

  if (params.method === 'lthr') {
    const { lthr } = params;
    if (!Number.isFinite(lthr) || lthr <= 40 || lthr > 240) {
      return null;
    }

    const z2Low = Math.round(lthr * 0.85);
    const z3Low = Math.round(lthr * 0.90);
    const z4Low = Math.round(lthr * 0.95);
    const z5Low = Math.round(lthr * 1.00);

    return [
      {
        zone: 'z1',
        low: 0,
        high: z2Low - 1,
        minPercent: 0,
        maxPercent: 85,
        isLowerOpen: true,
      },
      {
        zone: 'z2',
        low: z2Low,
        high: z3Low - 1,
        minPercent: 85,
        maxPercent: 89,
      },
      {
        zone: 'z3',
        low: z3Low,
        high: z4Low - 1,
        minPercent: 90,
        maxPercent: 94,
      },
      {
        zone: 'z4',
        low: z4Low,
        high: z5Low - 1,
        minPercent: 95,
        maxPercent: 99,
      },
      {
        zone: 'z5',
        low: z5Low,
        high: null,
        minPercent: 100,
        maxPercent: null,
        isUpperOpen: true,
      },
    ];
  }

  return null;
}

export interface CalculateHeartRateZonesOptions {
  locale?: LocaleInput;
  colors?: Partial<Record<HeartRateZoneKey, ZoneColorDefinition>>;
}

/**
 * Presentation layer: Calculates 5 heart rate zones with localized names,
 * formatted BPM strings, percentages, basis labels, and visual theme colors.
 */
export function calculateHeartRateZones(
  params: HeartRateZonesParams,
  options: CalculateHeartRateZonesOptions = {}
): HeartRateZonesResult | null {
  const raw = calculateHeartRateZonesRaw(params);
  if (!raw) return null;

  const loc = getLocale(options.locale);
  const colors = { ...DEFAULT_HEART_RATE_ZONE_COLORS, ...options.colors };

  const basisFormatted = loc.heartRateZones.basis[params.method];

  const zones: FormattedHeartRateZone[] = raw.map((r) => {
    const zoneI18n = loc.heartRateZones.zones[r.zone];

    let bpmFormatted: string;
    let pctFormatted: string;

    if (params.method === 'lthr') {
      if (r.isLowerOpen) {
        bpmFormatted = `≤ ${r.high} bpm`;
        pctFormatted = `< 85%`;
      } else if (r.isUpperOpen) {
        bpmFormatted = `≥ ${r.low} bpm`;
        pctFormatted = `>= 100%`;
      } else {
        bpmFormatted = `${r.low} - ${r.high} bpm`;
        pctFormatted = `${r.minPercent} - ${r.maxPercent}%`;
      }
    } else {
      bpmFormatted = `${r.low} - ${r.high} bpm`;
      pctFormatted = `${r.minPercent} - ${r.maxPercent}%`;
    }

    return {
      zone: r.zone,
      name: zoneI18n.name,
      categoryName: zoneI18n.category,
      description: zoneI18n.description,
      low: r.low,
      high: r.high,
      bpmFormatted,
      pctFormatted,
      basisFormatted,
      color: colors[r.zone],
    };
  });

  return {
    method: params.method,
    zones,
  };
}
