import { type PaceUnit } from '../types/index.js';
import { formatPace, formatTime } from '../utils/format.js';
import { getLocale, type LocaleInput } from '../i18n/index.js';

export const KM_PER_MILE = 1.609344;

export interface PaceConversionParams {
  paceSeconds?: number;
  paceUnit?: PaceUnit;
  speedKmh?: number;
  speedMph?: number;
  speedMs?: number;
}

export interface PaceSplitEstimate {
  distanceKey: string;
  distanceLabel: string;
  distanceKm: number;
  timeSeconds: number;
  timeFormatted: string;
}

export interface PaceConversionResult {
  paceKmSecs: number;
  paceKmFormatted: string;
  paceMiSecs: number;
  paceMiFormatted: string;
  speedKmh: number;
  speedMph: number;
  speedMs: number;
  splits: PaceSplitEstimate[];
}

export interface PaceSolverParams {
  distance?: number;
  paceSeconds?: number;
  timeSeconds?: number;
  unit?: PaceUnit;
  lang?: LocaleInput;
}

export interface PaceFinishTableTimeItem {
  offsetSecs: number;
  paceSecs: number;
  timeSeconds: number;
  timeFormatted: string;
}

export interface PaceFinishTableItem {
  distanceKey: string;
  distanceLabel: string;
  distanceKm: number;
  distanceInUnit: number;
  highlight: boolean;
  times: PaceFinishTableTimeItem[];
}

export interface PaceSolverResult {
  solvedField: 'distance' | 'pace' | 'time';
  distance: number;
  distanceFormatted: string;
  paceSeconds: number;
  paceFormatted: string;
  timeSeconds: number;
  timeFormatted: string;
  speedKmh: number;
  speedMph: number;
  unit: PaceUnit;
  finishTable: PaceFinishTableItem[];
}

/**
 * Pure calculation: pace in seconds per unit
 */
export function calculatePace(distance: number, timeSeconds: number): number | null {
  if (
    !Number.isFinite(distance) ||
    distance <= 0 ||
    !Number.isFinite(timeSeconds) ||
    timeSeconds <= 0
  ) {
    return null;
  }
  const pace = timeSeconds / distance;
  // Reasonable physiological running boundaries: 60 s/unit (sprint) to 3600 s/unit (slow walk)
  if (pace < 60 || pace > 3600) return null;
  return pace;
}

/**
 * Pure calculation: total duration in seconds from distance and pace
 */
export function calculateTime(distance: number, paceSeconds: number): number | null {
  if (
    !Number.isFinite(distance) ||
    distance <= 0 ||
    !Number.isFinite(paceSeconds) ||
    paceSeconds <= 0
  ) {
    return null;
  }
  if (paceSeconds < 60 || paceSeconds > 3600) return null;
  const time = distance * paceSeconds;
  return Number.isFinite(time) && time > 0 ? time : null;
}

/**
 * Pure calculation: total distance from duration and pace
 */
export function calculateDistance(timeSeconds: number, paceSeconds: number): number | null {
  if (
    !Number.isFinite(timeSeconds) ||
    timeSeconds <= 0 ||
    !Number.isFinite(paceSeconds) ||
    paceSeconds <= 0
  ) {
    return null;
  }
  if (paceSeconds < 60 || paceSeconds > 3600) return null;
  const dist = timeSeconds / paceSeconds;
  return Number.isFinite(dist) && dist > 0 ? dist : null;
}

/**
 * Multi-dimensional pace and speed converter across metric and imperial standards
 */
export function convertPace(
  params: PaceConversionParams,
  options: { locale?: LocaleInput } = {}
): PaceConversionResult | null {
  let paceKmSecs: number | null = null;

  if (Number.isFinite(params.paceSeconds) && params.paceSeconds! > 0) {
    const isMi = params.paceUnit === 'mi';
    paceKmSecs = isMi ? params.paceSeconds! / KM_PER_MILE : params.paceSeconds!;
  } else if (Number.isFinite(params.speedKmh) && params.speedKmh! > 0) {
    paceKmSecs = 3600 / params.speedKmh!;
  } else if (Number.isFinite(params.speedMph) && params.speedMph! > 0) {
    const speedKmh = params.speedMph! * KM_PER_MILE;
    paceKmSecs = 3600 / speedKmh;
  } else if (Number.isFinite(params.speedMs) && params.speedMs! > 0) {
    paceKmSecs = 1000 / params.speedMs!;
  }

  if (paceKmSecs === null || paceKmSecs < 60 || paceKmSecs > 3600) {
    return null;
  }

  const paceMiSecs = paceKmSecs * KM_PER_MILE;
  const speedKmh = 3600 / paceKmSecs;
  const speedMph = speedKmh / KM_PER_MILE;
  const speedMs = 1000 / paceKmSecs;

  const loc = getLocale(options.locale);

  const standardDistances = [
    { key: 'k5', label: loc.pace.distances.k5, km: 5 },
    { key: 'k10', label: loc.pace.distances.k10, km: 10 },
    { key: 'halfMarathon', label: loc.pace.distances.halfMarathon, km: 21.0975 },
    { key: 'marathon', label: loc.pace.distances.marathon, km: 42.195 },
  ];

  const splits: PaceSplitEstimate[] = standardDistances.map((d) => {
    const timeSeconds = Math.round(paceKmSecs! * d.km);
    return {
      distanceKey: d.key,
      distanceLabel: d.label,
      distanceKm: d.km,
      timeSeconds,
      timeFormatted: formatTime(timeSeconds),
    };
  });

  return {
    paceKmSecs: Math.round(paceKmSecs * 100) / 100,
    paceKmFormatted: formatPace(paceKmSecs),
    paceMiSecs: Math.round(paceMiSecs * 100) / 100,
    paceMiFormatted: formatPace(paceMiSecs),
    speedKmh: Math.round(speedKmh * 100) / 100,
    speedMph: Math.round(speedMph * 100) / 100,
    speedMs: Math.round(speedMs * 100) / 100,
    splits,
  };
}

