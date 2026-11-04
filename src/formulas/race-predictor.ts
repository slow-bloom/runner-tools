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
  /** Present only when the weekly-mileage marathon model is selected. */
  marathonStatus?: MarathonPrediction['status'];
}

export type MarathonPrediction =
  | { status: 'predicted' | 'direct'; seconds: number }
  | {
      status: 'invalid-input' | 'unsupported-distance' | 'missing-mileage' | 'invalid-mileage';
      seconds: null;
    };

const MARATHON_METERS = 42195;
const MARATHON_SOURCE_DISTANCES = [5000, 8046.72, 10000, 16093.44, 21097.5, MARATHON_METERS];

/**
 * Vickers & Vertosick (2016) single-performance + weekly-mileage marathon model.
 * Training-run inputs and 2% GPS distance matching are app adaptations, not
 * independently validated extensions of the race-results study.
 */
export function predictMarathonTime(
  baseDistanceMeters: number,
  elapsedSeconds: number,
  weeklyDistanceMeters?: number | null,
): MarathonPrediction {
  if (
    !Number.isFinite(baseDistanceMeters) || baseDistanceMeters <= 0 ||
    !Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0
  ) {
    return { status: 'invalid-input', seconds: null };
  }

  const standardDistance = MARATHON_SOURCE_DISTANCES.find(
    (distance) => baseDistanceMeters >= distance * 0.98 && baseDistanceMeters <= distance * 1.02,
  );
  const sourceDistance = standardDistance ?? baseDistanceMeters;
  if (sourceDistance === MARATHON_METERS) {
    return { status: 'direct', seconds: elapsedSeconds };
  }
  if (sourceDistance < 5000 || sourceDistance >= MARATHON_METERS) {
    return { status: 'unsupported-distance', seconds: null };
  }
  if (weeklyDistanceMeters == null) {
    return { status: 'missing-mileage', seconds: null };
  }
  if (!Number.isFinite(weeklyDistanceMeters) || weeklyDistanceMeters < 0) {
    return { status: 'invalid-mileage', seconds: null };
  }

  const projectedSeconds = predictRaceTime(sourceDistance, elapsedSeconds, MARATHON_METERS, 1.07);
  // Reject overflow before taking the reciprocal: an infinite projection would
  // otherwise produce an apparently valid intercept-only estimate.
  if (projectedSeconds === null) return { status: 'invalid-input', seconds: null };
  const projectedSpeed = MARATHON_METERS / projectedSeconds;
  const weeklyMiles = weeklyDistanceMeters / 1609.344;
  const marathonSpeed = 0.16018617 + 0.83076202 * projectedSpeed + 0.06423826 * (weeklyMiles / 10);
  const seconds = MARATHON_METERS / marathonSpeed;
  if (
    !Number.isFinite(projectedSpeed) || projectedSpeed <= 0 ||
    !Number.isFinite(weeklyMiles) ||
    !Number.isFinite(marathonSpeed) || marathonSpeed <= 0 ||
    !Number.isFinite(seconds) || seconds <= 0
  ) {
    return { status: 'invalid-input', seconds: null };
  }
  return { status: 'predicted', seconds };
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
  /** Opt-in: affects only targets of exactly 42195 metres. Default remains Riegel. */
  marathonModel?: 'weekly-mileage';
  /** Average weekly distance over six weeks, in metres; omitted is not zero. */
  weeklyDistanceMeters?: number | null;
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
  const marathon = options.marathonModel === 'weekly-mileage'
    ? predictMarathonTime(baseDistanceMeters, baseTimeSeconds, options.weeklyDistanceMeters)
    : undefined;

  for (const target of validTargets) {
    const predictedSeconds = marathon && target.meters === MARATHON_METERS
      ? marathon.seconds
      : predictRaceTime(baseDistanceMeters, baseTimeSeconds, target.meters, exponent);
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
    ...(marathon ? { marathonStatus: marathon.status } : {}),
  };
}
