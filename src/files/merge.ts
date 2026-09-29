import type { Activity, Trackpoint } from './types.js';
import { normalizeTrackDistances, calculateActivitySummary } from './geo.js';
import { getLocale, type LocaleInput } from '../i18n/index.js';

export interface MergeActivitiesOptions {
  /** Title of the merged activity. Defaults to first activity name or localized title. */
  name?: string;
  /** Sort all trackpoints chronologically by timestamp if available. Defaults to true. */
  sortChronologically?: boolean;
  /** Optional language or custom dictionary override for generated activity title. */
  locale?: LocaleInput;
}

/**
 * Merge multiple Activity objects into a single continuous Activity.
 * Concatenates trackpoint streams, sorts chronologically with total ordering for undated points,
 * performs continuous distance recalculation, and updates complete summary statistics.
 *
 * @param activities Array of Activity objects to merge
 * @param options Merge configuration options
 * @returns Combined continuous Activity
 */
export function mergeActivities(
  activities: Activity[],
  options?: MergeActivitiesOptions
): Activity {
  const loc = getLocale(options?.locale);

  if (!activities || activities.length === 0) {
    return {
      name: options?.name || loc.files.emptyActivityName,
      points: [],
      summary: calculateActivitySummary([]),
    };
  }

  const baseName = activities[0].name || loc.files.defaultActivityName;
  const name =
    options?.name ||
    (activities.length > 1
      ? `${baseName}${loc.files.mergedActivitySuffix}`
      : activities[0].name || baseName);
  const sortChronologically = options?.sortChronologically ?? true;

  // 1. Singleton fast path: preserve recorded summary statistics when points cannot reconstruct them
  if (activities.length === 1) {
    const single = activities[0];
    if (single.points.length === 0) {
      return {
        ...single,
        name,
        summary: { ...single.summary },
      };
    }
  }

  // 2. Sort activities by their initial valid timestamp (if chronological sorting is requested)
  function getFirstValidTime(pts: Trackpoint[]): number | null {
    for (const p of pts) {
      if (p.time instanceof Date && !isNaN(p.time.getTime())) {
        return p.time.getTime();
      }
    }
    return null;
  }

  const sortedActivities = [...activities];
  if (sortChronologically) {
    sortedActivities.sort((a, b) => {
      const aTime = getFirstValidTime(a.points);
      const bTime = getFirstValidTime(b.points);
      if (aTime !== null && bTime !== null) {
        return aTime - bTime;
      }
      if (aTime !== null) return -1;
      if (bTime !== null) return 1;
      return 0;
    });
  }

  // Check if all activities completely lack trackpoints (e.g. merging lap summaries without tracks)
  const totalPointsCount = sortedActivities.reduce((acc, act) => acc + act.points.length, 0);
  if (totalPointsCount === 0) {
    // Aggregate recorded summaries across empty-track activities
    let totalDist = 0;
    let totalDur = 0;
    let totalElapsed = 0;
    let cadSum = 0;
    let cadCount = 0;

    for (const act of sortedActivities) {
      totalDist += act.summary.distance || 0;
      totalDur += act.summary.duration || 0;
      totalElapsed += act.summary.totalElapsedTime || act.summary.duration || 0;
      if (act.summary.avgCadence) {
        cadSum += act.summary.avgCadence;
        cadCount++;
      }
    }

    return {
      name,
      points: [],
      summary: {
        distance: Math.round(totalDist * 100) / 100,
        duration: Math.round(totalDur),
        totalElapsedTime: Math.round(totalElapsed),
        avgPaceSecs: totalDist > 0 && totalDur > 0 ? Math.round((totalDur / (totalDist / 1000)) * 10) / 10 : 0,
        avgHeartRate: null,
        maxHeartRate: null,
        avgCadence: cadCount > 0 ? Math.round(cadSum / cadCount) : null,
        maxCadence: null,
        totalAscent: null,
        totalDescent: null,
        avgPower: null,
        maxPower: null,
        sport: sortedActivities[0].summary.sport || 'running',
        subSport: sortedActivities[0].summary.subSport ?? null,
      },
    };
  }

  // 3. Concatenate points while retaining source-distance provenance
  const combinedPoints: Trackpoint[] = [];
  for (const act of sortedActivities) {
    for (const pt of act.points) {
      combinedPoints.push({ ...pt });
    }
  }

  // 4. Stable chronological sort for points if internal sequence contains timestamp inversions
  if (sortChronologically) {
    // Assign an inferred or anchor time to undated points based on their adjacent neighbors
    // so they are not moved to arbitrary positions that corrupt distance continuity.
    let lastValidTime: number | null = null;
    const indexed = combinedPoints.map((pt, originalIndex) => {
      const t = pt.time instanceof Date && !isNaN(pt.time.getTime()) ? pt.time.getTime() : null;
      if (t !== null) lastValidTime = t;
      return { pt, effectiveTime: t ?? lastValidTime ?? -1, originalIndex };
    });

    indexed.sort((a, b) => {
      if (a.effectiveTime !== b.effectiveTime) {
        return a.effectiveTime - b.effectiveTime;
      }
      return a.originalIndex - b.originalIndex;
    });

    for (let i = 0; i < combinedPoints.length; i++) {
      combinedPoints[i] = indexed[i].pt;
    }
  }

  const finalPoints = normalizeTrackDistances(combinedPoints);
  const summary = calculateActivitySummary(finalPoints);

  return {
    name,
    points: finalPoints,
    summary,
  };
}

