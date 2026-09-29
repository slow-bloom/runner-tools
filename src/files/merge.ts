import type { Activity, Trackpoint } from './types.js';
import { normalizeTrackDistances, calculateActivitySummary } from './geo.js';

export interface MergeActivitiesOptions {
  /** Title of the merged activity. Defaults to first activity name or "Merged Activity". */
  name?: string;
  /** Sort all trackpoints chronologically by timestamp if available. Defaults to true. */
  sortChronologically?: boolean;
}

/**
 * Merge multiple Activity objects into a single continuous Activity.
 * Concat trackpoint streams, sorts by timestamp, continuous distance recalculation,
 * and updates complete summary statistics.
 *
 * @param activities Array of Activity objects to merge
 * @param options Merge configuration options
 * @returns Combined continuous Activity
 */
export function mergeActivities(
  activities: Activity[],
  options?: MergeActivitiesOptions
): Activity {
  if (!activities || activities.length === 0) {
    return {
      name: 'Empty Activity',
      points: [],
      summary: calculateActivitySummary([]),
    };
  }

  if (activities.length === 1) {
    return {
      ...activities[0],
      name: options?.name || activities[0].name,
    };
  }

  const name = options?.name || `${activities[0].name} (Merged)`;
  const sortChronologically = options?.sortChronologically ?? true;

  let combinedPoints: Trackpoint[] = [];
  for (const act of activities) {
    combinedPoints = combinedPoints.concat(act.points);
  }

  if (sortChronologically) {
    combinedPoints.sort((a, b) => {
      if (a.time && b.time) {
        return a.time.getTime() - b.time.getTime();
      }
      return 0;
    });
  }

  const normalizedPoints = normalizeTrackDistances(combinedPoints);
  const summary = calculateActivitySummary(normalizedPoints);

  return {
    name,
    points: normalizedPoints,
    summary,
  };
}
