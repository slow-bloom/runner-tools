import { formatPace, formatTime } from '../utils/format.js';
import { getLocale } from '../i18n/index.js';
import type { PaceUnit } from './vdot.js';

export interface RacePredictionTarget {
  key: 'k5' | 'k10' | 'halfMarathon' | 'marathon';
  label?: string;
  meters: number;
  highlight?: boolean;
}

export const DEFAULT_PREDICTION_DISTANCES: RacePredictionTarget[] = [
  { key: 'k5', meters: 5000, highlight: false },
  { key: 'k10', meters: 10000, highlight: true },
  { key: 'halfMarathon', meters: 21097.5, highlight: true },
  { key: 'marathon', meters: 42195, highlight: true },
];

export interface PredictedPerformance {
  key?: string;
  distanceMeters: number;
  distanceLabel: string;
  distanceFormatted: string;
  predictedSeconds: number;
  timeFormatted: string;
  targetPaceSecs: number;
  paceFormatted: string;
  paceDecayPercent: number; // e.g. +5.2% slower compared to baseline pace
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
 * @param baseDistanceMeters Baseline race distance (meters)
 * @param baseTimeSeconds Baseline race time (seconds)
 * @param targetDistanceMeters Target race distance (meters)
 * @param exponent Fatigue exponent (default 1.06, common range 1.05 - 1.12)
 */
export function predictRaceTime(
  baseDistanceMeters: number,
  baseTimeSeconds: number,
  targetDistanceMeters: number,
  exponent: number = 1.06
): number {
  if (baseDistanceMeters <= 0 || baseTimeSeconds <= 0 || targetDistanceMeters <= 0) {
    return 0;
  }
  return baseTimeSeconds * Math.pow(targetDistanceMeters / baseDistanceMeters, exponent);
}

export interface CalculateRacePredictionsOptions {
  baseDistanceMeters: number;
  baseTimeSeconds: number;
  exponent?: number;
  targetDistances?: RacePredictionTarget[];
  unit?: PaceUnit;
  lang?: string;
}

/**
 * Calculate multi-distance predicted performances and pace targets using Riegel's formula
 */
export function calculateRacePredictions(
  options: CalculateRacePredictionsOptions
): RacePredictionsResult | null {
  const {
    baseDistanceMeters,
    baseTimeSeconds,
    exponent = 1.06,
    targetDistances = DEFAULT_PREDICTION_DISTANCES,
    unit = 'km',
    lang = 'en',
  } = options;

  if (baseDistanceMeters <= 0 || baseTimeSeconds <= 0) {
    return null;
  }

  const locale = getLocale(lang);
  const isKm = unit === 'km';
  const unitDistance = isKm ? 1000 : 1609.344;
  const basePaceSecs = baseTimeSeconds / (baseDistanceMeters / unitDistance);

  const predictions: PredictedPerformance[] = targetDistances.map((target) => {
    const predictedSeconds = predictRaceTime(baseDistanceMeters, baseTimeSeconds, target.meters, exponent);
    const targetPaceSecs = predictedSeconds / (target.meters / unitDistance);
    const paceDecayPercent = ((targetPaceSecs - basePaceSecs) / basePaceSecs) * 100;

    const distInUnit = target.meters / unitDistance;
    const distanceFormatted = isKm
      ? `${distInUnit.toFixed(1)} ${locale.vdot.units.km}`
      : `${distInUnit.toFixed(2)} ${locale.vdot.units.mi}`;

    const distanceLabel =
      target.label ||
      locale.racePredictor.distances[target.key] ||
      `${(target.meters / 1000).toFixed(1)} km`;

    return {
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
    };
  });

  return {
    baseDistanceMeters,
    baseTimeSeconds,
    basePaceSecs,
    basePaceFormatted: formatPace(basePaceSecs),
    exponent,
    predictions,
  };
}
