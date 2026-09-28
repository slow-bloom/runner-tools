import { formatPace, formatTime } from '../utils/format.js';
import { getLocale, type RunnerToolsLocale } from '../i18n/index.js';

export type PaceUnit = 'km' | 'mi';
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

/**
 * Daniels-Gilbert oxygen consumption equation
 * VO2 cost as a function of velocity (meters/minute)
 */
export function calculateVO2(velocityMetersPerMin: number): number {
  const v = velocityMetersPerMin;
  return -4.60 + 0.182258 * v + 0.000104 * v * v;
}

/**
 * Daniels-Gilbert fractional utilization of VO2 Max
 * Returns the fraction of VO2 max sustainable for a given duration (in minutes)
 */
export function calculateDropDeadFraction(timeMinutes: number): number {
  const t = timeMinutes;
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
}

/**
 * Solve velocity (meters/minute) for a given target VO2
 * Solves the quadratic equation: 0.000104*v^2 + 0.182258*v - (4.60 + vo2) = 0
 */
export function solveVelocityForVO2(vo2: number): number {
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
export function solveTimeForDistance(distanceMeters: number, vdot: number): number {
  if (distanceMeters <= 0 || vdot <= 0) return 0;
  let low = 1.0;     // 1 min
  let high = 1440.0; // 24 hours
  let t = 720.0;

  for (let i = 0; i < 35; i++) {
    t = (low + high) / 2;
    const v = distanceMeters / t;
    const vo2 = calculateVO2(v);
    const p = calculateDropDeadFraction(t);
    const diff = vo2 / p - vdot;
    if (diff > 0) {
      low = t;
    } else {
      high = t;
    }
  }
  return t * 60;
}

export interface CalculateVDOTOptions {
  distanceMeters: number;
  timeSeconds: number;
  unit?: PaceUnit;
  lang?: string;
}

/**
 * Standard distances for equivalent race predictions
 */
export const STANDARD_RACE_DISTANCES = [
  { key: 'k5' as const, meters: 5000 },
  { key: 'k10' as const, meters: 10000 },
  { key: 'halfMarathon' as const, meters: 21097.5 },
  { key: 'marathon' as const, meters: 42195 },
];

/**
 * Calculate VDOT score, training pace zones (E, M, T, I, R) and equivalent race performances.
 */
export function calculateVDOT(options: CalculateVDOTOptions): VDOTCalculationResult | null {
  const { distanceMeters, timeSeconds, unit = 'km', lang = 'en' } = options;

  if (distanceMeters <= 0 || timeSeconds <= 0) {
    return null;
  }

  const timeMinutes = timeSeconds / 60;
  const velocityMetersPerMin = distanceMeters / timeMinutes;
  const vo2 = calculateVO2(velocityMetersPerMin);
  const fraction = calculateDropDeadFraction(timeMinutes);

  const vdot = vo2 / fraction;
  if (!Number.isFinite(vdot) || vdot <= 0) {
    return null;
  }

  const locale = getLocale(lang);
  const isKm = unit === 'km';
  const unitDistance = isKm ? 1000 : 1609.344;

  const zoneKeys: VDOTZoneKey[] = ['E', 'M', 'T', 'I', 'R'];
  const zones: Record<VDOTZoneKey, PaceZoneResult> = {} as any;
  const zonesList: PaceZoneResult[] = [];

  for (const key of zoneKeys) {
    const config = VDOT_ZONE_CONFIGS[key];
    const textInfo = locale.vdot.zones[key];

    // High velocity = faster pace = lower seconds per unit
    const vo2Low = config.lowPct * vdot;
    const vLow = solveVelocityForVO2(vo2Low);
    const paceSlowSecs = (unitDistance / vLow) * 60;

    const vo2High = config.highPct * vdot;
    const vHigh = solveVelocityForVO2(vo2High);
    const paceFastSecs = (unitDistance / vHigh) * 60;

    // By running convention, faster pace is listed first or second, standard format: Fast - Slow
    const item: PaceZoneResult = {
      key,
      name: textInfo.name,
      shortName: textInfo.shortName,
      description: textInfo.description,
      color: config.color,
      lowPct: config.lowPct,
      highPct: config.highPct,
      lowPaceSecs: paceFastSecs,
      highPaceSecs: paceSlowSecs,
      lowPaceFormatted: formatPace(paceFastSecs),
      highPaceFormatted: formatPace(paceSlowSecs),
      unit,
    };

    zones[key] = item;
    zonesList.push(item);
  }

  // Equivalent performances
  const equivalentPerformances: EquivalentPerformance[] = STANDARD_RACE_DISTANCES.map((d) => {
    const predictedSeconds = solveTimeForDistance(d.meters, vdot);
    const targetPaceSecs = predictedSeconds / (d.meters / unitDistance);

    return {
      distanceMeters: d.meters,
      distanceLabel: locale.vdot.standardDistances[d.key],
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