/**
 * Three-way solver for distance, pace, and time.
 * Expects exactly two defined parameters; solves for the third.
 */
export function solvePace(params: PaceSolverParams): PaceSolverResult | null {
  const { distance, paceSeconds, timeSeconds, unit = 'km', lang } = params;

  const hasDist = Number.isFinite(distance) && distance! > 0;
  const hasPace = Number.isFinite(paceSeconds) && paceSeconds! > 0;
  const hasTime = Number.isFinite(timeSeconds) && timeSeconds! > 0;

  const count = (hasDist ? 1 : 0) + (hasPace ? 1 : 0) + (hasTime ? 1 : 0);
  if (count !== 2) {
    return null;
  }

  let solvedField: 'distance' | 'pace' | 'time';
  let finalDist: number;
  let finalPace: number;
  let finalTime: number;

  if (!hasDist) {
    solvedField = 'distance';
    const dist = calculateDistance(timeSeconds!, paceSeconds!);
    if (dist === null) return null;
    finalDist = dist;
    finalPace = paceSeconds!;
    finalTime = timeSeconds!;
  } else if (!hasPace) {
    solvedField = 'pace';
    const pace = calculatePace(distance!, timeSeconds!);
    if (pace === null) return null;
    finalDist = distance!;
    finalPace = pace;
    finalTime = timeSeconds!;
  } else {
    solvedField = 'time';
    const time = calculateTime(distance!, paceSeconds!);
    if (time === null) return null;
    finalDist = distance!;
    finalPace = paceSeconds!;
    finalTime = time;
  }

  const isKm = unit === 'km';
  const paceUnitLabel = isKm ? 'km' : 'mi';
  const distanceFormatted = `${Math.round(finalDist * 100) / 100} ${paceUnitLabel}`;
  const paceFormatted = formatPace(finalPace);
  const timeFormatted = formatTime(finalTime);

  const speedKmh = isKm
    ? (3600 / finalPace)
    : (3600 / finalPace) * KM_PER_MILE;
  const speedMph = speedKmh / KM_PER_MILE;

  const loc = getLocale(lang);
  const standardDefs = [
    { key: 'k5', label: loc.pace.distances.k5, km: 5, highlight: false },
    { key: 'k10', label: loc.pace.distances.k10, km: 10, highlight: true },
    { key: 'halfMarathon', label: loc.pace.distances.halfMarathon, km: 21.0975, highlight: true },
    { key: 'marathon', label: loc.pace.distances.marathon, km: 42.195, highlight: true },
  ];

  const offsets = [-10, -5, 0, 5, 10];

  const finishTable: PaceFinishTableItem[] = standardDefs.map((d) => {
    const distInUnit = isKm ? d.km : d.km / KM_PER_MILE;
    const times: PaceFinishTableTimeItem[] = offsets.map((off) => {
      const paceSecs = Math.max(60, finalPace + off);
      const totalSecs = Math.round(paceSecs * distInUnit);
      return {
        offsetSecs: off,
        paceSecs,
        timeSeconds: totalSecs,
        timeFormatted: formatTime(totalSecs),
      };
    });

    return {
      distanceKey: d.key,
      distanceLabel: d.label,
      distanceKm: d.km,
      distanceInUnit: Math.round(distInUnit * 100) / 100,
      highlight: d.highlight,
      times,
    };
  });

  return {
    solvedField,
    distance: Math.round(finalDist * 100) / 100,
    distanceFormatted,
    paceSeconds: Math.round(finalPace * 10) / 10,
    paceFormatted,
    timeSeconds: Math.round(finalTime),
    timeFormatted,
    speedKmh: Math.round(speedKmh * 100) / 100,
    speedMph: Math.round(speedMph * 100) / 100,
    unit,
    finishTable,
  };
}
