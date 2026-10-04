import type {
  Activity, ActivitySummary, FITMetadata, ParseTrackOptions, Trackpoint,
} from './types.js';
import { FITError, parseFIT, serializeToFIT } from './fit.js';
import { parseGPX, serializeToGPX } from './gpx.js';
import { parseTCX, serializeToTCX } from './tcx.js';
import { parseKML, serializeToKML } from './kml.js';
import { parseCSV, serializeToCSV } from './csv.js';
import { serializeToGeoJSON } from './geojson.js';
import { mergeActivities } from './merge.js';
import {
  calculateActivitySummary,
  calculateElevationGain,
  cropTrack,
  normalizeTrackDistances,
  stripTrackGPS,
} from './geo.js';

export const TRACK_FILE_INPUT_FORMATS = ['fit', 'gpx', 'tcx', 'kml', 'csv'] as const;
export type TrackFileInputFormat = (typeof TRACK_FILE_INPUT_FORMATS)[number];
export type TrackFileOutputFormat = TrackFileInputFormat | 'geojson';
export type TrackFileData = string | ArrayBuffer | Uint8Array;

export type FileConversionErrorCode =
  | 'unsupported-format'
  | 'invalid-file'
  | 'no-trackpoints'
  | 'invalid-options'
  | 'empty-result'
  | 'coordinates-required'
  | 'timestamps-required';

export class FileConversionError extends Error {
  constructor(
    public readonly code: FileConversionErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'FileConversionError';
  }
}

export interface ProcessActivitiesOptions extends ParseTrackOptions {
  name?: string;
  cropStartMeters?: number;
  cropEndMeters?: number;
  forceGpsDistance?: boolean;
  stripGPS?: boolean;
}

export interface ProcessedActivity {
  activity: Activity;
  /** Preview metrics use current sensor samples, retaining recorded distance, time and cadence. */
  statistics: ActivitySummary;
  warnings: Array<'opaque-fit-data-removed' | 'fit-summary-metadata-removed'>;
  /** Point-derived elevation is separate from the watch summary retained for export. */
  elevation: {
    calculatedAscent: number | null;
    recordedAscent: number | null;
  };
}

export interface SerializeActivityOptions extends ParseTrackOptions {
  name?: string;
  creator?: string;
  stripLaps?: boolean;
  /** Explicit FIT activity start for undated routes; missing point times stay missing. */
  startTime?: Date;
}

export interface SerializedActivity {
  data: string | Uint8Array;
  mimeType: string;
  extension: TrackFileOutputFormat;
}

