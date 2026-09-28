import { formatPace, formatTime } from '../utils/format.js';
import { getLocale, type LocaleInput } from '../i18n/index.js';
import { type PaceUnit, STANDARD_RACE_DISTANCES, type StandardRaceDistance } from '../types/index.js';

export type { PaceUnit, StandardRaceDistance };
export { STANDARD_RACE_DISTANCES };

export type VDOTZoneKey = 'E' | 'M' | 'T' | 'I' | 'R';

export interface VDOTZoneConfig {
  key: VDOTZoneKey;
  lowPct: number;
  highPct: number;
  color: string;
}

export const VDOT_ZONE_CONFIGS: Record<VDOTZoneKey, VDOTZoneConfig> = {
  E: { key: 'E', lowPct: 0.5776, highPct: 0.7142, color: '#007aff' },
  M: { key: 'M', lowPct: 0.7864, highPct: 0.8268, color: '#34c759' },
  T: { key: 'T', lowPct: 0.8503, highPct: 0.8930, color: '#ffcc00' },
  I: { key: 'I', lowPct: 0.9571, highPct: 1.0051, color: '#ff9500' },
  R: { key: 'R', lowPct: 1.0145, highPct: 1.0432, color: '#ff3b30' },
};

// ── 1. Pure Numerical Calculation Types ──

export interface RawPaceZoneItem {
  key: VDOTZoneKey;
  lowPct: number;
  highPct: number;
  vo2Low: number;
  vo2High: number;
  velocityLowMpm: number;
  velocityHighMpm: number;
  fastPaceSecs: number; // Low seconds per unit (faster pace)
  slowPaceSecs: number; // High seconds per unit (slower pace)
  unit: PaceUnit;
}

export interface RawEquivalentPerformance {
  distanceMeters: number;
  predictedSeconds: number;
  targetPaceSecs: number;
  unit: PaceUnit;
}

// ── 2. Presentation Types ──

export interface PaceZoneResult {
  key: VDOTZoneKey;
  name: string;
  shortName: string;
  description: string;
  color: string;
  lowPct: number;
  highPct: number;
  lowPaceSecs: number;
  highPaceSecs: number;
  lowPaceFormatted: string;
  highPaceFormatted: string;
  unit: PaceUnit;
}

export interface EquivalentPerformance {
  distanceMeters: number;
  distanceLabel: string;
  predictedSeconds: number;
  timeFormatted: string;
  targetPaceSecs: number;
  paceFormatted: string;
  unit: PaceUnit;
}

export interface VDOTCalculationResult {
  vdot: number;
  vdotFormatted: string;
  zones: Record<VDOTZoneKey, PaceZoneResult>;
  zonesList: PaceZoneResult[];
  equivalentPerformances: EquivalentPerformance[];
}

// ── 3. Pure Mathematical Functions ──

/**
 * Daniels-Gilbert oxygen consumption equation
 * VO2 cost as a function of velocity (meters/minute)
 */
export function calculateVO2(velocityMetersPerMin: number): number {
  if (!Number.isFinite(velocityMetersPerMin) || velocityMetersPerMin <= 0) return 0;
  const v = velocityMetersPerMin;
  return -4.60 + 0.182258 * v + 0.000104 * v * v;
}

/**
 * Daniels-Gilbert fractional utilization of VO2 Max
 * Returns the fraction of VO2 max sustainable for a given duration (in minutes)
 */
export function calculateDropDeadFraction(timeMinutes: number): number {
  if (!Number.isFinite(timeMinutes) || timeMinutes <= 0) return 0;
  const t = timeMinutes;
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
}

/**
 * Solve velocity (meters/minute) for a given target VO2
 * Solves the quadratic equation: 0.000104*v^2 + 0.182258*v - (4.60 + vo2) = 0
 */
export function solveVelocityForVO2(vo2: number): number {
  if (!Number.isFinite(vo2) || vo2 <= 0) return 0;
  const a = 0.000104;
  const b = 0.182258;
  const c = -(4.60 + vo2);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return 0;
  return (-b + Math.sqrt(discriminant)) / (2 * a);
}

/**
 * Solve time (in seconds) for a given race distance and VDOT using bisection numerical method
 */
export function solveTimeForDistance(distanceMeters: number, vdot: number): number | null {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0 || !Number.isFinite(vdot) || vdot <= 0) {
    return null;
  }
  let low = 1.0;     // 1 min
  let high = 1440.0; // 24 hours
  let t = 720.0;

  for (let i = 0; i < 35; i++) {
    t = (low + high) / 2;
    const v = distanceMeters / t;
    const vo2 = calculateVO2(v);
    const p = calculateDropDeadFraction(t);
    if (p <= 0) return null;
    const diff = vo2 / p - vdot;
    if (diff > 0) {
      low = t;
    } else {
      high = t;
    }
  }
  return t * 60;
}

/**
 * Compute raw VDOT numerical score without presentation wrapping
 */
export function calculateVDOTScore(distanceMeters: number, timeSeconds: number): number | null {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return null;
  if (!Number.isFinite(timeSeconds) || timeSeconds <= 0) return null;

  const timeMinutes = timeSeconds / 60;
  const velocityMetersPerMin = distanceMeters / timeMinutes;
  const vo2 = calculateVO2(velocityMetersPerMin);
  const fraction = calculateDropDeadFraction(timeMinutes);

  if (fraction <= 0) return null;
  const vdot = vo2 / fraction;

  return Number.isFinite(vdot) && vdot > 0 ? vdot : null;
}

