import { describe, expect, it } from 'vitest';
import { analyzeTrack, compareTracks, sampleTrackDistance, sampleTrackProgress } from './analysis.js';
import { calculateActivitySummary, EARTH_RADIUS_METERS } from './geo.js';
import { parseActivityFile } from './converter.js';
import { handleFileWorkerRequest } from './worker-protocol.js';
import type { Activity, Trackpoint } from './types.js';

function route(step = 10, options: { timeOffset?: number; lat?: number; recordedScale?: number } = {}): Activity {
  const points: Trackpoint[] = [];
  for (let second = 0; second <= 600; second += step) {
    const distance = second * 3;
    points.push({
      lat: options.lat ?? 0,
      lon: distance / EARTH_RADIUS_METERS * 180 / Math.PI,
      ele: distance / 100,
      time: new Date(Date.UTC(2026, 8, 29, 0, 0, second + (options.timeOffset ?? 0))),
      hr: 140, cad: 170, speed: 3,
      distance: distance * (options.recordedScale ?? 1),
      recordedDistance: distance * (options.recordedScale ?? 1),
    });
  }
  return {
    name: 'Run', points, summary: calculateActivitySummary(points),
    recordedDistance: 1800 * (options.recordedScale ?? 1), recordedDuration: 600,
  };
}

