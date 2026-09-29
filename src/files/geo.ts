import type { LatLon, Trackpoint, ActivitySummary } from './types.js';

/**
 * Earth radius in meters (WGS-84 mean radius)
 */
export const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculate Great-Circle distance between two coordinates using the Haversine formula.
 *
 * @param pt1 Starting coordinate with lat and lon in decimal degrees
 * @param pt2 Ending coordinate with lat and lon in decimal degrees
 * @returns Distance in meters
 */
export function haversineDistance(pt1: LatLon, pt2: LatLon): number {
  if (
    !Number.isFinite(pt1.lat) ||
    !Number.isFinite(pt1.lon) ||
    !Number.isFinite(pt2.lat) ||
    !Number.isFinite(pt2.lon)
  ) {
    return 0;
  }

  const dLat = ((pt2.lat - pt1.lat) * Math.PI) / 180;
  const dLon = ((pt2.lon - pt1.lon) * Math.PI) / 180;

  const lat1Rad = (pt1.lat * Math.PI) / 180;
  const lat2Rad = (pt2.lat * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return EARTH_RADIUS_METERS * c;
}

export interface MovingTimeOptions {
  /** Maximum timestamp delta in seconds before considering the gap an intentional pause/stop. Default 15s. */
  maxGapSeconds?: number;
  /** Minimum movement speed in m/s (approx 0.8 km/h). Speeds below this are considered standstill. Default 0.22 m/s. */
  minSpeedMps?: number;
}

/**
 * Compute total moving time by filtering out standstills, pauses, and prolonged stops.
 *
 * @param points Stream of trackpoints
 * @param options Moving time thresholds
 * @returns Moving duration in seconds
 */
export function calculateMovingTime(points: Trackpoint[], options?: MovingTimeOptions): number {
  if (points.length < 2) return 0;

  const maxGap = options?.maxGapSeconds ?? 15;
  const minSpeed = options?.minSpeedMps ?? 0.22;

  let movingSecs = 0;
  let hasMovementData = false;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    if (!prev.time || !curr.time) continue;

    const diff = (curr.time.getTime() - prev.time.getTime()) / 1000;

    // Reject negative time steps or excessive gaps (treated as paused time)
    if (diff > 0 && diff <= maxGap) {
      let speed = curr.speed;

      // Infer speed if not directly recorded
      if (speed === undefined || speed === null || !Number.isFinite(speed)) {
        if (
          curr.distance !== null &&
          prev.distance !== null &&
          Number.isFinite(curr.distance) &&
          Number.isFinite(prev.distance)
        ) {
          hasMovementData = true;
          speed = (curr.distance - prev.distance) / diff;
        } else if (
          prev.lat !== null &&
          prev.lon !== null &&
          curr.lat !== null &&
          curr.lon !== null
        ) {
          hasMovementData = true;
          const dist = haversineDistance(
            { lat: prev.lat, lon: prev.lon },
            { lat: curr.lat, lon: curr.lon }
          );
          speed = dist / diff;
        }
      } else {
        hasMovementData = true;
      }

      if (speed !== undefined && speed !== null && Number.isFinite(speed) && speed >= minSpeed) {
        movingSecs += diff;
      }
    }
  }

  // Only fallback to total elapsed time if movement data was completely unavailable
  // (e.g. purely time-stamped points without GPS coordinates, recorded distance, or speed).
  // If movement metrics were measured and the runner was standing still, return 0.
  if (movingSecs === 0 && !hasMovementData && points[0].time && points[points.length - 1].time) {
    const elapsed =
      (points[points.length - 1].time!.getTime() - points[0].time!.getTime()) / 1000;
    if (elapsed > 0) return elapsed;
  }

  return movingSecs;
}

export interface ElevationGainOptions {
  /** Window radius for moving average smoothing to eliminate barometric/GPS jitter. Default 5. */
  windowSize?: number;
  /** Minimum vertical change threshold in meters to register gain/loss. Default 0.05m. */
  minDiff?: number;
}

/**
 * Calculate cumulative elevation gain and loss with moving-average noise filtering.
 *
 * @param points Stream of trackpoints
 * @param options Smoothing and threshold parameters
 * @returns { ascent, descent } in meters
 */
