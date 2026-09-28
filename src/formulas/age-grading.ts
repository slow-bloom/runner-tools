import { WMA_DATA, type WMAStandardEntry } from '../data/wma-2020.js';
import { getLocale, type LocaleInput } from '../i18n/index.js';
import { formatTime } from '../utils/format.js';

export type Gender = 'M' | 'F' | 'male' | 'female';
export type WMADistanceKey = '5000' | '10000' | '21097' | '42195';

export type AgeGradingLevelKey =
  | 'worldClass'
  | 'nationalClass'
  | 'regionalClass'
  | 'localClass'
  | 'activeRunner'
  | 'recreationalRunner';

export interface AgeGradingLevelDefinition {
  key: AgeGradingLevelKey;
  minScore: number;
  color: string;
  bgColor: string;
}

export const DEFAULT_AGE_GRADING_LEVELS: readonly AgeGradingLevelDefinition[] = [
  { key: 'worldClass', minScore: 90, color: '#ff3b30', bgColor: 'rgba(255, 59, 48, 0.15)' },
  { key: 'nationalClass', minScore: 80, color: '#ff9500', bgColor: 'rgba(255, 149, 0, 0.15)' },
  { key: 'regionalClass', minScore: 70, color: '#ffcc00', bgColor: 'rgba(255, 204, 0, 0.15)' },
  { key: 'localClass', minScore: 60, color: '#34c759', bgColor: 'rgba(52, 199, 89, 0.15)' },
  { key: 'activeRunner', minScore: 50, color: '#007aff', bgColor: 'rgba(0, 122, 255, 0.15)' },
  { key: 'recreationalRunner', minScore: 0, color: '#8e8e93', bgColor: 'rgba(142, 142, 147, 0.15)' },
] as const;

export interface AgeGradingParams {
  gender: Gender;
  age: number;
  distance: WMADistanceKey | number | string;
  timeSeconds: number;
}

export interface RawAgeGradingResult {
  gender: 'M' | 'F';
  age: number;
  distanceKey: WMADistanceKey;
  runnerTimeSeconds: number;
  score: number; // percentage (e.g. 75.432...)
  ageFactor: number; // openStdSecs / ageStdSecs
  ageEquivalentSeconds: number; // runnerTimeSecs * (openStdSecs / ageStdSecs)
  ageStandardSeconds: number;
  openStandardSeconds: number;
}

export interface FormattedAgeGradingLevel {
  key: AgeGradingLevelKey;
  label: string;
  color: string;
  bgColor: string;
  minScore: number;
}

export interface AgeGradingResult {
  score: number;
  scoreFormatted: string;
  level: FormattedAgeGradingLevel;
  ageEquivalentSeconds: number;
  ageEquivalentTimeFormatted: string;
  ageStandardSeconds: number;
  ageStandardFormatted: string;
  openStandardSeconds: number;
  openStandardFormatted: string;
  raw: RawAgeGradingResult;
}

export function normalizeGender(gender: string): 'M' | 'F' | null {
  if (!gender) return null;
  const g = gender.trim().toUpperCase();
  if (g === 'M' || g === 'MALE') return 'M';
  if (g === 'F' || g === 'FEMALE') return 'F';
  return null;
}

export function normalizeDistanceKey(dist: number | string): WMADistanceKey | null {
  if (dist === null || dist === undefined) return null;
  const d = String(dist).toLowerCase().trim();
  if (d === '5000' || d === '5k' || d === '5km') return '5000';
  if (d === '10000' || d === '10k' || d === '10km') return '10000';
  if (d === '21097' || d === '21097.5' || d === '21.0975' || d === 'halfmarathon' || d === 'half') return '21097';
  if (d === '42195' || d === '42.195' || d === 'marathon') return '42195';

  const num = parseFloat(d);
  if (Number.isFinite(num)) {
    if (Math.abs(num - 5000) < 50) return '5000';
    if (Math.abs(num - 10000) < 50) return '10000';
    if (Math.abs(num - 21097.5) < 100) return '21097';
    if (Math.abs(num - 42195) < 100) return '42195';
  }

  return null;
}

/**
 * Pure calculation: Computes age grading percentage score, age factor,
 * and age-equivalent open performance in seconds.
 * 
 * Returns null if parameters are invalid or outside WMA data range (ages 5-100).
 */
export function calculateAgeGradingRaw(params: AgeGradingParams): RawAgeGradingResult | null {
  if (!params || typeof params !== 'object') {
    return null;
  }

  const gender = normalizeGender(params.gender);
  if (!gender) return null;

  const distanceKey = normalizeDistanceKey(params.distance);
  if (!distanceKey) return null;

  const { age, timeSeconds } = params;
  if (!Number.isFinite(age) || age < 5 || age > 100) {
    return null;
  }

  if (!Number.isFinite(timeSeconds) || timeSeconds <= 0) {
    return null;
  }

  const roundedAge = Math.round(age);
  const entry: WMAStandardEntry = WMA_DATA[gender][distanceKey];
  if (!entry) return null;

  const openStdSecs = entry.open;
  const ageStdSecs = entry.ages[String(roundedAge)];
  if (!ageStdSecs || ageStdSecs <= 0) {
    return null;
  }

  const score = (ageStdSecs / timeSeconds) * 100;
  const ageFactor = openStdSecs / ageStdSecs;
  const ageEquivalentSeconds = timeSeconds * ageFactor;

  return {
    gender,
    age: roundedAge,
    distanceKey,
    runnerTimeSeconds: timeSeconds,
    score,
    ageFactor,
    ageEquivalentSeconds,
    ageStandardSeconds: ageStdSecs,
    openStandardSeconds: openStdSecs,
  };
}

/**
 * Determine the master athletic level information for a given score.
 */
export function getAgeGradingLevel(
  score: number,
  options: { locale?: LocaleInput } = {}
): FormattedAgeGradingLevel {
  const loc = getLocale(options.locale);
  const def = DEFAULT_AGE_GRADING_LEVELS.find((l) => score >= l.minScore) ?? DEFAULT_AGE_GRADING_LEVELS[DEFAULT_AGE_GRADING_LEVELS.length - 1];

  const label = loc.ageGrading.levels[def.key];

  return {
    key: def.key,
    label,
    color: def.color,
    bgColor: def.bgColor,
    minScore: def.minScore,
  };
}

export interface CalculateAgeGradingOptions {
  locale?: LocaleInput;
}

/**
 * Presentation layer: Calculates age grading percentage, athlete tier,
 * equivalent open performance, and formatted standards.
 */
export function calculateAgeGrading(
  params: AgeGradingParams,
  options: CalculateAgeGradingOptions = {}
): AgeGradingResult | null {
  const raw = calculateAgeGradingRaw(params);
  if (!raw) return null;

  const level = getAgeGradingLevel(raw.score, { locale: options.locale });

  return {
    score: Math.round(raw.score * 10) / 10,
    scoreFormatted: `${raw.score.toFixed(1)}%`,
    level,
    ageEquivalentSeconds: Math.round(raw.ageEquivalentSeconds),
    ageEquivalentTimeFormatted: formatTime(raw.ageEquivalentSeconds),
    ageStandardSeconds: raw.ageStandardSeconds,
    ageStandardFormatted: formatTime(raw.ageStandardSeconds),
    openStandardSeconds: raw.openStandardSeconds,
    openStandardFormatted: formatTime(raw.openStandardSeconds),
    raw,
  };
}
