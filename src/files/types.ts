/**
 * Data structures and types for running track file parsing, transformation, and serialization.
 * Compatible with GPX 1.1, Garmin TCX 2.0, Google Earth KML, and GeoJSON.
 */

import type { LocaleInput } from '../i18n/index.js';

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Trackpoint {
  /** Latitude in decimal degrees (-90 to +90). Null if coordinates stripped for privacy. */
  lat: number | null;
  /** Longitude in decimal degrees (-180 to +180). Null if coordinates stripped for privacy. */
  lon: number | null;
  /** Elevation / Altitude in meters. Null if unavailable. */
  ele: number | null;
  /** Point recording timestamp. Null if unavailable. */
  time: Date | null;
  /** Heart rate in beats per minute (bpm). Null if unavailable. */
  hr: number | null;
  /** Cadence in steps per minute (spm / rpm). Null if unavailable. */
  cad: number | null;
  /** Cumulative distance from the start of the activity in meters. */
  distance: number | null;
  /** Instantaneous speed in meters per second (m/s). Null if unavailable. */
  speed?: number | null;
  /** Instantaneous power in watts. Null if unavailable. */
  power?: number | null;
  /** Step length in millimeters (mm). Null if unavailable. */
  stepLength?: number | null;
  /** Vertical oscillation in millimeters (mm) or centimeters. Null if unavailable. */
  verticalOscillation?: number | null;
  /** Ground contact stance time in milliseconds (ms). Null if unavailable. */
  stanceTime?: number | null;
  /** Ambient or sensor temperature in degrees Celsius (°C). Null if unavailable. */
  temp?: number | null;
}

export interface ActivitySummary {
  /** Total cumulative distance in meters. */
  distance: number;
  /** Moving duration in seconds (pauses and standstills excluded). */
  duration: number;
  /** Total elapsed clock duration in seconds from first to last point. */
  totalElapsedTime: number;
  /** Average running pace in seconds per kilometer (sec/km). */
  avgPaceSecs: number;
  /** Average heart rate in bpm. Null if no heart rate data recorded. */
  avgHeartRate: number | null;
  /** Maximum heart rate in bpm. Null if no heart rate data recorded. */
  maxHeartRate: number | null;
  /** Average cadence in steps per minute (spm). Null if no cadence recorded. */
  avgCadence: number | null;
  /** Maximum cadence in steps per minute (spm). Null if no cadence recorded. */
  maxCadence: number | null;
  /** Total elevation gain (ascent) in meters. */
  totalAscent: number | null;
  /** Total elevation loss (descent) in meters. */
  totalDescent: number | null;
  /** Average running power in watts. Null if no power data. */
  avgPower: number | null;
  /** Maximum running power in watts. Null if no power data. */
  maxPower: number | null;
  /** Primary sport classification (e.g., "running", "cycling", "walking"). */
  sport: string;
  /** Secondary sport classification if specified. */
  subSport?: string | null;
}

export interface Activity {
  /** Activity title or recorded name. */
  name: string;
  /** Chronological stream of track points. */
  points: Trackpoint[];
  /** Computed or recorded summary statistics. */
  summary: ActivitySummary;
}

export interface ParseTrackOptions {
  /** Optional language or custom dictionary override for generated activity titles. */
  locale?: LocaleInput;
}

export interface GPXExportOptions {
  /** Name of the activity track in GPX output. Defaults to activity name or localized default. */
  name?: string;
  /** Creator attribute in <gpx creator="...">. Defaults to "ApexRun". */
  creator?: string;
  /** Include Garmin TrackPointExtension (gpxtpx) for HR and Cadence. Defaults to true. */
  includeExtensions?: boolean;
  /** Optional language or custom dictionary override. */
  locale?: LocaleInput;
}

export interface TCXExportOptions {
  /** Name of the activity track in TCX output. Defaults to activity name or localized default. */
  name?: string;
  /** Creator name in TCX output. Defaults to "ApexRun". */
  creator?: string;
  /** Sport category in <Activity Sport="...">. Defaults to "Running". */
  sport?: string;
  /** Optional language or custom dictionary override. */
  locale?: LocaleInput;
}

export interface KMLExportOptions {
  /** Document and track name in KML output. */
  name?: string;
  /** Hex color for track line styling (AABBGGRR format in KML). Defaults to "ff045de8". */
  lineColor?: string;
  /** Track line stroke width in pixels. Defaults to 4. */
  lineWidth?: number;
  /** Optional language or custom dictionary override. */
  locale?: LocaleInput;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: {
      type: 'LineString';
      coordinates: Array<[number, number] | [number, number, number]>;
    };
    properties: {
      name: string;
      timestamps?: Array<string | null>;
      heartrates?: Array<number | null>;
      cadences?: Array<number | null>;
      elevations?: Array<number | null>;
      distances?: Array<number | null>;
      [key: string]: unknown;
    };
  }>;
}

export interface GeoJSONExportOptions {
  /** Feature name in GeoJSON properties. */
  name?: string;
  /** Include elevation coordinate as 3rd coordinate tuple [lon, lat, ele]. Defaults to true. */
  includeElevationInCoordinates?: boolean;
  /** Optional language or custom dictionary override. */
  locale?: LocaleInput;
}

