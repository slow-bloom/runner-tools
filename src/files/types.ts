/**
 * Data structures and types for running track file parsing, transformation, and serialization.
 * Compatible with FIT, GPX 1.1, Garmin TCX 2.0, Google Earth KML, and GeoJSON.
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
  /**
   * Running cadence in steps/minute; cycling cadence in revolutions/minute. Null if unavailable.
   * Mark low canonical values with cadenceUnit or sport to bypass legacy single-leg heuristics.
   */
  cad: number | null;
  /** Explicit cadence units. When present, do not apply legacy single-leg/magnitude heuristics. */
  cadenceUnit?: 'steps/min' | 'cycles/min';
  /** Cumulative distance from the start of the activity in meters. */
  distance: number | null;
  /** Original file-provided distance before GPS fallback; null when the source has no value. */
  recordedDistance?: number | null;
  /** Instantaneous speed in meters per second (m/s). Null if unavailable. */
  speed?: number | null;
  /** Instantaneous power in watts. Null if unavailable. */
  power?: number | null;
  /** Step length in millimeters (mm). Null if unavailable. */
  stepLength?: number | null;
  /** Vertical oscillation in millimeters (mm). Null if unavailable. */
  verticalOscillation?: number | null;
  /** Ground contact stance time in milliseconds (ms). Null if unavailable. */
  stanceTime?: number | null;
  /** Ambient or sensor temperature in degrees Celsius (°C). Null if unavailable. */
  temp?: number | null;
  /** Vertical oscillation as a percentage of step length. */
  verticalRatio?: number | null;
  /** Ground contact time balance in percent. */
  stanceTimeBalance?: number | null;
  /** Ground contact time as a percentage of the stride cycle. */
  stanceTimePercent?: number | null;
  /** Per-record sport. FIT parsing always sets this, including single-sport activities. */
  sport?: string;
  /** Source FIT fields. Remove when stripping GPS: opaque fields can contain location data. */
  fit?: FITRecordMetadata;
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
  /** Average running steps/minute or cycling revolutions/minute. Null if unavailable or mixed units. */
  avgCadence: number | null;
  /** Maximum running steps/minute or cycling revolutions/minute. Null if unavailable or mixed units. */
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
  /** Recorded energy expenditure in kilocalories; absent if unmeasured. */
  totalCalories?: number | null;
  /** Cycles/strides, not steps (one running stride is two steps); fractional cycles are supported. */
  totalCycles?: number | null;
  /** Average speed in meters per second. */
  avgSpeed?: number | null;
  /** Maximum speed in meters per second. */
  maxSpeed?: number | null;
  /** Average step length in millimeters. */
  avgStepLength?: number | null;
  /** Average vertical oscillation in millimeters. */
  avgVerticalOscillation?: number | null;
  /** Average ground contact time in milliseconds. */
  avgStanceTime?: number | null;
  /** Average ground contact time as a percentage of the stride cycle. */
  avgStanceTimePercent?: number | null;
  /** Average ground contact time balance in percent. */
  avgStanceTimeBalance?: number | null;
  /** Average vertical oscillation as a percentage of step length. */
  avgVerticalRatio?: number | null;
  /** Normalized power in watts. */
  normalizedPower?: number | null;
  /** Recorded temperature statistics in degrees Celsius. */
  avgTemperature?: number | null;
  maxTemperature?: number | null;
  minTemperature?: number | null;
  /** Recorded moving time in seconds, when distinct from timer time. */
  totalMovingTime?: number | null;
}

export interface RecordedLap {
  startTime: Date | null;
  endTime: Date | null;
  distance: number | null;
  /** A last sample is not proof of the lap's actual end (for example, in TCX). */
  endTimeBasis: 'recorded' | 'last-sample';
}

export interface Activity {
  /** Activity title or recorded name. */
  name: string;
  /** Chronological stream of track points. */
  points: Trackpoint[];
  /** Computed or recorded summary statistics. */
  summary: ActivitySummary;
  /** Original header totals, distinct from derived summary values. Null when unrecorded. */
  recordedDistance?: number | null;
  recordedDuration?: number | null;
  /** Original lap records, not kilometer splits reconstructed from point counters. */
  recordedLaps?: RecordedLap[];
  /** Source FIT metadata. Opaque fields may contain location, device IDs, or stale aggregates. */
  fit?: FITMetadata;
}

/** Native values are unscaled. Developer numbers use their descriptor; bigint values remain exact raw integers. */
export type FITValue = number | bigint | string | null | Array<number | bigint | null>;

export interface FITField {
  number: number;
  /** FIT base-type byte, including its endian-awareness bit. */
  baseType: number;
  /** Owned copy of the original bytes; authoritative for opaque-field re-encoding. */
  data: Uint8Array;
  value: FITValue;
}

export interface FITDeveloperField {
  number: number;
  developerDataIndex: number;
  /** Owned bytes in the containing message's byte order; never inferred from the field name. */
  data: Uint8Array;
  /** Available when a field_description message describes this developer field. */
  baseType?: number;
  name?: string;
  units?: string;
  value?: FITValue;
  /** Explicit native-field equivalence from the field_description, never guessed from a name. */
  nativeMessageNumber?: number;
  nativeFieldNumber?: number;
}

export interface FITRecordMetadata {
  littleEndian: boolean;
  fields: FITField[];
  developerFields: FITDeveloperField[];
}

export interface FITMessage extends FITRecordMetadata {
  globalMessageNumber: number;
  /** Number of record messages preceding this message in the source stream. */
  recordIndex: number;
  /** Decoded native summary values for session/lap messages; raw fields remain available. */
  summary?: Partial<ActivitySummary>;
}

export interface FITMetadata {
  protocolVersion: number;
  profileVersion: number;
  /** Source record count and independent summary snapshot, used to detect edited scopes. */
  recordCount?: number;
  sourceSummary?: ActivitySummary;
  /**
   * Non-record messages, including developer_data_id (207), field_description (206),
   * sessions (18), laps (19), and unknown messages. Keep developer descriptors whenever
   * retaining point.fit. Discard source summary messages after editing their scope.
   */
  messages: FITMessage[];
}

export interface FITExportOptions {
  /** Sport-profile name in FIT output; defaults to the activity name. */
  name?: string;
  /** File creator's product name; defaults to "ApexRun". */
  creator?: string;
  /** Omit all lap messages. Session and activity messages are still written. */
  stripLaps?: boolean;
  /**
   * Fallback activity start when no usable recorded clock exists.
   * Does not retime existing points or an unchanged FIT session, and never assigns
   * fabricated timestamps to records with missing times.
   */
  startTime?: Date;
  locale?: LocaleInput;
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
  /** Optional recorded total calories in kcal. Defaults to 0 (unknown/unmeasured). */
  calories?: number;
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
