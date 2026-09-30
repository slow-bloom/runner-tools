import type { Activity, Trackpoint } from './types.js';
import { calculateElevationGain, haversineDistance, normalizeTrackDistances } from './geo.js';
import { FileConversionError } from './converter.js';

export interface AnalysisPoint {
  lat: number;
  lon: number;
  ele: number | null;
  time: Date | null;
  /** Cumulative two-dimensional GPS distance, meters. */
  distance: number;
  /** Recorded distance rebased at the first sample, or an explicitly estimated allocation. */
  normWatchDist: number | null;
  movingTime: number;
  segment: number;
}

export interface TrackSplit {
  kilometer: number;
  finish: boolean;
  gpsMeters: number;
  recordedMeters: number | null;
  deltaMeters: number | null;
  cumulativeDeltaMeters: number | null;
}

export interface DriftSegment {
  from: AnalysisPoint;
  to: AnalysisPoint;
  /** Recorded/GPS distance ratio, null without a measured local reference. */
  ratio: number | null;
  level: 'unknown' | 'agreement' | 'moderate' | 'large';
  possibleStationaryDrift: boolean;
  possibleSpeedSpike: boolean;
}

export interface AnalyzedTrack {
  name: string;
  points: AnalysisPoint[];
  totalDist: number;
  rawGpsDist: number;
  movingTime: number | null;
  elapsedTime: number | null;
  avgInterval: number | null;
  eleGain: number | null;
  distanceBasis: 'recorded-points' | 'summary-proportional' | 'gps-only';
  deltaMeters: number | null;
  deltaPercent: number | null;
  splits: TrackSplit[];
  segments: DriftSegment[];
  possibleStationaryDriftMeters: number;
  speedSpikeCount: number;
  diagnostics: {
    distance: 'no-reference' | 'close' | 'different';
    sampling: 'unknown' | 'dense' | 'sparse';
    pause: 'unknown' | 'short' | 'long';
    pauseSeconds: number | null;
    elevation: 'unknown' | 'low' | 'high';
  };
}

export interface TrackAnalysisOptions {
  /** Gaps larger than this are excluded from the moving-time estimate. Default 15 seconds. */
  maxMovingGapSeconds?: number;
  /** Implausible running GPS speed indicator, not a measurement of accuracy. Default 12 m/s. */
  speedSpikeMps?: number;
}

function coordinates(point: Trackpoint): point is Trackpoint & { lat: number; lon: number } {
  return point.lat !== null && point.lon !== null &&
    Number.isFinite(point.lat) && Number.isFinite(point.lon) &&
    Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180;
}

function timeValue(time: Date | null): number | null {
  return time instanceof Date && Number.isFinite(time.getTime()) ? time.getTime() : null;
}

function finite(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

function interpolate(a: AnalysisPoint, b: AnalysisPoint, fraction: number): AnalysisPoint | null {
  if (fraction <= 0) return { ...a };
  if (fraction >= 1) return { ...b };
  if (a.segment !== b.segment) return null;
  const blend = (first: number, last: number) => first + (last - first) * fraction;
  const aTime = timeValue(a.time);
  const bTime = timeValue(b.time);
  const longitudeDelta = ((b.lon - a.lon + 540) % 360) - 180;
  return {
    lat: blend(a.lat, b.lat),
    lon: ((a.lon + longitudeDelta * fraction + 540) % 360) - 180,
    ele: finite(a.ele) && finite(b.ele) ? blend(a.ele, b.ele) : null,
    time: aTime !== null && bTime !== null ? new Date(blend(aTime, bTime)) : null,
    distance: blend(a.distance, b.distance),
    normWatchDist: finite(a.normWatchDist) && finite(b.normWatchDist)
      ? blend(a.normWatchDist, b.normWatchDist) : null,
    movingTime: blend(a.movingTime, b.movingTime),
    segment: a.segment,
  };
}

/** Interpolate at a precise GPS distance rather than snapping to a later device sample. */
export function sampleTrackDistance(track: AnalyzedTrack, meters: number): AnalysisPoint | null {
  if (!Number.isFinite(meters) || meters < 0 || meters > track.rawGpsDist || !track.points.length) return null;
  const points = track.points;
  let low = 0;
  let high = points.length - 1;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (points[middle].distance < meters) low = middle + 1;
    else high = middle;
  }
  const after = points[low];
  const before = points[Math.max(0, low - 1)];
  const span = after.distance - before.distance;
  return interpolate(before, after, span > 0 ? (meters - before.distance) / span : 1);
}

