import type { Activity, Trackpoint, GeoJSONFeatureCollection, GeoJSONExportOptions } from './types.js';
import { getLocale } from '../i18n/index.js';

/**
 * Convert Activity or Trackpoint array into a standardized GeoJSON FeatureCollection.
 * Coordinates are formatted as [longitude, latitude, elevation] per RFC 7946.
 *
 * @param activityOrPoints Activity object or array of Trackpoints
 * @param options GeoJSON export options
 * @returns GeoJSON FeatureCollection object
 */
export function toGeoJSON(
  activityOrPoints: Activity | Trackpoint[],
  options?: GeoJSONExportOptions
): GeoJSONFeatureCollection {
  const loc = getLocale(options?.locale);
  const defaultName = loc.files.defaultActivityName;
  const points = Array.isArray(activityOrPoints) ? activityOrPoints : activityOrPoints.points;
  const name =
    options?.name ||
    (!Array.isArray(activityOrPoints) && activityOrPoints.name ? activityOrPoints.name : defaultName);
  const includeElevation = options?.includeElevationInCoordinates ?? true;

  const coordinates: Array<[number, number] | [number, number, number]> = [];
  const timestamps: Array<string | null> = [];
  const heartrates: Array<number | null> = [];
  const cadences: Array<number | null> = [];
  const elevations: Array<number | null> = [];
  const distances: Array<number | null> = [];

  for (const pt of points) {
    if (
      pt.lat !== null &&
      pt.lon !== null &&
      Number.isFinite(pt.lat) &&
      Number.isFinite(pt.lon)
    ) {
      if (includeElevation && pt.ele !== null && Number.isFinite(pt.ele)) {
        coordinates.push([pt.lon, pt.lat, pt.ele]);
      } else {
        coordinates.push([pt.lon, pt.lat]);
      }

      timestamps.push(
        pt.time instanceof Date && !isNaN(pt.time.getTime())
          ? pt.time.toISOString()
          : null
      );
      heartrates.push(pt.hr ?? null);
      cadences.push(pt.cad ?? null);
      elevations.push(pt.ele ?? null);
      distances.push(pt.distance ?? null);
    }
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates,
        },
        properties: {
          name,
          timestamps,
          heartrates,
          cadences,
          elevations,
          distances,
        },
      },
    ],
  };
}

/**
 * Serialize Activity or Trackpoints to formatted GeoJSON string.
 */
export function serializeToGeoJSON(
  activityOrPoints: Activity | Trackpoint[],
  options?: GeoJSONExportOptions
): string {
  return JSON.stringify(toGeoJSON(activityOrPoints, options), null, 2);
}
