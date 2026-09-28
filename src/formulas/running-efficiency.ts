import { getLocale, type LocaleInput } from '../i18n/index.js';
import type { PaceUnit } from '../types/index.js';

export interface FormattedVerticalRatioLevel {
  key: 'elite' | 'advanced' | 'average' | 'needsImprovement';
  label: string;
  description: string;
  color: string;
  bgColor: string;
  barColor: string;
  barWidth: string;
}

export interface FormattedDutyFactorLevel {
  key: 'elite' | 'advanced' | 'recreational';
  label: string;
  color: string;
  bgColor: string;
}

export interface FormattedEfficiencyFactorLevel {
  key: 'developing' | 'solid' | 'advanced' | 'elite';
  label: string;
  color: string;
  bgColor: string;
}

/**
 * Pure calculation: Vertical Ratio (VR) as percentage.
 * Formula: (Vertical Oscillation in cm / Stride Length in cm) * 100
 */
export function calculateVerticalRatio(
  verticalOscillationCm: number,
  strideLengthM: number
): number | null {
  if (
    !Number.isFinite(verticalOscillationCm) ||
    verticalOscillationCm < 0 ||
    !Number.isFinite(strideLengthM) ||
    strideLengthM <= 0
  ) {
    return null;
  }

  const strideLengthCm = strideLengthM * 100;
  return (verticalOscillationCm / strideLengthCm) * 100;
}

/**
 * Pure calculation: Duty Factor as percentage of total gait cycle spent on ground.
 * Formula: (Ground Contact Time in ms / Total Step Cycle in ms) * 100
 * where Step Cycle in ms = 60000 / cadenceSpm
 */
export function calculateDutyFactor(
  cadenceSpm: number,
  groundContactTimeMs: number
): number | null {
  if (
    !Number.isFinite(cadenceSpm) ||
    cadenceSpm <= 0 ||
    !Number.isFinite(groundContactTimeMs) ||
    groundContactTimeMs <= 0
  ) {
    return null;
  }

  // Full gait cycle (stride of both feet) duration = 120000 / cadenceSpm
  return (groundContactTimeMs * cadenceSpm / 120000) * 100;
}

/**
 * Convert pace (seconds per km or mile) into speed in m/s and km/h.
 */
export function paceToSpeed(
  paceSeconds: number,
  unit: PaceUnit = 'km'
): { speedMs: number; speedKmh: number } | null {
  if (!Number.isFinite(paceSeconds) || paceSeconds <= 0) {
    return null;
  }

  const meters = unit === 'mi' ? 1609.344 : 1000;
  const speedMs = meters / paceSeconds;
  const speedKmh = speedMs * 3.6;

  return { speedMs, speedKmh };
}

/**
 * Pure calculation: Aerobic Efficiency Factor (EF) in meters covered per heartbeat.
 * Formula: (Speed in m/s * 60) / Heart Rate in bpm
 */
export function calculateEfficiencyFactor(
  speedMs: number,
  heartRateBpm: number
): number | null {
  if (
    !Number.isFinite(speedMs) ||
    speedMs <= 0 ||
    !Number.isFinite(heartRateBpm) ||
    heartRateBpm <= 0
  ) {
    return null;
  }

  return (speedMs * 60) / heartRateBpm;
}

/**
 * Get tier classification, styling and localized description for Vertical Ratio.
 */
export function getVerticalRatioLevel(
  vr: number,
  options: { locale?: LocaleInput } = {}
): FormattedVerticalRatioLevel {
  const loc = getLocale(options.locale).runningEfficiency.verticalRatio;

  if (vr < 6.0) {
    return {
      key: 'elite',
      label: loc.elite.label,
      description: loc.elite.desc,
      color: '#047857',
      bgColor: '#ecfdf5',
      barColor: '#10b981',
      barWidth: '25%',
    };
  }
  if (vr <= 8.0) {
    return {
      key: 'advanced',
      label: loc.advanced.label,
      description: loc.advanced.desc,
      color: '#047857',
      bgColor: '#ecfdf5',
      barColor: '#10b981',
      barWidth: '50%',
    };
  }
  if (vr <= 10.0) {
    return {
      key: 'average',
      label: loc.average.label,
      description: loc.average.desc,
      color: '#b45309',
      bgColor: '#fffbeb',
      barColor: '#f59e0b',
      barWidth: '75%',
    };
  }
  return {
    key: 'needsImprovement',
    label: loc.needsImprovement.label,
    description: loc.needsImprovement.desc,
    color: '#b91c1c',
    bgColor: '#fef2f2',
    barColor: '#ef4444',
    barWidth: '100%',
  };
}

/**
 * Get tier classification and styling for Duty Factor.
 */
export function getDutyFactorLevel(
  df: number,
  options: { locale?: LocaleInput } = {}
): FormattedDutyFactorLevel {
  const loc = getLocale(options.locale).runningEfficiency.dutyFactor;

  if (df < 30.0) {
    return {
      key: 'elite',
      label: loc.elite,
      color: '#047857',
      bgColor: '#ecfdf5',
    };
  }
  if (df <= 39.0) {
    return {
      key: 'advanced',
      label: loc.advanced,
      color: '#047857',
      bgColor: '#ecfdf5',
    };
  }
  return {
    key: 'recreational',
    label: loc.recreational,
    color: '#b45309',
    bgColor: '#fffbeb',
  };
}

