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
  paceSecs: number | null;
  timeSeconds: number | null;
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

const DISTANCE_MIN = 0.01;
const DISTANCE_MAX = 10000;
const DISTANCE_EPS = 1e-9;

function normalizeDistanceEndpoint(dist: number): number {
  if (Math.abs(dist - DISTANCE_MIN) <= DISTANCE_EPS) return DISTANCE_MIN;
  if (Math.abs(dist - DISTANCE_MAX) <= DISTANCE_EPS) return DISTANCE_MAX;
  return dist;
}

function isValidDistance(dist: number): boolean {
  return Number.isFinite(dist) && dist >= DISTANCE_MIN - DISTANCE_EPS && dist <= DISTANCE_MAX + DISTANCE_EPS;
}

/**
 * Pure calculation: pace in seconds per unit
 */
export function calculatePace(distance: number, timeSeconds: number): number | null {
  if (
    !Number.isFinite(distance) ||
    !isValidDistance(distance) ||
    !Number.isFinite(timeSeconds) ||
    timeSeconds <= 0
  ) {
    return null;
  }
  const normDist = normalizeDistanceEndpoint(distance);
  const pace = timeSeconds / normDist;
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
    !isValidDistance(distance) ||
    !Number.isFinite(paceSeconds) ||
    paceSeconds <= 0
  ) {
    return null;
  }
  if (paceSeconds < 60 || paceSeconds > 3600) return null;
  const normDist = normalizeDistanceEndpoint(distance);
  const time = normDist * paceSeconds;
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
  if (!isValidDistance(dist)) return null;
  return normalizeDistanceEndpoint(dist);
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
 * Expects exactly two defined parameters; solves for the genuinely omitted third.
 */
export function solvePace(params: PaceSolverParams): PaceSolverResult | null {
  const { distance, paceSeconds, timeSeconds, unit = 'km', lang } = params;

  const isDefined = (v: unknown) => v !== undefined && v !== null;
  const defCount =
    (isDefined(distance) ? 1 : 0) +
    (isDefined(paceSeconds) ? 1 : 0) +
    (isDefined(timeSeconds) ? 1 : 0);

  // Exactly two defined parameters must be provided; third is solved
  if (defCount !== 2) {
    return null;
  }

  // Validate defined parameters against physiological and operational domains
  if (isDefined(distance)) {
    if (!Number.isFinite(distance) || !isValidDistance(distance!)) {
      return null;
    }
  }

  if (isDefined(paceSeconds)) {
    if (!Number.isFinite(paceSeconds) || paceSeconds! < 60 || paceSeconds! > 3600) {
      return null;
    }
  }

  if (isDefined(timeSeconds)) {
    if (!Number.isFinite(timeSeconds) || timeSeconds! <= 0) {
      return null;
    }
  }

  let solvedField: 'distance' | 'pace' | 'time';
  let finalDist: number;
  let finalPace: number;
  let finalTime: number;

  if (!isDefined(distance)) {
    solvedField = 'distance';
    const dist = calculateDistance(timeSeconds!, paceSeconds!);
    if (dist === null) return null;
    finalDist = dist;
    finalPace = paceSeconds!;
    finalTime = timeSeconds!;
  } else if (!isDefined(paceSeconds)) {
    solvedField = 'pace';
    const normDist = normalizeDistanceEndpoint(distance!);
    const pace = calculatePace(normDist, timeSeconds!);
    if (pace === null || pace < 60 || pace > 3600) return null;
    finalDist = normDist;
    finalPace = pace;
    finalTime = timeSeconds!;
  } else {
    solvedField = 'time';
    const normDist = normalizeDistanceEndpoint(distance!);
    const time = calculateTime(normDist, paceSeconds!);
    if (time === null) return null;
    finalDist = normDist;
    finalPace = paceSeconds!;
    finalTime = time;
  }

  if (!isValidDistance(finalDist)) return null;
  finalDist = normalizeDistanceEndpoint(finalDist);

  const isKm = unit === 'km';
  const loc = getLocale(lang);
  const paceUnitLabel = isKm ? loc.pace.units.km : loc.pace.units.mi;
  const distanceFormatted = `${Math.round(finalDist * 100) / 100} ${paceUnitLabel}`;
  const paceFormatted = formatPace(finalPace);
  const timeFormatted = formatTime(finalTime);

  const speedKmh = isKm
    ? (3600 / finalPace)
    : (3600 / finalPace) * KM_PER_MILE;
  const speedMph = speedKmh / KM_PER_MILE;

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
      const paceSecs = finalPace + off;
      // Do not silently clamp unsupported offsets; represent them explicitly with null and '—'
      if (paceSecs < 60 || paceSecs > 3600) {
        return {
          offsetSecs: off,
          paceSecs: null,
          timeSeconds: null,
          timeFormatted: '—',
        };
      }
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
