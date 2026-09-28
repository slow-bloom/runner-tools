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
 * Progressive weekly running volume planner based on the classical 10% rule
 * and structured periodization deload recovery cycles.
 *
 * Scientific Basis & Provenance:
 * - 10% Volume Progression Heuristic: Popularized by Henderson (1979) and Dr. Joan Ullyot,
 *   and discussed extensively by Daniels (2014, Daniels' Running Formula, 3rd ed.). While widely
 *   adopted in endurance coaching, epidemiological research (Nielsen et al., 2014, "The 10% increase
 *   rule for preventing running-related injuries...", J Orthop Sports Phys Ther, 44(10):739-747)
 *   indicates that a volume increase cap alone does not guarantee injury immunity.
 * - Deload Cycles & Workload Management: Systematic recovery weeks (reducing volume by 20–30%
 *   every 3–4 weeks) follow foundational athletic periodization principles (Bompa & Haff, 2009,
 *   Periodization: Theory and Methodology of Training; Gabbett, 2016, "The training—injury prevention
 *   paradox...", Br J Sports Med, 50(5):273-280) to lower acute fatigue while consolidating tissue adaptation.
 *
 * Important Disclaimer:
 * This model provides a mathematical periodization guideline for training progression.
 * It is a heuristic planning tool, NOT an individual safety guarantee or medical prescription
 * against running-related injuries (RRI).
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
    currentDistance < 1 ||
    currentDistance > 500 ||
    !Number.isFinite(targetDistance) ||
    targetDistance < 1 ||
    targetDistance > 500 ||
    targetDistance < currentDistance ||
    !Number.isFinite(maxWeeklyIncreasePct) ||
    maxWeeklyIncreasePct < 1 ||
    maxWeeklyIncreasePct > 50 ||
    !Number.isFinite(deloadFrequency) ||
    deloadFrequency < 2 ||
    !Number.isFinite(deloadReductionPct) ||
    deloadReductionPct < 5 ||
    deloadReductionPct > 50
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
  const unitLabel = unit === 'km' ? loc.weeklyMileage.units.km : loc.weeklyMileage.units.mi;

  const formatDistanceNumber = (val: number): string => {
    const rounded = Math.round(val * 100) / 100;
    return rounded.toString();
  };

  const weeks: WeeklyPlanItem[] = [];

  let rawBuildVol = currentDistance;
  const initialDistance = Math.round(currentDistance * 100) / 100;

  weeks.push({
    weekNumber: 1,
    distance: initialDistance,
    distanceFormatted: `${formatDistanceNumber(initialDistance)} ${unitLabel}`,
    status: initialDistance >= targetDistance ? 'target' : 'base',
    statusLabel: initialDistance >= targetDistance ? statusLabels.target : statusLabels.base,
    pctChange: 0,
    pctChangeFormatted: '—',
    isDeload: false,
    isTarget: initialDistance >= targetDistance,
  });

  if (initialDistance >= targetDistance) {
    return {
      currentDistance,
      targetDistance,
      unit,
      totalWeeks: 1,
      weeks,
      maxVolume: initialDistance,
      averageWeeklyVolume: initialDistance,
      totalDistance: initialDistance,
      timelineSummary: `1 ${loc.weeklyMileage.labels.week}`,
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
      const rawDeload = rawBuildVol * (1 - deloadReductionPct / 100);
      weekVol = Math.round(rawDeload * 100) / 100;
    } else {
      const nextRawBuild = rawBuildVol * (1 + maxWeeklyIncreasePct / 100);
      if (nextRawBuild >= targetDistance) {
        rawBuildVol = targetDistance;
        weekVol = Math.round(targetDistance * 100) / 100;
        status = 'target';
        isTarget = true;
      } else {
        rawBuildVol = nextRawBuild;
        let rounded = Math.round(nextRawBuild * 100) / 100;
        // Ensure displayed prescription does not exceed configured increase cap due to rounding
        const prevVol = weeks[weeks.length - 1].distance;
        if (rounded > prevVol * (1 + maxWeeklyIncreasePct / 100) + 1e-9) {
          rounded = Math.floor(nextRawBuild * 100) / 100;
        }
        weekVol = rounded;
        status = 'build';
      }
    }

    const prevWeekVol = weeks[weeks.length - 1].distance;
    const changePct = Math.round(((weekVol - prevWeekVol) / prevWeekVol) * 1000) / 10;
    const changeFormatted = `${changePct > 0 ? '+' : ''}${changePct.toFixed(1)}%`;

    weeks.push({
      weekNumber: weekNum,
      distance: weekVol,
      distanceFormatted: `${formatDistanceNumber(weekVol)} ${unitLabel}`,
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

  const totalDistance = Math.round(weeks.reduce((sum, w) => sum + w.distance, 0) * 100) / 100;
  const averageWeeklyVolume = Math.round((totalDistance / weeks.length) * 100) / 100;
  const maxVolume = Math.max(...weeks.map((w) => w.distance));
  const weekWord = weeks.length === 1 ? loc.weeklyMileage.labels.week : loc.weeklyMileage.labels.weeks;

  return {
    currentDistance,
    targetDistance,
    unit,
    totalWeeks: weeks.length,
    weeks,
    maxVolume,
    averageWeeklyVolume,
    totalDistance,
    timelineSummary: `${weeks.length} ${weekWord}`,
  };
}