/**
 * Compute pure numeric pace boundaries for each zone (in seconds per unit)
 */
export function calculateVDOTPacesRaw(vdot: number, unit: PaceUnit = 'km'): Record<VDOTZoneKey, RawPaceZoneItem> | null {
  if (!Number.isFinite(vdot) || vdot <= 0) return null;

  const isKm = unit === 'km';
  const unitDistance = isKm ? 1000 : 1609.344;
  const zoneKeys: VDOTZoneKey[] = ['E', 'M', 'T', 'I', 'R'];
  const result: Record<VDOTZoneKey, RawPaceZoneItem> = {} as any;

  for (const key of zoneKeys) {
    const config = VDOT_ZONE_CONFIGS[key];
    const vo2Low = config.lowPct * vdot;
    const vLow = solveVelocityForVO2(vo2Low);
    const slowPaceSecs = vLow > 0 ? (unitDistance / vLow) * 60 : 0;

    const vo2High = config.highPct * vdot;
    const vHigh = solveVelocityForVO2(vo2High);
    const fastPaceSecs = vHigh > 0 ? (unitDistance / vHigh) * 60 : 0;

    result[key] = {
      key,
      lowPct: config.lowPct,
      highPct: config.highPct,
      vo2Low,
      vo2High,
      velocityLowMpm: vLow,
      velocityHighMpm: vHigh,
      fastPaceSecs,
      slowPaceSecs,
      unit,
    };
  }

  return result;
}

/**
 * Compute pure numeric equivalent race times
 */
export function calculateEquivalentTimesRaw(
  vdot: number,
  distances: readonly number[] = [5000, 10000, 21097.5, 42195],
  unit: PaceUnit = 'km'
): RawEquivalentPerformance[] | null {
  if (!Number.isFinite(vdot) || vdot <= 0) return null;

  const unitDistance = unit === 'km' ? 1000 : 1609.344;
  const results: RawEquivalentPerformance[] = [];

  for (const dist of distances) {
    if (!Number.isFinite(dist) || dist <= 0) continue;
    const predictedSeconds = solveTimeForDistance(dist, vdot);
    if (predictedSeconds === null) continue;
    const targetPaceSecs = predictedSeconds / (dist / unitDistance);

    results.push({
      distanceMeters: dist,
      predictedSeconds,
      targetPaceSecs,
      unit,
    });
  }

  return results;
}

// ── 4. Presentation & Integration Wrapper ──

export interface CalculateVDOTOptions {
  distanceMeters: number;
  timeSeconds: number;
  unit?: PaceUnit;
  lang?: LocaleInput;
}

/**
 * Calculate VDOT score, training pace zones (E, M, T, I, R) and equivalent race performances.
 * Formatted with localization, color styling, and readable clock strings.
 */
export function calculateVDOT(options: CalculateVDOTOptions): VDOTCalculationResult | null {
  const { distanceMeters, timeSeconds, unit = 'km', lang } = options;

  const vdot = calculateVDOTScore(distanceMeters, timeSeconds);
  if (vdot === null) return null;

  const rawPaces = calculateVDOTPacesRaw(vdot, unit);
  if (!rawPaces) return null;

  const locale = getLocale(lang);
  const zoneKeys: VDOTZoneKey[] = ['E', 'M', 'T', 'I', 'R'];
  const zones: Record<VDOTZoneKey, PaceZoneResult> = {} as any;
  const zonesList: PaceZoneResult[] = [];

  for (const key of zoneKeys) {
    const raw = rawPaces[key];
    const config = VDOT_ZONE_CONFIGS[key];
    const textInfo = locale.vdot.zones[key];

    const item: PaceZoneResult = {
      key,
      name: textInfo?.name || config.key,
      shortName: textInfo?.shortName || config.key,
      description: textInfo?.description || '',
      color: config.color,
      lowPct: raw.lowPct,
      highPct: raw.highPct,
      lowPaceSecs: raw.fastPaceSecs,
      highPaceSecs: raw.slowPaceSecs,
      lowPaceFormatted: formatPace(raw.fastPaceSecs),
      highPaceFormatted: formatPace(raw.slowPaceSecs),
      unit,
    };

    zones[key] = item;
    zonesList.push(item);
  }

  const equivalentPerformances: EquivalentPerformance[] = STANDARD_RACE_DISTANCES.map((d) => {
    const predictedSeconds = solveTimeForDistance(d.meters, vdot) ?? 0;
    const unitDistance = unit === 'km' ? 1000 : 1609.344;
    const targetPaceSecs = predictedSeconds > 0 ? predictedSeconds / (d.meters / unitDistance) : 0;

    return {
      distanceMeters: d.meters,
      distanceLabel: locale.vdot.standardDistances[d.key] || `${d.meters / 1000} km`,
      predictedSeconds,
      timeFormatted: formatTime(predictedSeconds),
      targetPaceSecs,
      paceFormatted: formatPace(targetPaceSecs),
      unit,
    };
  });

  return {
    vdot,
    vdotFormatted: vdot.toFixed(1),
    zones,
    zonesList,
    equivalentPerformances,
  };
}
