import { describe, it, expect } from 'vitest';
import {
  calculateVDOT,
  calculateVDOTScore,
  calculateVDOTPacesRaw,
  calculateEquivalentTimesRaw,
  solveVelocityForVO2,
  calculateVO2,
  solveTimeForDistance,
} from './vdot.js';

describe('VDOT Formula & Pace Calculations', () => {
  it('should accurately calculate VDOT for standard race benchmarks', () => {
    // 5K in 20:00 (1200 seconds) -> VDOT ~ 49.8
    const r5k = calculateVDOT({ distanceMeters: 5000, timeSeconds: 1200 });
    expect(r5k).not.toBeNull();
    expect(Math.round(r5k!.vdot * 10) / 10).toBe(49.8);

    // Marathon in 3:00:00 (10800 seconds) -> VDOT ~ 53.9
    const rMarathon = calculateVDOT({ distanceMeters: 42195, timeSeconds: 10800 });
    expect(rMarathon).not.toBeNull();
    expect(rMarathon!.vdot).toBeGreaterThan(53.5);
    expect(rMarathon!.vdot).toBeLessThan(54.2);

    // Half Marathon in 1:30:00 (5400 seconds) -> VDOT ~ 50.98
    const rHalf = calculateVDOT({ distanceMeters: 21097.5, timeSeconds: 5400 });
    expect(rHalf).not.toBeNull();
    expect(rHalf!.vdot).toBeGreaterThan(50.5);
    expect(rHalf!.vdot).toBeLessThan(51.5);
  });

  it('should compute pure raw numerical paces without presentation strings', () => {
    const rawScore = calculateVDOTScore(5000, 1200);
    expect(rawScore).not.toBeNull();
    expect(rawScore!).toBeCloseTo(49.8, 1);

    const rawPaces = calculateVDOTPacesRaw(rawScore!, 'km');
    expect(rawPaces).not.toBeNull();
    // Raw numeric paces in seconds/km
    expect(rawPaces!.E.fastPaceSecs).toBeGreaterThan(0);
    expect(rawPaces!.E.slowPaceSecs).toBeGreaterThan(rawPaces!.E.fastPaceSecs);
    expect((rawPaces!.E as any).name).toBeUndefined(); // Pure math layer without presentation

    const rawEqs = calculateEquivalentTimesRaw(rawScore!, [5000, 10000]);
    expect(rawEqs).not.toBeNull();
    expect(rawEqs!.length).toBe(2);
    expect(rawEqs![0].predictedSeconds).toBeCloseTo(1200, 0);
  });

  it('should generate all 5 Daniels training pace zones (E, M, T, I, R)', () => {
    const res = calculateVDOT({ distanceMeters: 5000, timeSeconds: 1200, unit: 'km', lang: 'en' });
    expect(res).not.toBeNull();
    const zones = res!.zones;

    expect(zones.E).toBeDefined();
    expect(zones.M).toBeDefined();
    expect(zones.T).toBeDefined();
    expect(zones.I).toBeDefined();
    expect(zones.R).toBeDefined();

    // High pace in seconds should be slower than low pace (R < I < T < M < E in seconds/km)
    expect(zones.R.lowPaceSecs).toBeLessThan(zones.I.lowPaceSecs);
    expect(zones.I.lowPaceSecs).toBeLessThan(zones.T.lowPaceSecs);
    expect(zones.T.lowPaceSecs).toBeLessThan(zones.M.lowPaceSecs);
    expect(zones.M.lowPaceSecs).toBeLessThan(zones.E.lowPaceSecs);

    // Formatted strings should have min'sec" structure
    expect(zones.E.lowPaceFormatted).toMatch(/^\d+'\d{2}"$/);
    expect(zones.E.highPaceFormatted).toMatch(/^\d+'\d{2}"$/);
  });

  it('should support Chinese localization correctly', () => {
    const resZh = calculateVDOT({ distanceMeters: 5000, timeSeconds: 1200, unit: 'km', lang: 'zh' });
    expect(resZh).not.toBeNull();
    expect(resZh!.zones.E.name).toContain('轻松跑');
    expect(resZh!.zones.T.name).toContain('乳酸阈值跑');
    expect(resZh!.equivalentPerformances[0].distanceLabel).toContain('5 公里');
    expect(resZh!.zones.E.unit).toBe('km');
  });

  it('should calculate imperial (miles) pace proportionally', () => {
    const metric = calculateVDOT({ distanceMeters: 5000, timeSeconds: 1200, unit: 'km' })!;
    const imperial = calculateVDOT({ distanceMeters: 5000, timeSeconds: 1200, unit: 'mi' })!;

    const ratio = imperial.zones.T.lowPaceSecs / metric.zones.T.lowPaceSecs;
    expect(ratio).toBeCloseTo(1.609344, 2);
  });

  it('should handle zero, negative, and NaN inputs gracefully by returning null', () => {
    expect(calculateVDOT({ distanceMeters: 0, timeSeconds: 1200 })).toBeNull();
    expect(calculateVDOT({ distanceMeters: NaN, timeSeconds: 1200 })).toBeNull();
    expect(calculateVDOT({ distanceMeters: 5000, timeSeconds: 0 })).toBeNull();
    expect(calculateVDOT({ distanceMeters: 5000, timeSeconds: NaN })).toBeNull();
    expect(calculateVDOT({ distanceMeters: -5000, timeSeconds: 1200 })).toBeNull();
    expect(calculateVDOTScore(0, 1200)).toBeNull();
    expect(calculateVDOTScore(5000, NaN)).toBeNull();
    expect(solveTimeForDistance(0, 50)).toBeNull();
    expect(solveTimeForDistance(5000, NaN)).toBeNull();
  });

  it('should invert velocity and VO2 accurately', () => {
    const testVelocities = [150, 200, 250, 300]; // m/min
    for (const v of testVelocities) {
      const vo2 = calculateVO2(v);
      const solvedV = solveVelocityForVO2(vo2);
      expect(solvedV).toBeCloseTo(v, 4);
    }
  });

  it('should solve equivalent race performance times with high consistency', () => {
    const vdot = 50.0;
    const time5k = solveTimeForDistance(5000, vdot)!;
    // 5K at VDOT 50 should be around 19:57 (1197 seconds)
    expect(time5k).toBeGreaterThan(1180);
    expect(time5k).toBeLessThan(1210);

    // Re-calculating VDOT from solved 5K time should yield ~ 50.0
    const checkResult = calculateVDOT({ distanceMeters: 5000, timeSeconds: time5k })!;
    expect(checkResult.vdot).toBeCloseTo(50.0, 1);
  });

  it('should accurately solve short track sprints and ultra distances without clamping', () => {
    // 400m in 55s -> must solve close to 55s (not clamped to 60s)
    const vdot400 = calculateVDOTScore(400, 55);
    expect(vdot400).not.toBeNull();
    const t400 = solveTimeForDistance(400, vdot400!);
    expect(t400).not.toBeNull();
    expect(t400!).toBeCloseTo(55, 0);

    // 200km in 25h (90,000s) -> must solve close to 25h (not clamped to 24h = 86,400s)
    const vdot200k = calculateVDOTScore(200000, 90000);
    expect(vdot200k).not.toBeNull();
    const t200k = solveTimeForDistance(200000, vdot200k!);
    expect(t200k).not.toBeNull();
    expect(t200k!).toBeCloseTo(90000, 0);

    // Completely unphysiological VDOT (> 120) or invalid bracket should return null
    expect(solveTimeForDistance(10000, 130)).toBeNull();
  });

  it('should reject unsupported VDOT scores (> 85 or < 15) and not produce zero-second race predictions', () => {
    // 400m in 30s produces VDOT ~ 164.9, which is unphysiological and must return null
    expect(calculateVDOTScore(400, 30)).toBeNull();
    expect(calculateVDOT({ distanceMeters: 400, timeSeconds: 30 })).toBeNull();

    // Marathon in 12 hours produces VDOT ~ 13.9, which is below physiological VDOT tables (15)
    expect(calculateVDOTScore(42195, 43200)).toBeNull();
    expect(calculateVDOT({ distanceMeters: 42195, timeSeconds: 43200 })).toBeNull();

    expect(calculateVDOTPacesRaw(120)).toBeNull();
    expect(calculateEquivalentTimesRaw(120)).toBeNull();
  });

  it('should support round-trip calculations for physiological endpoints (VDOT 85 and VDOT 15)', () => {
    // VDOT 85 5K prediction round-trip
    const eq85 = calculateEquivalentTimesRaw(85, [5000]);
    expect(eq85).not.toBeNull();
    expect(eq85![0]).toBeDefined();
    const score85 = calculateVDOTScore(5000, eq85![0].predictedSeconds);
    expect(score85).not.toBeNull();
    expect(score85!).toBeCloseTo(85.0, 1);

    // VDOT 15 Half Marathon & Marathon prediction round-trips
    const eq15 = calculateEquivalentTimesRaw(15, [21097.5, 42195]);
    expect(eq15).not.toBeNull();
    const score15Half = calculateVDOTScore(21097.5, eq15![0].predictedSeconds);
    expect(score15Half).not.toBeNull();
    expect(score15Half!).toBeCloseTo(15.0, 1);

    const score15Full = calculateVDOTScore(42195, eq15![1].predictedSeconds);
    expect(score15Full).not.toBeNull();
    expect(score15Full!).toBeCloseTo(15.0, 1);
  });
});