describe('shared GPS analysis', () => {
  it('preserves recorded totals separately from raw GPS and interpolates exact splits', () => {
    const input = route(10, { recordedScale: 1.02 });
    const before = structuredClone(input);
    const result = analyzeTrack(input);
    expect(result.rawGpsDist).toBeCloseTo(1800, 5);
    expect(result.totalDist).toBe(1836);
    expect(result.deltaMeters).toBeCloseTo(36, 5);
    expect(result.avgInterval).toBe(10);
    expect(result.distanceBasis).toBe('recorded-points');
    expect(result.splits).toHaveLength(2);
    expect(result.splits[0].gpsMeters).toBeCloseTo(1000, 5);
    expect(result.splits[0].recordedMeters).toBeCloseTo(1020, 5);
    expect(result.splits[1].recordedMeters).toBeCloseTo(816, 5);
    expect(result.splits[1].finish).toBe(true);
    expect(sampleTrackDistance(result, 1000)?.time?.getTime()).toBeCloseTo(Date.UTC(2026, 8, 29) + 1000 / 3 * 1000, -1);
    expect(input).toEqual(before);
  });

  it('resamples different device rates on common timestamps, not sample indexes', () => {
    const comparison = compareTracks(analyzeTrack(route(1)), analyzeTrack(route(10)));
    expect(comparison.alignment).toBe('time');
    expect(comparison.samples).toHaveLength(1001);
    expect(comparison.matchedSamples).toBe(1001);
    expect(comparison.maxSpatialGap).toBeCloseTo(0, 5);
    expect(comparison.splits[0].deltaMeters).toBeCloseTo(0, 2);
    expect(comparison.diagnostics.sampling).toBe('different');
  });

  it('reports real same-time offset without mistaking delayed starts for identical GPS tracks', () => {
    const a = analyzeTrack(route(10));
    const b = analyzeTrack(route(10, { timeOffset: 30 }));
    const aligned = compareTracks(a, b);
    expect(aligned.maxSpatialGap).toBeCloseTo(90, 4);
    expect(aligned.samples[0].time).toEqual(new Date(Date.UTC(2026, 8, 29, 0, 0, 30)));
    const progress = compareTracks(a, b, { alignment: 'progress', sampleCount: 21 });
    expect(progress.maxSpatialGap).toBeCloseTo(0, 5);
    expect(progress.alignmentReason).toBe('requested-progress');
  });

  it('explicitly reports non-overlapping progress comparisons and rejects forced time alignment', () => {
    const a = analyzeTrack(route());
    const b = analyzeTrack(route(10, { timeOffset: 86400 }));
    expect(compareTracks(a, b).alignmentReason).toBe('no-time-overlap');
    expect(() => compareTracks(a, b, { alignment: 'time' })).toThrow(/overlapping/);
  });

  it('does not interpolate across long time gaps or missing GPS sections', () => {
    const dense = route(10);
    const gappy = route(10);
    gappy.points = gappy.points.filter((point, index) => index < 10 || index > 30);
    const result = compareTracks(analyzeTrack(dense), analyzeTrack(gappy), { sampleCount: 61 });
    expect(result.samples[20].gapMeters).toBeNull();
    expect(result.matchedSamples).toBeLessThan(61);
    const missing = route(10);
    missing.points[20].lat = null;
    const analysis = analyzeTrack(missing);
    expect(analysis.segments.some((edge) => edge.from.segment !== edge.to.segment)).toBe(false);
  });

  it('sorts unordered timestamps and normalizes recorded counter resets without changing input', () => {
    const input = route(10);
    input.points.forEach((point, index) => {
      if (index >= 30) point.recordedDistance = point.distance! - 900;
    });
    [input.points[0], input.points[5]] = [input.points[5], input.points[0]];
    const result = analyzeTrack(input);
    expect(result.points[0].time).toEqual(new Date(Date.UTC(2026, 8, 29)));
    expect(result.rawGpsDist).toBeCloseTo(1800, 5);
    expect(result.points.at(-1)?.normWatchDist).toBe(1770);
  });

  it('uses recorded summaries without pretending their proportional allocation measures local drift', () => {
    const input = route();
    input.points.forEach((point) => { point.recordedDistance = null; });
    input.recordedDistance = 1900;
    const result = analyzeTrack(input);
    expect(result.distanceBasis).toBe('summary-proportional');
    expect(result.splits[0].recordedMeters).toBeCloseTo(1900 / 1.8, 5);
    expect(result.segments.every((segment) => segment.ratio === null && segment.level === 'unknown')).toBe(true);
  });

  it('does not invent device totals or sampling rates for undated GPX', () => {
    const activity = parseActivityFile('<gpx><trkpt lat="0" lon="0"/><trkpt lat="0" lon="0.01"/></gpx>', 'gpx');
    const result = analyzeTrack(activity);
    expect(result.distanceBasis).toBe('gps-only');
    expect(result.deltaMeters).toBeNull();
    expect(result.avgInterval).toBeNull();
    expect(result.movingTime).toBeNull();
    expect(result.eleGain).toBeNull();
    expect(result.splits[0].recordedMeters).toBeNull();
    expect(result.diagnostics.distance).toBe('no-reference');
    expect(result.diagnostics.sampling).toBe('unknown');
  });

  it('flags possible stationary drift and spikes without calling them confirmed GPS errors', () => {
    const input = route(1);
    input.points[10].speed = 0;
    input.points[20].lon += 0.002;
    const result = analyzeTrack(input);
    expect(result.possibleStationaryDriftMeters).toBeCloseTo(3, 5);
    expect(result.speedSpikeCount).toBe(2);
    expect(result.segments[9].possibleStationaryDrift).toBe(true);
    expect(result.segments.some((segment) => segment.possibleSpeedSpike)).toBe(true);
  });

  it('handles the dateline, stationary tracks and invalid progress without NaN output', () => {
    const input = route(600);
    input.points[0].lon = 179.999;
    input.points[1].lon = -179.999;
    const result = analyzeTrack(input);
    expect(result.rawGpsDist).toBeCloseTo(222.39, 1);
    expect(Math.abs(sampleTrackProgress(result, 0.5)!.lon)).toBeCloseTo(180, 5);
    expect(sampleTrackProgress(result, -1)).toBeNull();
    expect(sampleTrackProgress(result, NaN)).toBeNull();
    expect(sampleTrackDistance(result, 999999)).toBeNull();
    const stationary = route();
    stationary.points.forEach((point) => { point.lon = 0; point.recordedDistance = 0; point.speed = 0; });
    stationary.recordedDistance = 0;
    stationary.recordedDuration = 0;
    const stopped = analyzeTrack(stationary);
    expect(stopped.splits).toEqual([]);
    expect(stopped.movingTime).toBe(0);
    expect(compareTracks(stopped, stopped).deltas.distancePercent).toBeNull();
  });

  it('rejects GPS-free tracks and invalid analysis options explicitly', () => {
    const input = route();
    expect(() => analyzeTrack(input, { speedSpikeMps: 0 })).toThrow(/thresholds/);
    input.points.forEach((point) => { point.lat = null; point.lon = null; });
    expect(() => analyzeTrack(input)).toThrow(/GPS points/);
    const track = analyzeTrack(route());
    expect(() => compareTracks(track, track, { sampleCount: 1 })).toThrow(/options/);
    expect(() => compareTracks(track, track, { maxInterpolationGapSeconds: Infinity })).toThrow(/options/);
  });

  it('works through the same worker seam as file conversion', () => {
    const analyzed = handleFileWorkerRequest({ id: 1, operation: 'analyze', activity: route() });
    if (!analyzed.ok || analyzed.result.operation !== 'analyze') throw new Error('Analysis failed');
    const comparison = handleFileWorkerRequest({
      id: 2, operation: 'compare', trackA: analyzed.result.track, trackB: analyzed.result.track,
    });
    expect(comparison).toMatchObject({ id: 2, ok: true, result: { operation: 'compare', comparison: { alignment: 'time' } } });
  });
});
