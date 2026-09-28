import { describe, it, expect } from 'vitest';
import { predictRaceTime, calculateRacePredictions } from './race-predictor.js';

describe('Peter Riegel Race Predictor Formula', () => {
  it('should accurately calculate Riegel race prediction for 10K to Marathon', () => {
    // 10K in 45:00 (2700s) -> Marathon (42.195 km) at exponent 1.06
    const predictedMarathon = predictRaceTime(10000, 2700, 42195, 1.06);
    expect(predictedMarathon).not.toBeNull();
    expect(predictedMarathon!).toBeGreaterThan(12400);
    expect(predictedMarathon!).toBeLessThan(12500);

    // Same distance should return identical time
    expect(predictRaceTime(10000, 2700, 10000, 1.06)).toBeCloseTo(2700, 4);
  });

  it('should reflect higher fatigue and slower times with larger exponents', () => {
    const elite = predictRaceTime(10000, 2700, 42195, 1.06)!;
    const recreational = predictRaceTime(10000, 2700, 42195, 1.08)!;
    const beginner = predictRaceTime(10000, 2700, 42195, 1.10)!;

    expect(recreational).toBeGreaterThan(elite);
    expect(beginner).toBeGreaterThan(recreational);
  });

  it('should calculate structured race predictions with pace and decay', () => {
    const res = calculateRacePredictions({
      baseDistanceMeters: 10000,
      baseTimeSeconds: 2700,
      exponent: 1.06,
      unit: 'km',
      lang: 'en',
    });

    expect(res).not.toBeNull();
    expect(res!.predictions.length).toBe(4);

    const marathon = res!.predictions.find((p) => p.key === 'marathon')!;
    expect(marathon).toBeDefined();
    expect(marathon.timeFormatted).toMatch(/^\d+:\d{2}:\d{2}$/);
    expect(marathon.paceFormatted).toMatch(/^\d+'\d{2}"$/);
    expect(marathon.paceDecayPercent).toBeGreaterThan(0); // marathon pace is slower than 10k baseline
  });

  it('should support Chinese localization properly', () => {
    const resZh = calculateRacePredictions({
      baseDistanceMeters: 10000,
      baseTimeSeconds: 2700,
      exponent: 1.06,
      unit: 'km',
      lang: 'zh',
    });

    expect(resZh).not.toBeNull();
    const half = resZh!.predictions.find((p) => p.key === 'halfMarathon')!;
    expect(half.distanceLabel).toContain('半程马拉松');
    expect(half.distanceFormatted).toContain('公里');
  });

  it('should return null for invalid, zero, or NaN baseline inputs', () => {
    expect(calculateRacePredictions({ baseDistanceMeters: 0, baseTimeSeconds: 2700 })).toBeNull();
    expect(calculateRacePredictions({ baseDistanceMeters: NaN, baseTimeSeconds: 2700 })).toBeNull();
    expect(calculateRacePredictions({ baseDistanceMeters: 10000, baseTimeSeconds: 0 })).toBeNull();
    expect(calculateRacePredictions({ baseDistanceMeters: 10000, baseTimeSeconds: NaN })).toBeNull();
    expect(calculateRacePredictions({ baseDistanceMeters: 10000, baseTimeSeconds: 2700, exponent: NaN })).toBeNull();
    expect(calculateRacePredictions({ baseDistanceMeters: 10000, baseTimeSeconds: 2700, exponent: -1 })).toBeNull();
    expect(predictRaceTime(0, 2700, 42195)).toBeNull();
    expect(predictRaceTime(NaN, 2700, 42195)).toBeNull();
    expect(predictRaceTime(10000, 2700, NaN)).toBeNull();
  });

  it('should filter out invalid target distances and not return NaN or 0:00 rows', () => {
    const res = calculateRacePredictions({
      baseDistanceMeters: 10000,
      baseTimeSeconds: 2700,
      targetDistances: [
        { meters: 5000, label: 'Valid 5K' },
        { meters: 0, label: 'Zero dist' },
        { meters: NaN, label: 'NaN dist' },
        { meters: -100, label: 'Negative dist' },
      ],
    });

    expect(res).not.toBeNull();
    // Only the single valid target should be retained
    expect(res!.predictions.length).toBe(1);
    expect(res!.predictions[0].distanceLabel).toBe('Valid 5K');
    expect(res!.predictions[0].timeFormatted).not.toBe('0:00');
    expect(res!.predictions[0].timeFormatted).not.toContain('NaN');

    // If all targets are invalid, returns null
    const allInvalid = calculateRacePredictions({
      baseDistanceMeters: 10000,
      baseTimeSeconds: 2700,
      targetDistances: [{ meters: NaN }, { meters: 0 }],
    });
    expect(allInvalid).toBeNull();
  });
});