export function calculateElevationGain(
  points: Trackpoint[],
  options?: ElevationGainOptions
): { ascent: number; descent: number } {
  const elePoints = points.filter((p) => p.ele !== null && Number.isFinite(p.ele));
  if (elePoints.length < 2) {
    return { ascent: 0, descent: 0 };
  }

  const windowSize = options?.windowSize ?? 5;
  const minDiff = options?.minDiff ?? 0.05;

  // 1. Moving average smoothing
  const smoothed: number[] = [];
  for (let i = 0; i < elePoints.length; i++) {
    const start = Math.max(0, i - windowSize);
    const end = Math.min(elePoints.length - 1, i + windowSize);
    let sum = 0;
    for (let j = start; j <= end; j++) {
      sum += elePoints[j].ele!;
    }
    smoothed.push(sum / (end - start + 1));
  }

  // 2. Accumulate ascent and descent
  let ascent = 0;
  let descent = 0;

  for (let i = 1; i < smoothed.length; i++) {
    const diff = smoothed[i] - smoothed[i - 1];
    if (diff > minDiff) {
      ascent += diff;
    } else if (diff < -minDiff) {
      descent += Math.abs(diff);
    }
  }

  return {
    ascent: Math.round(ascent * 10) / 10,
    descent: Math.round(descent * 10) / 10,
  };
}

export interface DistanceNormalizationOptions {
  /** If true, ignore recorded distance fields and strictly recompute cumulative distance via GPS Haversine. */
  forceGps?: boolean;
}

/**
 * Normalize and compute cumulative distance across all trackpoints.
 * Handles reset distances (e.g. multi-lap merges or device restarts).
 *
 * @param points Stream of trackpoints
 * @param options Distance options
 * @returns Trackpoints with continuous monotonically non-decreasing distance (meters)
 */
export function normalizeTrackDistances(
  points: Trackpoint[],
  options?: DistanceNormalizationOptions
): Trackpoint[] {
  if (points.length === 0) return [];

  const forceGps = options?.forceGps ?? false;
  let cumDist = 0;
  let lastRawDist = 0;
  let distanceOffset = 0;

  return points.map((pt, idx) => {
    const ptDist = pt.distance;

    if (forceGps) {
      if (idx > 0) {
        const prev = points[idx - 1];
        if (
          prev.lat !== null &&
          prev.lon !== null &&
          pt.lat !== null &&
          pt.lon !== null
        ) {
          cumDist += haversineDistance(
            { lat: prev.lat, lon: prev.lon },
            { lat: pt.lat, lon: pt.lon }
          );
        }
      } else {
        cumDist = 0;
      }
    } else {
      if (ptDist !== null && Number.isFinite(ptDist)) {
        // Distance counter reset (e.g. from merged files or laps)
        if (ptDist < lastRawDist) {
          distanceOffset += lastRawDist;
        }
        lastRawDist = ptDist;
        cumDist = ptDist + distanceOffset;
      } else {
        // Fallback to Haversine
        if (idx > 0) {
          const prev = points[idx - 1];
          if (
            prev.lat !== null &&
            prev.lon !== null &&
            pt.lat !== null &&
            pt.lon !== null
          ) {
            cumDist += haversineDistance(
              { lat: prev.lat, lon: prev.lon },
              { lat: pt.lat, lon: pt.lon }
            );
          }
        }
      }
    }

    return {
      ...pt,
      distance: Math.round(cumDist * 100) / 100,
    };
  });
}

export interface CropTrackOptions {
  /** Meters to trim from the start of the activity (e.g. warm-up or accidental start). */
  cropStartMeters?: number;
  /** Meters to trim from the end of the activity (e.g. forgotten stop after finish). */
  cropEndMeters?: number;
}

/**
 * Trim trackpoints from beginning and/or end based on cumulative distance.
 * Automatically rebases distance of trimmed points starting from 0.
 *
 * @param points Stream of normalized trackpoints
 * @param options Crop thresholds in meters
 * @returns Trimmed trackpoint array with distance starting at 0
 */
export function cropTrack(points: Trackpoint[], options: CropTrackOptions): Trackpoint[] {
  if (points.length === 0) return [];

  const cropStart = Math.max(0, options.cropStartMeters ?? 0);
  const cropEnd = Math.max(0, options.cropEndMeters ?? 0);

  if (cropStart === 0 && cropEnd === 0) {
    return [...points];
  }

  const totalDist = points[points.length - 1].distance ?? 0;

  const cropped = points.filter((pt) => {
    const distFromStart = pt.distance ?? 0;
    const distFromEnd = totalDist - distFromStart;
    return distFromStart >= cropStart && distFromEnd >= cropEnd;
  });

  if (cropped.length === 0) return [];

  const baseOffset = cropped[0].distance ?? 0;
  return cropped.map((pt) => ({
    ...pt,
    distance: Math.max(0, Math.round(((pt.distance ?? 0) - baseOffset) * 100) / 100),
  }));
}