export function sampleTrackProgress(track: AnalyzedTrack, fraction: number): AnalysisPoint | null {
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) return null;
  return sampleTrackDistance(track, track.rawGpsDist * fraction);
}

function timedSampler(track: AnalyzedTrack, maxGapSeconds: number) {
  const points = track.points.filter((point) => timeValue(point.time) !== null);
  return {
    start: points.length ? timeValue(points[0].time) : null,
    end: points.length ? timeValue(points[points.length - 1].time) : null,
    at(timestamp: number): AnalysisPoint | null {
      if (!points.length || timestamp < points[0].time!.getTime() ||
        timestamp > points[points.length - 1].time!.getTime()) return null;
      let low = 0;
      let high = points.length - 1;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (points[middle].time!.getTime() < timestamp) low = middle + 1;
        else high = middle;
      }
      const after = points[low];
      if (after.time!.getTime() === timestamp) return { ...after };
      const before = points[Math.max(0, low - 1)];
      const span = after.time!.getTime() - before.time!.getTime();
      if (span <= 0 || span > maxGapSeconds * 1000) return null;
      return interpolate(before, after, (timestamp - before.time!.getTime()) / span);
    },
  };
}

/** Analyze recorded-vs-GPS differences without identifying either one as ground truth. */
export function analyzeTrack(activity: Activity, options: TrackAnalysisOptions = {}): AnalyzedTrack {
  const maxGap = options.maxMovingGapSeconds ?? 15;
  const spikeSpeed = options.speedSpikeMps ?? 12;
  if (![maxGap, spikeSpeed].every((value) => Number.isFinite(value) && value > 0)) {
    throw new FileConversionError('invalid-options', 'Analysis thresholds must be positive finite numbers.');
  }
  let anchor = -Infinity;
  const ordered = activity.points.map((point, index) => {
    anchor = timeValue(point.time) ?? anchor;
    return { point, index, anchor };
  }).sort((a, b) => a.anchor - b.anchor || a.index - b.index).map(({ point }) => point);
  if (ordered.filter(coordinates).length < 2) {
    throw new FileConversionError('coordinates-required', 'Track analysis needs at least two valid GPS points.');
  }
  const rawDistances = ordered.map((point) => point.recordedDistance !== undefined
    ? point.recordedDistance : point.distance);
  const normalizedRecorded = normalizeTrackDistances(ordered.map((point, index) => ({
    ...point, distance: rawDistances[index], lat: null, lon: null,
  })));
  const firstRecord = normalizedRecorded.find((point, index) => finite(rawDistances[index]));
  const recordBase = firstRecord?.distance ?? 0;
  const recordedCount = rawDistances.filter(finite).length;
  const headerDistance = activity.recordedDistance !== undefined ? activity.recordedDistance : activity.summary.distance;
  const headerDuration = activity.recordedDuration !== undefined ? activity.recordedDuration : activity.summary.duration;
  let distance = 0;
  let moving = 0;
  let intervalSum = 0;
  let intervals = 0;
  let segment = 0;
  const points: AnalysisPoint[] = [];
  const segments: DriftSegment[] = [];
  let possibleStationaryDriftMeters = 0;
  let speedSpikeCount = 0;
  for (let index = 0; index < ordered.length; index++) {
    const point = ordered[index];
    if (!coordinates(point)) { segment++; continue; }
    const previous = index > 0 ? ordered[index - 1] : undefined;
    let deltaDistance = 0;
    let deltaTime: number | null = null;
    if (previous && coordinates(previous)) {
      deltaDistance = haversineDistance(previous, point);
      distance += deltaDistance;
      const before = timeValue(previous.time);
      const after = timeValue(point.time);
      if (before !== null && after !== null && after > before) {
        deltaTime = (after - before) / 1000;
        if (deltaTime < 60) { intervalSum += deltaTime; intervals++; }
        const speed = finite(point.speed) ? point.speed : deltaDistance / deltaTime;
        if (deltaTime <= maxGap && speed >= 0.22) moving += deltaTime;
      }
    }
    const analysisPoint: AnalysisPoint = {
      lat: point.lat, lon: point.lon, ele: finite(point.ele) ? point.ele : null,
      time: timeValue(point.time) !== null ? new Date(point.time!) : null,
      distance, movingTime: moving, segment,
      normWatchDist: finite(rawDistances[index]) && recordedCount >= 2
        ? Math.max(0, (normalizedRecorded[index].distance ?? recordBase) - recordBase) : null,
    };
    const before = points[points.length - 1];
    points.push(analysisPoint);
    if (!before || before.segment !== segment) continue;
    const windowStart = points[Math.max(0, points.length - 16)];
    const gpsWindow = distance - windowStart.distance;
    const ratio = windowStart.segment === segment && gpsWindow > 2 &&
      finite(analysisPoint.normWatchDist) && finite(windowStart.normWatchDist)
      ? (analysisPoint.normWatchDist - windowStart.normWatchDist) / gpsWindow : null;
    const stationary = deltaTime !== null && deltaTime <= maxGap &&
      finite(point.speed) && point.speed < 0.22 && deltaDistance > 0.5;
    const spike = deltaTime !== null && deltaTime <= maxGap && deltaDistance / deltaTime > spikeSpeed;
    if (stationary) possibleStationaryDriftMeters += deltaDistance;
    if (spike) speedSpikeCount++;
    segments.push({
      from: before, to: analysisPoint, ratio,
      level: ratio === null ? 'unknown' : ratio > 1.018 || ratio < 0.98 ? 'large'
        : ratio >= 1.008 ? 'moderate' : 'agreement',
      possibleStationaryDrift: stationary,
      possibleSpeedSpike: spike,
    });
  }
  const measured = points.filter((point) => point.normWatchDist !== null);
  const recordSpan = measured.length >= 2 ? measured[measured.length - 1].normWatchDist : null;
  const totalDist = finite(headerDistance) && headerDistance >= 0 ? headerDistance : recordSpan ?? distance;
  const distanceBasis = recordedCount >= 2 ? 'recorded-points'
    : finite(headerDistance) ? 'summary-proportional' : 'gps-only';
  if (distanceBasis === 'summary-proportional' && distance > 0) {
    for (const point of points) point.normWatchDist = point.distance / distance * totalDist;
  }
  const times = points.map((point) => timeValue(point.time)).filter((value): value is number => value !== null);
  const elapsedTime = times.length >= 2 ? (times[times.length - 1] - times[0]) / 1000 : null;
  const track: AnalyzedTrack = {
    name: activity.name, points, totalDist, rawGpsDist: distance,
    movingTime: finite(headerDuration) && headerDuration >= 0 ? headerDuration : times.length >= 2 ? moving : null,
    elapsedTime, avgInterval: intervals ? intervalSum / intervals : null,
    eleGain: ordered.filter((point) => finite(point.ele)).length >= 2 ? calculateElevationGain(ordered).ascent : null,
    distanceBasis,
    deltaMeters: distanceBasis !== 'gps-only' ? totalDist - distance : null,
    deltaPercent: distanceBasis !== 'gps-only' && distance > 0 ? (totalDist - distance) / distance * 100 : null,
    splits: [], segments, possibleStationaryDriftMeters, speedSpikeCount,
    diagnostics: {
      distance: distanceBasis === 'gps-only' ? 'no-reference' : Math.abs(totalDist - distance) > 50 ? 'different' : 'close',
      sampling: intervals === 0 ? 'unknown' : intervalSum / intervals > 2.5 ? 'sparse' : 'dense',
      pause: 'unknown', pauseSeconds: null, elevation: 'unknown',
    },
  };
  if (track.elapsedTime !== null && track.movingTime !== null) {
    track.diagnostics.pauseSeconds = Math.max(0, track.elapsedTime - track.movingTime);
    track.diagnostics.pause = track.diagnostics.pauseSeconds > 60 ? 'long' : 'short';
  }
  if (track.eleGain !== null) track.diagnostics.elevation = track.eleGain > 100 ? 'high' : 'low';
  const splitCount = Math.ceil(distance / 1000);
  if (splitCount > 100000) throw new FileConversionError('invalid-file', 'Track distance exceeds the analysis limit.');
  let previous = sampleTrackDistance(track, 0);
  for (let kilometer = 1; kilometer <= splitCount; kilometer++) {
    const current = sampleTrackDistance(track, Math.min(kilometer * 1000, distance));
    const gpsMeters = Math.min(kilometer * 1000, distance) - (kilometer - 1) * 1000;
    const recordedMeters = current && previous && finite(current.normWatchDist) && finite(previous.normWatchDist)
      ? current.normWatchDist - previous.normWatchDist : null;
    track.splits.push({
      kilometer, finish: kilometer === splitCount, gpsMeters, recordedMeters,
      deltaMeters: recordedMeters !== null ? recordedMeters - gpsMeters : null,
      cumulativeDeltaMeters: current && finite(current.normWatchDist) ? current.normWatchDist - current.distance : null,
    });
    previous = current;
  }
  return track;
}

