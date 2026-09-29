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

  interface IndexedPoint {
    pt: Trackpoint;
    originalIndex: number;
  }

  let indexedPoints: IndexedPoint[] = [];
  let globalIdx = 0;
  for (const act of activities) {
    for (const pt of act.points) {
      indexedPoints.push({ pt, originalIndex: globalIdx++ });
    }
  }

  if (sortChronologically) {
    indexedPoints.sort((a, b) => {
      const aTime =
        a.pt.time instanceof Date && !isNaN(a.pt.time.getTime())
          ? a.pt.time.getTime()
          : null;
      const bTime =
        b.pt.time instanceof Date && !isNaN(b.pt.time.getTime())
          ? b.pt.time.getTime()
          : null;

      if (aTime !== null && bTime !== null) {
        if (aTime !== bTime) {
          return aTime - bTime;
        }
        return a.originalIndex - b.originalIndex;
      }
      if (aTime !== null && bTime === null) {
        return -1; // Dated points precede undated points
      }
      if (aTime === null && bTime !== null) {
        return 1; // Undated points follow dated points
      }
      return a.originalIndex - b.originalIndex;
    });
  }

  const combinedPoints = indexedPoints.map((item) => item.pt);
  const normalizedPoints = normalizeTrackDistances(combinedPoints);
  const summary = calculateActivitySummary(normalizedPoints);

  return {
    name,
    points: normalizedPoints,
    summary,
  };
}