/**
 * Get tier classification and styling for Efficiency Factor (EF).
 */
export function getEfficiencyFactorLevel(
  ef: number,
  options: { locale?: LocaleInput } = {}
): FormattedEfficiencyFactorLevel {
  const loc = getLocale(options.locale).runningEfficiency.efficiencyFactor;

  if (ef < 1.10) {
    return {
      key: 'developing',
      label: loc.developing,
      color: '#b45309',
      bgColor: '#fffbeb',
    };
  }
  if (ef <= 1.35) {
    return {
      key: 'solid',
      label: loc.solid,
      color: '#1d4ed8',
      bgColor: '#eff6ff',
    };
  }
  if (ef <= 1.60) {
    return {
      key: 'advanced',
      label: loc.advanced,
      color: '#047857',
      bgColor: '#ecfdf5',
    };
  }
  return {
    key: 'elite',
    label: loc.elite,
    color: '#047857',
    bgColor: '#ecfdf5',
  };
}

export interface RunningEfficiencyParams {
  // Biomechanical form inputs
  verticalOscillationCm?: number;
  strideLengthM?: number;
  cadenceSpm?: number;
  groundContactTimeMs?: number;

  // Aerobic cardiovascular inputs
  paceSeconds?: number;
  paceUnit?: PaceUnit;
  heartRateBpm?: number;
}

export interface FormEconomyResult {
  verticalRatio: number;
  verticalRatioFormatted: string;
  verticalRatioLevel: FormattedVerticalRatioLevel;
  dutyFactor: number;
  dutyFactorFormatted: string;
  dutyFactorLevel: FormattedDutyFactorLevel;
}

export interface AerobicEfficiencyResult {
  speedMs: number;
  speedKmh: number;
  speedDisplay: string;
  efficiencyFactor: number;
  efficiencyFactorFormatted: string;
  efficiencyFactorLevel: FormattedEfficiencyFactorLevel;
}

export interface RunningEfficiencyResult {
  formEconomy: FormEconomyResult | null;
  aerobicEfficiency: AerobicEfficiencyResult | null;
}

export interface RunningEfficiencyOptions {
  locale?: LocaleInput;
}

/**
 * Full presentation layer: Calculates form economy and aerobic efficiency metrics,
 * formatted strings, speed summaries, and tier badges.
 */
export function calculateRunningEfficiency(
  params: RunningEfficiencyParams,
  options: RunningEfficiencyOptions = {}
): RunningEfficiencyResult {
  const loc = getLocale(options.locale);

  // 1. Form Economy
  let formEconomy: FormEconomyResult | null = null;
  if (
    params.verticalOscillationCm !== undefined &&
    params.strideLengthM !== undefined &&
    params.cadenceSpm !== undefined &&
    params.groundContactTimeMs !== undefined
  ) {
    const vr = calculateVerticalRatio(params.verticalOscillationCm, params.strideLengthM);
    const df = calculateDutyFactor(params.cadenceSpm, params.groundContactTimeMs);

    if (vr !== null && df !== null) {
      formEconomy = {
        verticalRatio: Math.round(vr * 10) / 10,
        verticalRatioFormatted: `${vr.toFixed(1)}%`,
        verticalRatioLevel: getVerticalRatioLevel(vr, { locale: options.locale }),
        dutyFactor: Math.round(df * 10) / 10,
        dutyFactorFormatted: `${df.toFixed(1)}%`,
        dutyFactorLevel: getDutyFactorLevel(df, { locale: options.locale }),
      };
    }
  }

  // 2. Aerobic Efficiency
  let aerobicEfficiency: AerobicEfficiencyResult | null = null;
  if (params.paceSeconds !== undefined && params.heartRateBpm !== undefined) {
    const unit = params.paceUnit ?? 'km';
    const speed = paceToSpeed(params.paceSeconds, unit);

    if (speed !== null) {
      const ef = calculateEfficiencyFactor(speed.speedMs, params.heartRateBpm);
      if (ef !== null) {
        const speedDisplay = `${speed.speedMs.toFixed(2)} ${loc.runningEfficiency.speed.metersPerSec} (${speed.speedKmh.toFixed(1)} ${loc.runningEfficiency.speed.kmPerHour})`;
        const efUnit = loc.runningEfficiency.efficiencyFactor.unitLabel;

        aerobicEfficiency = {
          speedMs: Math.round(speed.speedMs * 100) / 100,
          speedKmh: Math.round(speed.speedKmh * 10) / 10,
          speedDisplay,
          efficiencyFactor: Math.round(ef * 100) / 100,
          efficiencyFactorFormatted: `${ef.toFixed(2)} ${efUnit}`,
          efficiencyFactorLevel: getEfficiencyFactorLevel(ef, { locale: options.locale }),
        };
      }
    }
  }

  return {
    formEconomy,
    aerobicEfficiency,
  };
}