export interface TrackComparisonOptions {
  /** Auto uses overlapping timestamps, otherwise explicitly reports progress alignment. */
  alignment?: 'auto' | 'time' | 'progress';
  sampleCount?: number;
  maxInterpolationGapSeconds?: number;
}

export interface ComparisonSample {
  fraction: number;
  time: Date | null;
  pointA: AnalysisPoint | null;
  pointB: AnalysisPoint | null;
  gapMeters: number | null;
}

export interface ComparisonSplit {
  kilometer: number;
  finish: boolean;
  metersA: number;
  metersB: number | null;
  deltaMeters: number | null;
  cumulativeDeltaMeters: number | null;
}

export interface TrackComparison {
  alignment: 'time' | 'progress';
  alignmentReason: 'overlapping-time' | 'requested-progress' | 'no-time-overlap';
  samples: ComparisonSample[];
  maxSpatialGap: number | null;
  meanSpatialGap: number | null;
  matchedSamples: number;
  splits: ComparisonSplit[];
  deltas: {
    distance: number;
    distancePercent: number | null;
    rawDistance: number;
    movingTime: number | null;
    paceSecondsPerKm: number | null;
    elevation: number | null;
  };
  diagnostics: {
    distance: 'no-reference' | 'close' | 'different';
    sampling: 'unknown' | 'similar' | 'different';
    pause: 'unknown' | 'similar' | 'different';
    spatial: 'unknown' | 'close' | 'different';
  };
}