/**
 * Strip GPS coordinates from all trackpoints for privacy protection
 * while retaining all physiological metrics (time, distance, hr, cadence, power).
 */
export function stripTrackGPS(points: Trackpoint[]): Trackpoint[] {
  return points.map((pt) => ({
    ...pt,
    lat: null,
    lon: null,
  }));
}

/**
 * Compute an aggregated ActivitySummary from a stream of trackpoints.
 */
export function calculateActivitySummary(
  points: Trackpoint[],
  existingSummary?: Partial<ActivitySummary>
): ActivitySummary {
  const totalDist =
    existingSummary?.distance ??
    (points.length > 0 ? (points[points.length - 1].distance ?? 0) : 0);

  const duration =
    existingSummary?.duration ?? calculateMovingTime(points);

  let totalElapsed = existingSummary?.totalElapsedTime ?? 0;
  if (!totalElapsed && points.length > 1 && points[0].time && points[points.length - 1].time) {
    totalElapsed =
      (points[points.length - 1].time!.getTime() - points[0].time!.getTime()) / 1000;
  }
  if (!totalElapsed) totalElapsed = duration;

  const distKm = totalDist / 1000;
  const avgPaceSecs = distKm > 0 && duration > 0 ? duration / distKm : 0;

  // Heart rate
  const hrPoints = points.filter((p) => p.hr !== null && Number.isFinite(p.hr) && p.hr! > 0);
  const avgHr =
    existingSummary?.avgHeartRate ??
    (hrPoints.length > 0
      ? Math.round(hrPoints.reduce((acc, p) => acc + p.hr!, 0) / hrPoints.length)
      : null);
  const maxHr =
    existingSummary?.maxHeartRate ??
    (hrPoints.length > 0 ? Math.max(...hrPoints.map((p) => p.hr!)) : null);

  // Cadence
  const cadPoints = points.filter((p) => p.cad !== null && Number.isFinite(p.cad) && p.cad! > 0);
  let avgCad = existingSummary?.avgCadence ?? null;
  if (avgCad === null && cadPoints.length > 0) {
    let meanCad = cadPoints.reduce((acc, p) => acc + p.cad!, 0) / cadPoints.length;
    // Normalize single-leg cadence (< 120) to full SPM
    if (meanCad < 120) meanCad *= 2;
    avgCad = Math.round(meanCad);
  }
  const maxCad =
    existingSummary?.maxCadence ??
    (cadPoints.length > 0
      ? Math.max(...cadPoints.map((p) => (p.cad! < 120 ? p.cad! * 2 : p.cad!)))
      : null);

  // Elevation
  const { ascent, descent } = calculateElevationGain(points);
  const totalAscent = existingSummary?.totalAscent ?? ascent;
  const totalDescent = existingSummary?.totalDescent ?? descent;

  // Power
  const pwrPoints = points.filter((p) => p.power !== null && Number.isFinite(p.power));
  const avgPwr =
    existingSummary?.avgPower ??
    (pwrPoints.length > 0
      ? Math.round(pwrPoints.reduce((acc, p) => acc + p.power!, 0) / pwrPoints.length)
      : null);
  const maxPwr =
    existingSummary?.maxPower ??
    (pwrPoints.length > 0 ? Math.max(...pwrPoints.map((p) => p.power!)) : null);

  return {
    distance: Math.round(totalDist * 100) / 100,
    duration: Math.round(duration),
    totalElapsedTime: Math.round(totalElapsed),
    avgPaceSecs: Math.round(avgPaceSecs * 10) / 10,
    avgHeartRate: avgHr,
    maxHeartRate: maxHr,
    avgCadence: avgCad,
    maxCadence: maxCad,
    totalAscent,
    totalDescent,
    avgPower: avgPwr,
    maxPower: maxPwr,
    sport: existingSummary?.sport ?? 'running',
    subSport: existingSummary?.subSport ?? null,
  };
}