function validateXML(text: string, expectedRoot: string): void {
  const tags = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/?[A-Za-z_][\w:.-]*(?:\s+(?:[^<>"']|"[^"]*"|'[^']*')*)?\s*\/?>/g;
  const stack: string[] = [];
  let end = 0;
  let rootSeen = false;

  for (const token of text.matchAll(tags)) {
    const between = text.slice(end, token.index);
    if (between.includes('<') || (stack.length === 0 && between.trim() !== '')) {
      throw new FileConversionError('invalid-file', 'Malformed XML document.');
    }
    end = token.index + token[0].length;
    const tag = token[0];
    if (tag.startsWith('<!--') || tag.startsWith('<?')) continue;
    if (tag.startsWith('<![CDATA[')) {
      if (stack.length === 0) {
        throw new FileConversionError('invalid-file', 'CDATA outside the XML root.');
      }
      continue;
    }

    const name = tag.match(/^<\/?([^\s/>]+)/)![1];
    if (tag.startsWith('</')) {
      if (stack.pop() !== name) {
        throw new FileConversionError('invalid-file', 'Mismatched XML closing tag.');
      }
    } else {
      if (stack.length === 0) {
        if (rootSeen || name.split(':').pop()?.toLowerCase() !== expectedRoot) {
          throw new FileConversionError('invalid-file', `Expected a ${expectedRoot} document.`);
        }
        rootSeen = true;
      }
      if (!tag.endsWith('/>')) stack.push(name);
    }
  }

  if (!rootSeen || stack.length > 0 || text.slice(end).trim() !== '') {
    throw new FileConversionError('invalid-file', 'Incomplete XML document.');
  }
}

/** Parse an uploaded file locally, rejecting malformed input instead of returning an empty success. */
export function parseActivityFile(
  data: TrackFileData,
  format: TrackFileInputFormat,
  options?: ParseTrackOptions,
): Activity {
  if (!TRACK_FILE_INPUT_FORMATS.includes(format)) {
    throw new FileConversionError('unsupported-format', `Unsupported input format: ${format}.`);
  }

  let activity: Activity;
  try {
    if (format === 'fit') {
      if (typeof data === 'string') {
        throw new FileConversionError('invalid-file', 'FIT input must be binary.');
      }
      activity = parseFIT(data, options);
    } else {
      const text = typeof data === 'string' ? data : new TextDecoder('utf-8', { fatal: true }).decode(data);
      switch (format) {
        case 'gpx':
          validateXML(text, 'gpx');
          activity = parseGPX(text, options);
          break;
        case 'tcx':
          validateXML(text, 'trainingcenterdatabase');
          activity = parseTCX(text, options);
          break;
        case 'kml':
          validateXML(text, 'kml');
          activity = parseKML(text, options);
          break;
        case 'csv':
          activity = parseCSV(text, options);
          break;
      }
    }
  } catch (error) {
    if (error instanceof FileConversionError) throw error;
    throw new FileConversionError(
      'invalid-file',
      `Unable to read ${format.toUpperCase()}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  if (activity.points.length === 0 || activity.points.every((point) =>
    [point.lat, point.lon, point.ele, point.time, point.hr, point.cad, point.distance,
      point.speed, point.power, point.temp, point.stepLength, point.verticalOscillation,
      point.stanceTime].every((value) => value == null)
  )) {
    throw new FileConversionError('no-trackpoints', 'No trackpoints were found in this file.');
  }
  if (activity.points.some((point) =>
    (point.lat !== null && (!Number.isFinite(point.lat) || Math.abs(point.lat) > 90)) ||
    (point.lon !== null && (!Number.isFinite(point.lon) || Math.abs(point.lon) > 180))
  )) {
    throw new FileConversionError('invalid-file', 'Track coordinates are outside their valid range.');
  }
  if (format !== 'fit') {
    const sport = activity.summary.sport;
    const running = sport === 'running' || sport === 'walking' || sport === 'hiking';
    activity.points = activity.points.map((point) => point.sport !== undefined || point.cadenceUnit !== undefined ? point : {
      ...point,
      sport,
      // Match the existing text-import convention once, before crossing into FIT's typed units.
      cad: running && point.cad !== null && point.cad > 0 && point.cad < 120
        ? point.cad * 2 : point.cad,
    });
  }
  return activity;
}

function combineSummaries(activities: Activity[], points: Trackpoint[]): ActivitySummary {
  if (activities.length === 1) return { ...activities[0].summary };

  const summary = calculateActivitySummary(points, {
    distance: activities.reduce((total, activity) => total + activity.summary.distance, 0),
    duration: activities.reduce((total, activity) => total + activity.summary.duration, 0),
    sport: activities[0].summary.sport,
    subSport: activities[0].summary.subSport,
  });
  for (const key of [
    'avgHeartRate', 'avgCadence', 'avgPower', 'avgSpeed', 'avgStepLength',
    'avgVerticalOscillation', 'avgStanceTime', 'avgStanceTimePercent',
    'avgStanceTimeBalance', 'avgVerticalRatio', 'avgTemperature',
  ] as const) {
    let total = 0;
    let weights = 0;
    for (const activity of activities) {
      const value = activity.summary[key];
      if (value != null && Number.isFinite(value)) {
        const weight = activity.summary.duration > 0 ? activity.summary.duration : 1;
        total += value * weight;
        weights += weight;
      }
    }
    summary[key] = weights > 0
      ? key === 'avgCadence' ? total / weights : Math.round(total / weights * 100) / 100
      : null;
  }
  for (const key of ['maxHeartRate', 'maxCadence', 'maxPower', 'maxSpeed', 'maxTemperature'] as const) {
    let maximum: number | null = null;
    for (const activity of activities) {
      const value = activity.summary[key];
      if (value != null && Number.isFinite(value)) maximum = Math.max(maximum ?? value, value);
    }
    summary[key] = maximum;
  }
  for (const key of ['totalAscent', 'totalDescent'] as const) {
    let total: number | null = null;
    for (const activity of activities) {
      const value = activity.summary[key];
      if (value !== null && Number.isFinite(value)) total = (total ?? 0) + value;
    }
    summary[key] = total;
  }
  for (const key of ['totalCalories', 'totalCycles', 'totalMovingTime'] as const) {
    const values = activities.map((activity) => activity.summary[key]);
    if (values.every((value): value is number => value != null && Number.isFinite(value))) {
      summary[key] = values.reduce((total, value) => total + value, 0);
    }
  }
  return summary;
}

function retainRecordMetadata(activities: Activity[]): {
  activities: Activity[];
  fit?: FITMetadata;
} {
  let nextIndex = 0;
  const prepared: Activity[] = [];
  const fit: FITMetadata = { protocolVersion: 0x20, profileVersion: 0, messages: [] };
  for (const activity of activities) {
    const indexes = new Map<number, number>();
    function mappedIndex(index: number): number {
      if (!Number.isInteger(index) || index < 0 || index >= 255) {
        throw new FileConversionError('invalid-file', 'Invalid FIT developer identifier.');
      }
      const existing = indexes.get(index);
      if (existing !== undefined) return existing;
      if (nextIndex >= 255) {
        throw new FileConversionError('invalid-options', 'Too many FIT developer identifiers to merge.');
      }
      const replacement = nextIndex++;
      indexes.set(index, replacement);
      return replacement;
    }
    for (const point of activity.points) {
      if (!point.fit) continue;
      for (const field of point.fit.developerFields) mappedIndex(field.developerDataIndex);
    }
    prepared.push({
      ...activity,
      points: activity.points.map((point) => !point.fit ? point : {
        ...point,
        fit: {
          ...point.fit,
          developerFields: point.fit.developerFields.map((field) => ({
            ...field, developerDataIndex: mappedIndex(field.developerDataIndex),
          })),
        },
      }),
    });
    if (!activity.fit) continue;
    fit.protocolVersion = Math.max(fit.protocolVersion, activity.fit.protocolVersion);
    fit.profileVersion = Math.max(fit.profileVersion, activity.fit.profileVersion);
    for (const message of activity.fit.messages) {
      if (message.globalMessageNumber !== 206 && message.globalMessageNumber !== 207) continue;
      const indexField = message.globalMessageNumber === 207 ? 3 : 0;
      fit.messages.push({
        ...message,
        recordIndex: 0,
        fields: message.fields.map((field) => {
          if (field.number !== indexField) return field;
          if (typeof field.value !== 'number' || field.data.length !== 1) {
            throw new FileConversionError('invalid-file', 'Invalid FIT developer identifier.');
          }
          const value = mappedIndex(field.value);
          return { ...field, value, data: new Uint8Array([value]) };
        }),
        developerFields: message.developerFields.map((field) => ({
          ...field, developerDataIndex: mappedIndex(field.developerDataIndex),
        })),
      });
    }
  }
  return {
    activities: prepared,
    fit: fit.messages.length ? fit : undefined,
  };
}

/** Merge, normalize, crop and redact without mutating the uploaded activities. */
export function processActivities(
  activities: Activity[],
  options: ProcessActivitiesOptions = {},
): ProcessedActivity {
  if (activities.length === 0 || activities.every((activity) => activity.points.length === 0)) {
    throw new FileConversionError('no-trackpoints', 'Select an activity containing trackpoints.');
  }
  const cropStart = options.cropStartMeters ?? 0;
  const cropEnd = options.cropEndMeters ?? 0;
  if (![cropStart, cropEnd].every((value) => Number.isFinite(value) && value >= 0)) {
    throw new FileConversionError('invalid-options', 'Crop distances must be finite, non-negative meters.');
  }

  const cropped = cropStart > 0 || cropEnd > 0;
  const hasFitData = activities.some((activity) => activity.fit || activity.points.some((point) => point.fit));
  const retained = !cropped && !options.stripGPS && hasFitData && (options.forceGpsDistance || activities.length > 1)
    ? retainRecordMetadata(activities) : undefined;
  const merged = mergeActivities(retained?.activities ?? activities, { name: options.name, locale: options.locale });
  const recordedSummary = combineSummaries(activities, merged.points);
  let points = merged.points;
  if (options.forceGpsDistance) {
    if (!points.some((point, index) => index > 0 &&
      point.lat !== null && point.lon !== null &&
      points[index - 1].lat !== null && points[index - 1].lon !== null)) {
      throw new FileConversionError('coordinates-required', 'GPS distance requires consecutive coordinate samples.');
    }
    points = normalizeTrackDistances(points, { forceGps: true });
  }
  points = cropTrack(points, { cropStartMeters: cropStart, cropEndMeters: cropEnd });
  if (points.length === 0) {
    throw new FileConversionError('empty-result', 'The crop removes every trackpoint. Reduce the crop distances.');
  }

  const summary = cropped || options.forceGpsDistance
    ? calculateActivitySummary(points, {
      sport: recordedSummary.sport,
      subSport: recordedSummary.subSport,
      ...(!cropped ? {
        duration: recordedSummary.duration,
        totalElapsedTime: recordedSummary.totalElapsedTime,
      } : {}),
    })
    : recordedSummary;
  if (!cropped && options.forceGpsDistance) {
    for (const key of ['totalCalories', 'totalCycles', 'totalMovingTime'] as const) {
      if (recordedSummary[key] != null) summary[key] = recordedSummary[key];
    }
    if (summary.totalCycles && summary.distance > 0) {
      summary.avgStepLength = summary.distance / (summary.totalCycles * 2) * 1000;
    }
  }
  const elevationPoints = points.filter((point) => point.ele !== null && Number.isFinite(point.ele));
  const calculatedAscent = elevationPoints.length > 1 ? calculateElevationGain(points).ascent : null;
  const hasRecordedAscent = activities.some((activity) =>
    activity.fit?.messages.some((message) => message.summary?.totalAscent != null));
  const statistics = calculateActivitySummary(points, {
    distance: summary.distance,
    duration: summary.duration,
    totalElapsedTime: summary.totalElapsedTime,
    avgCadence: summary.avgCadence ?? undefined,
    sport: summary.sport,
    subSport: summary.subSport,
  });
  statistics.avgHeartRate ??= summary.avgHeartRate;
  const warnings: ProcessedActivity['warnings'] = [];
  let fit = retained ? retained.fit : activities.length === 1 ? activities[0].fit : undefined;

  if (cropped || options.stripGPS) {
    // Opaque extensions and source summaries may still contain the redacted locations.
    points = options.stripGPS
      ? stripTrackGPS(points)
      : points.map(({ fit: _sourceFields, ...point }) => point);
    fit = undefined;
    if (hasFitData) warnings.push('opaque-fit-data-removed');
  } else if (options.forceGpsDistance || activities.length > 1) {
    if (hasFitData) warnings.push('fit-summary-metadata-removed');
  }

  return {
    activity: {
      name: merged.name,
      points,
      summary,
      ...(!cropped && !options.stripGPS && !options.forceGpsDistance && activities.length === 1
        ? { recordedLaps: activities[0].recordedLaps } : {}),
      ...(fit ? { fit } : {}),
    },
    statistics,
    warnings,
    elevation: {
      calculatedAscent,
      recordedAscent: !cropped && hasRecordedAscent ? recordedSummary.totalAscent : null,
    },
  };
}

/** Serialize the current processed activity, not stale metrics from an original upload. */
export function serializeActivity(
  activity: Activity,
  format: TrackFileOutputFormat,
  options: SerializeActivityOptions = {},
): SerializedActivity {
  if (activity.points.length === 0) {
    throw new FileConversionError('no-trackpoints', 'There are no trackpoints to export.');
  }
  if (options.startTime && (!(options.startTime instanceof Date) || !Number.isFinite(options.startTime.getTime()))) {
    throw new FileConversionError('invalid-options', 'The export start time must be a valid date.');
  }
  if (['gpx', 'kml', 'geojson'].includes(format)) {
    const coordinates = activity.points.filter((point) => point.lat !== null && point.lon !== null);
    if (coordinates.length < (format === 'geojson' ? 2 : 1)) {
      throw new FileConversionError(
        'coordinates-required',
        'This format requires GPS coordinates. Use FIT, TCX or CSV to retain an indoor or redacted activity.',
      );
    }
  }

  switch (format) {
    case 'fit':
      try {
        return { data: serializeToFIT(activity, options), mimeType: 'application/octet-stream', extension: format };
      } catch (error) {
        throw new FileConversionError(
          error instanceof FITError ? error.code : 'invalid-file',
          error instanceof Error ? error.message : String(error),
          { cause: error },
        );
      }
    case 'gpx':
      return { data: serializeToGPX(activity, options), mimeType: 'application/gpx+xml', extension: format };
    case 'tcx':
      return {
        data: serializeToTCX(activity, {
          ...options,
          sport: activity.summary.sport === 'running' ? 'Running'
            : activity.summary.sport === 'cycling' ? 'Biking' : 'Other',
          calories: activity.summary.totalCalories ?? undefined,
        }),
        mimeType: 'application/vnd.garmin.tcx+xml',
        extension: format,
      };
    case 'kml':
      return { data: serializeToKML(activity, options), mimeType: 'application/vnd.google-earth.kml+xml', extension: format };
    case 'csv':
      return { data: serializeToCSV(activity), mimeType: 'text/csv', extension: format };
    case 'geojson':
      return { data: serializeToGeoJSON(activity, options), mimeType: 'application/geo+json', extension: format };
    default:
      throw new FileConversionError('unsupported-format', `Unsupported output format: ${format}.`);
  }
}