/** Compare samples on a shared clock, or on clearly labelled relative route progress. */
export function compareTracks(a: AnalyzedTrack, b: AnalyzedTrack, options: TrackComparisonOptions = {}): TrackComparison {
  const sampleCount = options.sampleCount ?? 1001;
  const maxGap = options.maxInterpolationGapSeconds ?? 60;
  if (!Number.isInteger(sampleCount) || sampleCount < 2 || sampleCount > 10001 ||
    !Number.isFinite(maxGap) || maxGap <= 0 ||
    !['auto', 'time', 'progress'].includes(options.alignment ?? 'auto')) {
    throw new FileConversionError('invalid-options', 'Invalid track alignment or resampling options.');
  }
  const clockA = timedSampler(a, maxGap);
  const clockB = timedSampler(b, maxGap);
  const start = clockA.start !== null && clockB.start !== null ? Math.max(clockA.start, clockB.start) : null;
  const end = clockA.end !== null && clockB.end !== null ? Math.min(clockA.end, clockB.end) : null;
  const overlap = start !== null && end !== null && end > start;
  if (options.alignment === 'time' && !overlap) {
    throw new FileConversionError('timestamps-required', 'Time alignment needs overlapping timestamp ranges.');
  }
  const alignment = options.alignment !== 'progress' && overlap ? 'time' : 'progress';
  const samples: ComparisonSample[] = [];
  let maxSpatialGap: number | null = null;
  let totalGap = 0;
  let matchedSamples = 0;
  for (let index = 0; index < sampleCount; index++) {
    const fraction = index / (sampleCount - 1);
    const timestamp = alignment === 'time' ? start! + (end! - start!) * fraction : null;
    const pointA = timestamp === null ? sampleTrackProgress(a, fraction) : clockA.at(timestamp);
    const pointB = timestamp === null ? sampleTrackProgress(b, fraction) : clockB.at(timestamp);
    const gapMeters = pointA && pointB ? haversineDistance(pointA, pointB) : null;
    samples.push({ fraction, time: timestamp === null ? null : new Date(timestamp), pointA, pointB, gapMeters });
    if (gapMeters !== null) {
      maxSpatialGap = Math.max(maxSpatialGap ?? 0, gapMeters);
      totalGap += gapMeters;
      matchedSamples++;
    }
  }
  const counterpart = (point: AnalysisPoint | null): AnalysisPoint | null => {
    if (!point) return null;
    return alignment === 'time' ? point.time ? clockB.at(point.time.getTime()) : null
      : sampleTrackProgress(b, a.rawGpsDist > 0 ? point.distance / a.rawGpsDist : 0);
  };
  const initialA = sampleTrackDistance(a, 0);
  const initialB = counterpart(initialA);
  let previousB = initialB;
  const splits = a.splits.map((split) => {
    const pointA = sampleTrackDistance(a, Math.min(split.kilometer * 1000, a.rawGpsDist));
    const pointB = counterpart(pointA);
    const metersB = pointB && previousB ? pointB.distance - previousB.distance : null;
    const result: ComparisonSplit = {
      kilometer: split.kilometer, finish: split.finish, metersA: split.gpsMeters, metersB,
      deltaMeters: metersB === null ? null : metersB - split.gpsMeters,
      cumulativeDeltaMeters: pointA && pointB && initialA && initialB
        ? (pointB.distance - initialB.distance) - (pointA.distance - initialA.distance) : null,
    };
    previousB = pointB;
    return result;
  });
  return {
    alignment,
    alignmentReason: alignment === 'time' ? 'overlapping-time'
      : options.alignment === 'progress' ? 'requested-progress' : 'no-time-overlap',
    samples, splits, maxSpatialGap, meanSpatialGap: matchedSamples ? totalGap / matchedSamples : null, matchedSamples,
    deltas: {
      distance: b.totalDist - a.totalDist,
      distancePercent: a.totalDist > 0 ? (b.totalDist - a.totalDist) / a.totalDist * 100 : null,
      rawDistance: b.rawGpsDist - a.rawGpsDist,
      movingTime: a.movingTime !== null && b.movingTime !== null ? b.movingTime - a.movingTime : null,
      paceSecondsPerKm: a.movingTime !== null && b.movingTime !== null && a.totalDist > 0 && b.totalDist > 0
        ? b.movingTime / (b.totalDist / 1000) - a.movingTime / (a.totalDist / 1000) : null,
      elevation: a.eleGain !== null && b.eleGain !== null ? b.eleGain - a.eleGain : null,
    },
    diagnostics: {
      distance: a.deltaMeters === null && b.deltaMeters === null ? 'no-reference'
        : Math.abs(a.deltaMeters ?? 0) > 50 || Math.abs(b.deltaMeters ?? 0) > 50 ? 'different' : 'close',
      sampling: a.avgInterval === null || b.avgInterval === null ? 'unknown'
        : a.avgInterval / b.avgInterval > 2 || a.avgInterval / b.avgInterval < 0.5 ? 'different' : 'similar',
      pause: a.diagnostics.pauseSeconds === null || b.diagnostics.pauseSeconds === null ? 'unknown'
        : Math.abs(a.diagnostics.pauseSeconds - b.diagnostics.pauseSeconds) > 30 ? 'different' : 'similar',
      spatial: maxSpatialGap === null ? 'unknown' : maxSpatialGap > 25 ? 'different' : 'close',
    },
  };
}
