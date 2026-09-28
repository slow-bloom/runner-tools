import { formatPace, formatTime } from '../utils/format.js';
import { getLocale, type LocaleInput } from '../i18n/index.js';
import {
  type PaceUnit,
  STANDARD_RACE_DISTANCES,
  type StandardRaceDistanceKey,
} from '../types/index.js';

export interface RacePredictionTarget {
  key?: StandardRaceDistanceKey | string;
  label?: string;
  meters: number;
  highlight?: boolean;
}

export const DEFAULT_PREDICTION_TARGETS: readonly RacePredictionTarget[] = STANDARD_RACE_DISTANCES.map((d) => ({
  key: d.key,
  meters: d.meters,
  highlight: d.highlight,
}));

export interface PredictedPerformance {
  key?: string;
  distanceMeters: number;
  distanceLabel: string;
  distanceFormatted: string;
  predictedSeconds: number;
  timeFormatted: string;
  targetPaceSecs: number;
  paceFormatted: string;
  paceDecayPercent: number;
  unit: PaceUnit;
  highlight: boolean;
}

export interface RacePredictionsResult {
  baseDistanceMeters: number;
  baseTimeSeconds: number;
  basePaceSecs: number;
  basePaceFormatted: string;
  exponent: number;
  predictions: PredictedPerformance[];
}

/**
 * Predict race finish time using Peter Riegel's power-law formula:
 * T2 = T1 * (D2 / D1) ^ b
 * 
 * Returns null if any input is invalid, NaN, or out of reasonable physiological range.
 */
export function predictRaceTime(
  baseDistanceMeters: number,
  baseTimeSeconds: number,
  targetDistanceMeters: number,
  exponent: number = 1.06
): number | null {
  if (
    !Number.isFinite(baseDistanceMeters) ||
    baseDistanceMeters <= 0 ||
    !Number.isFinite(baseTimeSeconds) ||
    baseTimeSeconds <= 0 ||
    !Number.isFinite(targetDistanceMeters) ||
    targetDistanceMeters <= 0
  ) {
    return null;
  }

  // Sanity check on fatigue exponent (usually between 1.00 and 1.30)
  if (!Number.isFinite(exponent) || exponent <= 0 || exponent > 3.0) {
    return null;
  }

  const result = baseTimeSeconds * Math.pow(targetDistanceMeters / baseDistanceMeters, exponent);
  return Number.isFinite(result) && result > 0 ? result : null;
}

export interface CalculateRacePredictionsOptions {
  baseDistanceMeters: number;
  baseTimeSeconds: number;
  exponent?: number;
  targetDistances?: readonly RacePredictionTarget[];
  unit?: PaceUnit;
  lang?: LocaleInput;
}

/**
 * Calculate multi-distance predicted performances and pace targets with strict input validation.
 * Invalid targets (NaN, 0, negative meters) are automatically filtered out.
 * Returns null if baseline performance is invalid or no valid targets exist.
 */
export function calculateRacePredictions(
  options: CalculateRacePredictionsOptions
): RacePredictionsResult | null {
  const {
    baseDistanceMeters,
    baseTimeSeconds,
    exponent = 1.06,
    targetDistances = DEFAULT_PREDICTION_TARGETS,
    unit = 'km',
    lang,
  } = options;

  if (
    !Number.isFinite(baseDistanceMeters) ||
    baseDistanceMeters <= 0 ||
    !Number.isFinite(baseTimeSeconds) ||
    baseTimeSeconds <= 0 ||
    !Number.isFinite(exponent) ||
    exponent <= 0 ||
    exponent > 3.0
  ) {
    return null;
  }

  // Filter and validate targets: ignore invalid, zero, or NaN target distances
  const validTargets = targetDistances.filter(
    (t) => t && Number.isFinite(t.meters) && t.meters > 0
  );

  if (validTargets.length === 0) {
    return null;
  }

  const locale = getLocale(lang);
  const isKm = unit === 'km';
  const unitDistance = isKm ? 1000 : 1609.344;
  const basePaceSecs = baseTimeSeconds / (baseDistanceMeters / unitDistance);

  const predictions: PredictedPerformance[] = [];

  for (const target of validTargets) {
    const predictedSeconds = predictRaceTime(baseDistanceMeters, baseTimeSeconds, target.meters, exponent);
    if (predictedSeconds === null) continue;

    const targetPaceSecs = predictedSeconds / (target.meters / unitDistance);
    const paceDecayPercent = ((targetPaceSecs - basePaceSecs) / basePaceSecs) * 100;

    const distInUnit = target.meters / unitDistance;
    const distanceFormatted = isKm
      ? `${distInUnit.toFixed(1)} ${locale.vdot.units.km}`
      : `${distInUnit.toFixed(2)} ${locale.vdot.units.mi}`;

    const standardDistanceLabels = locale.racePredictor.distances;
    const standardKey =
      typeof target.key === 'string' &&
      Object.prototype.hasOwnProperty.call(standardDistanceLabels, target.key)
        ? (target.key as StandardRaceDistanceKey)
        : undefined;
    const distanceLabel =
      target.label ||
      (standardKey ? standardDistanceLabels[standardKey] : undefined) ||
      `${(target.meters / 1000).toFixed(1)} km`;

    predictions.push({
      key: target.key,
      distanceMeters: target.meters,
      distanceLabel,
      distanceFormatted,
      predictedSeconds,
      timeFormatted: formatTime(predictedSeconds),
      targetPaceSecs,
      paceFormatted: formatPace(targetPaceSecs),
      paceDecayPercent: Math.round(paceDecayPercent * 10) / 10,
      unit,
      highlight: !!target.highlight,
    });
  }

  if (predictions.length === 0) {
    return null;
  }

  return {
    baseDistanceMeters,
    baseTimeSeconds,
    basePaceSecs,
    basePaceFormatted: formatPace(basePaceSecs),
    exponent,
    predictions,
  };
}
