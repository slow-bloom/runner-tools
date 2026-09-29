import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  calculateMovingTime,
  calculateElevationGain,
  normalizeTrackDistances,
  cropTrack,
  stripTrackGPS,
  calculateActivitySummary,
} from './geo.js';
import type { Trackpoint } from './types.js';

describe('Geographic & Track Utilities', () => {
  describe('haversineDistance', () => {
    it('calculates distance between known landmarks accurately', () => {
      // Beijing Tiananmen (39.9087, 116.3975) to Olympic Park (39.9928, 116.3975) - due north ~9.35km
      const pt1 = { lat: 39.9087, lon: 116.3975 };
      const pt2 = { lat: 39.9928, lon: 116.3975 };
      const dist = haversineDistance(pt1, pt2);
      expect(dist).toBeGreaterThan(9300);
      expect(dist).toBeLessThan(9400);
    });

    it('returns 0 for identical coordinates or invalid numbers', () => {
      const pt = { lat: 31.2304, lon: 121.4737 };
      expect(haversineDistance(pt, pt)).toBe(0);
      expect(haversineDistance({ lat: NaN, lon: 0 }, pt)).toBe(0);
      expect(haversineDistance(pt, { lat: 0, lon: Infinity })).toBe(0);
    });
  });

  describe('calculateMovingTime', () => {
    it('accumulates active time above minimum speed threshold', () => {
      const t0 = new Date('2026-03-01T08:00:00Z');
      const points: Trackpoint[] = [
        { lat: 0, lon: 0, ele: 0, time: t0, hr: null, cad: null, distance: 0, speed: 3.0 },
        { lat: 0.0001, lon: 0, ele: 0, time: new Date(t0.getTime() + 5000), hr: null, cad: null, distance: 15, speed: 3.0 },
        // Pause 30s (exceeds default 15s maxGap)
        { lat: 0.0001, lon: 0, ele: 0, time: new Date(t0.getTime() + 35000), hr: null, cad: null, distance: 15, speed: 0.0 },
        // Movement resumes for 10s
        { lat: 0.0003, lon: 0, ele: 0, time: new Date(t0.getTime() + 45000), hr: null, cad: null, distance: 45, speed: 3.0 },
      ];

      const moving = calculateMovingTime(points);
      // First leg = 5s, pause leg excluded, third leg = 10s -> total 15s
      expect(moving).toBe(15);
    });

    it('returns total elapsed time if movingSecs could not be calculated', () => {
      const t0 = new Date('2026-03-01T08:00:00Z');
      const points: Trackpoint[] = [
        { lat: null, lon: null, ele: null, time: t0, hr: null, cad: null, distance: null },
        { lat: null, lon: null, ele: null, time: new Date(t0.getTime() + 10000), hr: null, cad: null, distance: null },
      ];
      expect(calculateMovingTime(points)).toBe(10);
    });

    it('excludes standstills with measured zero movement rather than falling back to elapsed time', () => {
      const t0 = new Date('2026-03-01T08:00:00Z');
      // 10 seconds of stationary standstill with recorded coordinates and distance
      const points: Trackpoint[] = [
        { lat: 39.9, lon: 116.4, ele: 50, time: t0, hr: 80, cad: 0, distance: 0, speed: 0 },
        { lat: 39.9, lon: 116.4, ele: 50, time: new Date(t0.getTime() + 10000), hr: 80, cad: 0, distance: 0, speed: 0 },
      ];
      // Standstill must be 0s, NOT elapsed 10s
      expect(calculateMovingTime(points)).toBe(0);
    });

    it('returns 0 for empty or single point streams', () => {
      expect(calculateMovingTime([])).toBe(0);
      expect(calculateMovingTime([{ lat: 0, lon: 0, ele: 0, time: new Date(), hr: null, cad: null, distance: 0 }])).toBe(0);
    });
  });

  describe('calculateElevationGain', () => {
    it('smooths GPS jitter and counts ascent and descent', () => {
      // A gentle hill: 10m -> 15m -> 25m -> 20m -> 10m
      const points: Trackpoint[] = [
        10, 11, 12, 14, 16, 20, 25, 25, 22, 18, 14, 10,
      ].map((ele) => ({
        lat: 0,
        lon: 0,
        ele,
        time: null,
        hr: null,
        cad: null,
        distance: 0,
      }));

      const { ascent, descent } = calculateElevationGain(points, { windowSize: 2, minDiff: 0.05 });
      expect(ascent).toBeGreaterThan(5);
      expect(descent).toBeGreaterThan(5);
    });

    it('returns zero for flat tracks or missing elevation data', () => {
      const flatPoints: Trackpoint[] = [10, 10, 10].map((ele) => ({
        lat: 0,
        lon: 0,
        ele,
        time: null,
        hr: null,
        cad: null,
        distance: 0,
      }));
      expect(calculateElevationGain(flatPoints)).toEqual({ ascent: 0, descent: 0 });
      expect(calculateElevationGain([])).toEqual({ ascent: 0, descent: 0 });
    });
  });

  describe('normalizeTrackDistances', () => {
    it('calculates monotonically increasing cumulative distance', () => {
      const points: Trackpoint[] = [
        { lat: 0, lon: 0, ele: null, time: null, hr: null, cad: null, distance: 0 },
        { lat: 0, lon: 0, ele: null, time: null, hr: null, cad: null, distance: 100 },
        // Simulating a reset from a new lap or merged file
        { lat: 0, lon: 0, ele: null, time: null, hr: null, cad: null, distance: 10 },
        { lat: 0, lon: 0, ele: null, time: null, hr: null, cad: null, distance: 50 },
      ];

      const normalized = normalizeTrackDistances(points);
      expect(normalized[0].distance).toBe(0);
      expect(normalized[1].distance).toBe(100);
      expect(normalized[2].distance).toBe(110);
      expect(normalized[3].distance).toBe(150);
    });

    it('forces recalculation via GPS coordinates when forceGps is true', () => {
      // 0.001 deg latitude is approx 111 meters
      const points: Trackpoint[] = [
        { lat: 0, lon: 0, ele: null, time: null, hr: null, cad: null, distance: 999 },
        { lat: 0.001, lon: 0, ele: null, time: null, hr: null, cad: null, distance: 999 },
      ];

      const normalized = normalizeTrackDistances(points, { forceGps: true });
      expect(normalized[0].distance).toBe(0);
      expect(normalized[1].distance).toBeGreaterThan(100);
      expect(normalized[1].distance).toBeLessThan(120);
    });
  });

  describe('cropTrack', () => {
    it('crops points within start and end distance thresholds and rebases distance from zero', () => {
      const points: Trackpoint[] = [
        { lat: 0, lon: 0, ele: 0, time: null, hr: null, cad: null, distance: 0 },
        { lat: 0, lon: 0, ele: 0, time: null, hr: null, cad: null, distance: 100 },
        { lat: 0, lon: 0, ele: 0, time: null, hr: null, cad: null, distance: 300 },
        { lat: 0, lon: 0, ele: 0, time: null, hr: null, cad: null, distance: 500 },
        { lat: 0, lon: 0, ele: 0, time: null, hr: null, cad: null, distance: 800 },
        { lat: 0, lon: 0, ele: 0, time: null, hr: null, cad: null, distance: 1000 },
      ];

      // Trim first 150m and last 250m -> points left should be 300m and 500m
      const cropped = cropTrack(points, { cropStartMeters: 150, cropEndMeters: 250 });
      expect(cropped).toHaveLength(2);
      expect(cropped[0].distance).toBe(0);
      expect(cropped[1].distance).toBe(200);
    });

    it('returns empty array if crop thresholds exceed total distance', () => {
      const points: Trackpoint[] = [
        { lat: 0, lon: 0, ele: 0, time: null, hr: null, cad: null, distance: 0 },
        { lat: 0, lon: 0, ele: 0, time: null, hr: null, cad: null, distance: 50 },
      ];
      expect(cropTrack(points, { cropStartMeters: 100 })).toHaveLength(0);
    });
  });

  describe('stripTrackGPS', () => {
    it('sets lat and lon to null while preserving sensor metrics', () => {
      const points: Trackpoint[] = [
        { lat: 39.9, lon: 116.4, ele: 50, time: new Date(), hr: 145, cad: 180, distance: 1000 },
      ];
      const stripped = stripTrackGPS(points);
      expect(stripped[0].lat).toBeNull();
      expect(stripped[0].lon).toBeNull();
      expect(stripped[0].hr).toBe(145);
      expect(stripped[0].cad).toBe(180);
      expect(stripped[0].distance).toBe(1000);
    });
  });

  describe('calculateActivitySummary', () => {
    it('accurately computes summary metrics and pace', () => {
      const t0 = new Date('2026-03-01T08:00:00Z');
      const points: Trackpoint[] = [
        { lat: 0, lon: 0, ele: 10, time: t0, hr: 140, cad: 85, distance: 0, speed: 3.33 },
        { lat: 0, lon: 0.009, ele: 20, time: new Date(t0.getTime() + 300000), hr: 160, cad: 90, distance: 1000, speed: 3.33 },
      ];

      const summary = calculateActivitySummary(points);
      expect(summary.distance).toBe(1000);
      expect(summary.duration).toBe(300);
      expect(summary.avgPaceSecs).toBe(300); // 5:00 /km
      expect(summary.avgHeartRate).toBe(150);
      expect(summary.maxHeartRate).toBe(160);
      // Single leg cadence (< 120) converted to SPM (90 * 2 = 180)
      expect(summary.avgCadence).toBe(175);
      expect(summary.maxCadence).toBe(180);
      expect(summary.sport).toBe('running');
    });
  });
});
