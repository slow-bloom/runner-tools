import { describe, expect, it } from 'vitest';
import { analyzeTrack, compareTracks, createRecordedDistanceSampler, sampleTrackDistance, sampleTrackProgress } from './analysis.js';
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
  it('compares recorded laps over their time windows, independently of point counters', () => {
    const input = route(10, { recordedScale: 1.02 });
    input.recordedDistance = 1500;
    input.recordedLaps = [0, 200, 400].map(second => ({
      startTime: new Date(Date.UTC(2026, 8, 29, 0, 0, second)),
      endTime: new Date(Date.UTC(2026, 8, 29, 0, 0, second + 200)),
      distance: 500,
      endTimeBasis: 'recorded',
    }));
    const before = structuredClone(input);
    const result = analyzeTrack(input);
    expect(result.deltaMeters).toBeCloseTo(-300, 6);
    expect(result.splits.at(-1)?.cumulativeDeltaMeters).toBeCloseTo(36, 6);
    expect(result.laps).toHaveLength(3);
    for (const lap of result.laps) {
      expect(lap.status).toBe('complete');
      expect(lap.recordedMeters).toBe(500);
      expect(lap.gpsMeters).toBeCloseTo(600, 6);
      expect(lap.deltaMeters).toBeCloseTo(-100, 6);
      expect(lap.paths).toHaveLength(1);
      expect(lap.startPoint?.time).toEqual(lap.startTime);
      expect(lap.endPoint?.time).toEqual(lap.endTime);
    }
    expect(result.laps.at(-1)?.cumulativeDeltaMeters).toBeCloseTo(-300, 6);
    expect(input).toEqual(before);
  });

  it('interpolates lap boundaries and exposes partial final coverage without extrapolation', () => {
    const input = route();
    input.recordedLaps = [
      { startTime: input.points[0].time, endTime: new Date(Date.UTC(2026, 8, 29, 0, 0, 205)), distance: 600, endTimeBasis: 'recorded' },
      { startTime: new Date(Date.UTC(2026, 8, 29, 0, 0, 205)), endTime: new Date(Date.UTC(2026, 8, 29, 0, 0, 601)), distance: 1200, endTimeBasis: 'recorded' },
    ];
    const [first, last] = analyzeTrack(input).laps;
    expect(first.gpsMeters).toBeCloseTo(615, 6);
    expect(first.endPoint?.distance).toBeCloseTo(615, 6);
    expect(last.status).toBe('partial');
    expect(last.coveredGpsMeters).toBeCloseTo(1185, 6);
    expect(last.coveredSeconds).toBe(395);
    expect(last.durationSeconds).toBe(396);
    expect(last.gpsMeters).toBeNull();
    expect(last.deltaMeters).toBeNull();
    expect(last.cumulativeDeltaMeters).toBeNull();
    expect(last.endPoint).toBeNull();
  });

  it('keeps same-second GPS samples and assigns boundary ties to the following lap', () => {
    const input = route();
    input.points[21].time = input.points[20].time;
    input.recordedLaps = [
      { startTime: input.points[0].time, endTime: input.points[20].time, distance: 600, endTimeBasis: 'recorded' },
      { startTime: input.points[20].time, endTime: input.points.at(-1)!.time, distance: 1200, endTimeBasis: 'recorded' },
    ];
    const result = analyzeTrack(input);
    expect(result.laps.every(lap => lap.status === 'complete')).toBe(true);
    expect(result.laps[0].gpsMeters).toBeCloseTo(600, 6);
    expect(result.laps[1].gpsMeters).toBeCloseTo(1200, 6);
    expect(result.laps[1].paths[0].filter(point => point.time?.getTime() === input.points[20].time?.getTime())).toHaveLength(2);
    expect(result.laps[1].cumulativeDeltaMeters).toBeCloseTo(0, 6);
  });

  it('does not bridge interior GPS, timestamp or long recording gaps inside a lap', () => {
    for (const missing of ['lat', 'time', 'long-gap'] as const) {
      const input = route();
      input.recordedLaps = [{ startTime: input.points[0].time, endTime: input.points.at(-1)!.time, distance: 1800, endTimeBasis: 'recorded' }];
      if (missing === 'long-gap') input.points.splice(20, 10);
      else input.points[20][missing] = null;
      const [lap] = analyzeTrack(input).laps;
      expect(lap.status).toBe('partial');
      expect(lap.paths).toHaveLength(2);
      expect(lap.coveredGpsMeters).toBeLessThan(1800);
      expect(lap.gpsMeters).toBeNull();
      expect(lap.deltaMeters).toBeNull();
    }
  });

  it('retains unavailable and overlapping lap rows instead of manufacturing comparable splits', () => {
    const input = route();
    const at = (second: number) => new Date(Date.UTC(2026, 8, 29, 0, 0, second));
    input.recordedLaps = [
      { startTime: at(0), endTime: at(200), distance: 0, endTimeBasis: 'recorded' },
      { startTime: at(100), endTime: at(300), distance: 600, endTimeBasis: 'recorded' },
      { startTime: at(300), endTime: at(400), distance: null, endTimeBasis: 'recorded' },
      { startTime: at(400), endTime: at(500), distance: 300, endTimeBasis: 'last-sample' },
      { startTime: at(600), endTime: at(700), distance: 300, endTimeBasis: 'recorded' },
      { startTime: null, endTime: at(700), distance: 300, endTimeBasis: 'recorded' },
    ];
    const laps = analyzeTrack(input).laps;
    expect(laps.map(lap => lap.status)).toEqual(['complete', 'overlap', 'missing-distance', 'sample-end', 'no-gps', 'invalid-time']);
    expect(laps[0].deltaMeters).toBeCloseTo(-600, 6);
    expect(laps.slice(1).every(lap => lap.deltaMeters === null && lap.cumulativeDeltaMeters === null)).toBe(true);
    expect(laps[2].gpsMeters).toBeCloseTo(300, 6);
    expect(laps[3].endPoint).toBeNull();
    expect(analyzeTrack(route()).laps).toEqual([]);
  });

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

  it('locates equal watch and GPS distances on one route without rescaling the route', () => {
    const track = analyzeTrack(route(10, { recordedScale: 1.02 }));
    const before = structuredClone(track);
    const sampler = createRecordedDistanceSampler(track);
    expect(sampler.startDistance).toBe(0);
    expect(sampler.endDistance).toBe(1836);
    expect(sampler.at(1000)?.normWatchDist).toBeCloseTo(1000, 5);
    expect(sampler.at(1000)?.distance).toBeCloseTo(1000 / 1.02, 5);
    expect(sampleTrackDistance(track, 1000)?.distance).toBeCloseTo(1000, 5);
    expect(sampler.at(0)?.lon).toBe(track.points[0].lon);
    expect(sampler.at(1836)?.lon).toBe(track.points.at(-1)?.lon);
    expect(sampler.at(-1)).toBeNull();
    expect(sampler.at(Infinity)).toBeNull();
    expect(sampler.at(NaN)).toBeNull();
    expect(sampler.at(1837)).toBeNull();
    expect(track).toEqual(before);
  });

  it('does not construct a watch cursor from summary-only or GPS-only distances', () => {
    for (const recordedDistance of [1900, null]) {
      const input = route();
      input.points.forEach(point => { point.recordedDistance = null; });
      input.recordedDistance = recordedDistance;
      const sampler = createRecordedDistanceSampler(analyzeTrack(input));
      expect(sampler.startDistance).toBeNull();
      expect(sampler.endDistance).toBeNull();
      expect(sampler.at(0)).toBeNull();
      expect(sampler.at(1000)).toBeNull();
    }
  });

  it('keeps recorded and GPS gaps unavailable while preserving exact measured positions', () => {
    for (const missing of ['recordedDistance', 'lat'] as const) {
      const input = route();
      input.points[20][missing] = null;
      const track = analyzeTrack(input);
      const sampler = createRecordedDistanceSampler(track);
      expect(sampler.at(590)).toBeNull();
      expect(sampler.at(600)).toBeNull();
      expect(sampler.at(610)).toBeNull();
      expect(sampler.at(630)?.lon).toBe(input.points[21].lon);
    }
    const input = route();
    input.points = input.points.filter((_, index) => index < 10 || index > 30);
    const sampler = createRecordedDistanceSampler(analyzeTrack(input));
    expect(sampler.at(500)).toBeNull();
    expect(sampler.at(930)?.normWatchDist).toBe(930);
  });

  it('uses measured coverage, not the header total, and handles plateaus and counter resets', () => {
    const input = route();
    input.recordedDistance = 9000;
    input.points[0].lat = null;
    input.points.at(-1)!.recordedDistance = null;
    const sampler = createRecordedDistanceSampler(analyzeTrack(input));
    expect(sampler.startDistance).toBe(30);
    expect(sampler.endDistance).toBe(1770);
    expect(sampler.at(0)).toBeNull();
    expect(sampler.at(1800)).toBeNull();

    const paused = route();
    paused.points[21].recordedDistance = 600;
    const plateau = createRecordedDistanceSampler(analyzeTrack(paused));
    expect(plateau.at(600)?.lon).toBe(paused.points[20].lon);
    expect(plateau.at(630)?.distance).toBeCloseTo(645, 5);

    const reset = route();
    reset.points.forEach((point, index) => {
      if (index >= 30) point.recordedDistance = point.distance! - 900;
    });
    const rebased = createRecordedDistanceSampler(analyzeTrack(reset));
    expect(rebased.endDistance).toBe(1770);
    expect(rebased.at(885)?.distance).toBeCloseTo(915, 5);
  });

  it('handles zero recorded distance, sparse references and antimeridian interpolation', () => {
    const stationary = route();
    stationary.points.forEach(point => { point.recordedDistance = 0; });
    const zero = createRecordedDistanceSampler(analyzeTrack(stationary));
    expect(zero.startDistance).toBe(0);
    expect(zero.endDistance).toBe(0);
    expect(zero.at(0)?.lon).toBe(stationary.points[0].lon);
    expect(zero.at(1)).toBeNull();

    const sparse = route();
    sparse.points.forEach((point, index) => {
      if (index > 1) point.recordedDistance = null;
      if (index === 0) point.lat = null;
    });
    expect(createRecordedDistanceSampler(analyzeTrack(sparse)).at(30)).toBeNull();

    const dateline = route(600);
    dateline.points[0].lon = 179.999;
    dateline.points[1].lon = -179.999;
    dateline.points[1].time = new Date(dateline.points[0].time!.getTime() + 10000);
    expect(Math.abs(createRecordedDistanceSampler(analyzeTrack(dateline)).at(900)!.lon)).toBeCloseTo(180, 5);
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
