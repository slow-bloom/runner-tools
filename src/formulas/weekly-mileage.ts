import { getLocale, type LocaleInput } from '../i18n/index.js';

export type WeekStatusType = 'base' | 'build' | 'deload' | 'target';

export interface WeeklyMileageParams {
  currentDistance: number;
  targetDistance: number;
  unit?: 'km' | 'mi';
  maxWeeklyIncreasePct?: number; // default: 10 (10% rule)
  includeDeload?: boolean; // default: true
  deloadFrequency?: number; // default: 4 (every 4th week)
  deloadReductionPct?: number; // default: 20 (20% reduction)
  lang?: LocaleInput;
}

export interface WeeklyPlanItem {
  weekNumber: number;
  distance: number;
  distanceFormatted: string;
  status: WeekStatusType;
  statusLabel: string;
  pctChange: number;
  pctChangeFormatted: string;
  isDeload: boolean;
  isTarget: boolean;
}

export interface WeeklyMileageResult {
  currentDistance: number;
  targetDistance: number;
  unit: 'km' | 'mi';
  totalWeeks: number;
  weeks: WeeklyPlanItem[];
  maxVolume: number;
  averageWeeklyVolume: number;
  totalDistance: number;
  timelineSummary: string;
}

/**
 * Pure calculation: safely ramp up weekly running volume
 * Implements the 10% rule and structured deload recovery cycles.
 */
export function calculateWeeklyMileagePlan(
  params: WeeklyMileageParams
): WeeklyMileageResult | null {
  const {
    currentDistance,
    targetDistance,
    unit = 'km',
    maxWeeklyIncreasePct = 10,
    includeDeload = true,
    deloadFrequency = 4,
    deloadReductionPct = 20,
    lang,
  } = params;

  if (
    !Number.isFinite(currentDistance) ||
    currentDistance <= 0 ||
    !Number.isFinite(targetDistance) ||
    targetDistance <= 0 ||
    targetDistance < currentDistance ||
    !Number.isFinite(maxWeeklyIncreasePct) ||
    maxWeeklyIncreasePct <= 0 ||
    maxWeeklyIncreasePct > 50 ||
    !Number.isFinite(deloadFrequency) ||
    deloadFrequency < 2 ||
    !Number.isFinite(deloadReductionPct) ||
    deloadReductionPct <= 0 ||
    deloadReductionPct >= 80
  ) {
    return null;
  }

  const loc = getLocale(lang);
  const statusLabels: Record<WeekStatusType, string> = {
    base: loc.weeklyMileage.status.base,
    build: loc.weeklyMileage.status.build,
    deload: loc.weeklyMileage.status.deload,
    target: loc.weeklyMileage.status.target,
  };

  const weeks: WeeklyPlanItem[] = [];

  // Week 1: Baseline
  let currentVol = Math.round(currentDistance * 10) / 10;
  let previousBuildVol = currentVol;

  weeks.push({
    weekNumber: 1,
    distance: currentVol,
    distanceFormatted: `${currentVol.toFixed(1)} ${unit}`,
    status: currentVol >= targetDistance ? 'target' : 'base',
    statusLabel: currentVol >= targetDistance ? statusLabels.target : statusLabels.base,
    pctChange: 0,
    pctChangeFormatted: '—',
    isDeload: false,
    isTarget: currentVol >= targetDistance,
  });

  if (currentVol >= targetDistance) {
    return {
      currentDistance,
      targetDistance,
      unit,
      totalWeeks: 1,
      weeks,
      maxVolume: currentVol,
      averageWeeklyVolume: currentVol,
      totalDistance: currentVol,
      timelineSummary: `1 Week`,
    };
  }

  let weekNum = 2;
  const MAX_WEEKS_LIMIT = 52; // 1 year limit to prevent runaways

  while (weekNum <= MAX_WEEKS_LIMIT) {
    const isDeload = includeDeload && weekNum % deloadFrequency === 0;

    let weekVol: number;
    let status: WeekStatusType;
    let isTarget = false;

    if (isDeload) {
      status = 'deload';
      weekVol = Math.round(previousBuildVol * (1 - deloadReductionPct / 100) * 10) / 10;
    } else {
      const projected = Math.round(previousBuildVol * (1 + maxWeeklyIncreasePct / 100) * 10) / 10;
      if (projected >= targetDistance) {
        weekVol = targetDistance;
        status = 'target';
        isTarget = true;
      } else {
        weekVol = projected;
        status = 'build';
      }
      previousBuildVol = weekVol;
    }

    const prevWeekVol = weeks[weeks.length - 1].distance;
    const changePct = Math.round(((weekVol - prevWeekVol) / prevWeekVol) * 1000) / 10;
    const changeFormatted = `${changePct > 0 ? '+' : ''}${changePct.toFixed(1)}%`;

    weeks.push({
      weekNumber: weekNum,
      distance: weekVol,
      distanceFormatted: `${weekVol.toFixed(1)} ${unit}`,
      status,
      statusLabel: statusLabels[status],
      pctChange: changePct,
      pctChangeFormatted: changeFormatted,
      isDeload,
      isTarget,
    });

    if (isTarget) {
      break;
    }
    weekNum++;
  }

  const totalDistance = Math.round(weeks.reduce((sum, w) => sum + w.distance, 0) * 10) / 10;
  const averageWeeklyVolume = Math.round((totalDistance / weeks.length) * 10) / 10;
  const maxVolume = Math.max(...weeks.map((w) => w.distance));

  return {
    currentDistance,
    targetDistance,
    unit,
    totalWeeks: weeks.length,
    weeks,
    maxVolume,
    averageWeeklyVolume,
    totalDistance,
    timelineSummary: `${weeks.length} Weeks`,
  };
}
