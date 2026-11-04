import { describe, it, expect } from 'vitest';
import { predictRaceTime, predictMarathonTime, calculateRacePredictions } from './race-predictor.js';

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

  describe('Opt-in weekly-mileage marathon prediction', () => {
    it.each([
      [35000, 13687.649202307],
      [50000, 13426.866554621],
      [65000, 13175.835195118],
    ])('matches the iOS half-marathon reference at %s metres/week', (weekly, expected) => {
      const result = predictMarathonTime(21097.5, 6000, weekly);
      expect(result.status).toBe('predicted');
      expect(result.seconds).toBeCloseTo(expected, 6);
    });

    it('uses the actual distance of a nonstandard 22 km performance', () => {
      expect(predictMarathonTime(22000, 7200, 50000).seconds).toBeCloseTo(15150.372161576, 6);
    });

    it.each([5000, 8046.72, 10000, 16093.44, 21097.5])(
      'matches a standard %s metre source within the GPS tolerance', (distance) => {
        const expected = predictMarathonTime(distance, 3600, 50000);
        expect(predictMarathonTime(distance * 0.981, 3600, 50000)).toEqual(expected);
        expect(predictMarathonTime(distance * 1.019, 3600, 50000)).toEqual(expected);
      },
    );

    it('handles the GPS tolerance boundaries and unsupported distances', () => {
      expect(predictMarathonTime(4900, 1800, 50000).status).toBe('predicted');
      expect(predictMarathonTime(4899, 1800, 50000).status).toBe('unsupported-distance');
      expect(predictMarathonTime(43038.9, 14400).status).toBe('direct');
      expect(predictMarathonTime(43039, 14400, 50000).status).toBe('unsupported-distance');
      expect(predictMarathonTime(50000, 14400, 50000).status).toBe('unsupported-distance');
    });

    it.each([undefined, null, -1, NaN, Infinity])(
      'uses marathon elapsed time directly, ignoring mileage %s', (weekly) => {
        expect(predictMarathonTime(42195, 14400, weekly)).toEqual({ status: 'direct', seconds: 14400 });
        expect(predictMarathonTime(42000, 14400, weekly)).toEqual({ status: 'direct', seconds: 14400 });
      },
    );

    it('distinguishes missing mileage from an explicit zero', () => {
      expect(predictMarathonTime(10000, 2700).status).toBe('missing-mileage');
      expect(predictMarathonTime(10000, 2700, null).status).toBe('missing-mileage');
      expect(predictMarathonTime(10000, 2700, 0).status).toBe('predicted');
    });

    it.each([-1, NaN, Infinity, -Infinity])('rejects invalid mileage %s', (weekly) => {
      expect(predictMarathonTime(10000, 2700, weekly).status).toBe('invalid-mileage');
    });

    it.each([0, -1, NaN, Infinity])('rejects invalid baseline values %s', (value) => {
      expect(predictMarathonTime(value, 2700, 50000).status).toBe('invalid-input');
      expect(predictMarathonTime(10000, value, 50000).status).toBe('invalid-input');
    });

    it('rejects overflowing projections and nonfinite reciprocal intermediates', () => {
      expect(predictMarathonTime(5000, Number.MAX_VALUE, 50000).status).toBe('invalid-input');
      expect(predictMarathonTime(5000, Number.MIN_VALUE, 50000).status).toBe('invalid-input');
    });

    it('changes only the marathon target and preserves default API behavior', () => {
      const options = { baseDistanceMeters: 21097.5, baseTimeSeconds: 6000 };
      const original = calculateRacePredictions(options)!;
      const updated = calculateRacePredictions({
        ...options, marathonModel: 'weekly-mileage', weeklyDistanceMeters: 50000,
      })!;
      expect(original).not.toHaveProperty('marathonStatus');
      expect(original.predictions[3].predictedSeconds).toBe(predictRaceTime(21097.5, 6000, 42195));
      expect(updated.predictions.slice(0, 3)).toEqual(original.predictions.slice(0, 3));
      expect(updated.marathonStatus).toBe('predicted');
      expect(updated.predictions[3].predictedSeconds).toBeCloseTo(13426.866554621, 6);
      expect(calculateRacePredictions({ ...options, weeklyDistanceMeters: 50000 })).toEqual(original);
    });

    it.each([undefined, -1, NaN, Infinity])('keeps shorter results when mileage is %s', (weekly) => {
      const options = { baseDistanceMeters: 10000, baseTimeSeconds: 2700 };
      const result = calculateRacePredictions({
        ...options, marathonModel: 'weekly-mileage', weeklyDistanceMeters: weekly,
      })!;
      expect(result.predictions).toEqual(calculateRacePredictions(options)!.predictions.slice(0, 3));
    });

    it('keeps generic custom targets and custom exponents backward-compatible', () => {
      const options = {
        baseDistanceMeters: 22000, baseTimeSeconds: 7200, exponent: 1.12,
        targetDistances: [{ key: 'marathon', meters: 40000 }, { meters: 42195 }, { meters: 50000 }],
      };
      const original = calculateRacePredictions(options)!;
      const updated = calculateRacePredictions({
        ...options, marathonModel: 'weekly-mileage', weeklyDistanceMeters: 50000,
      })!;
      expect(updated.predictions[0]).toEqual(original.predictions[0]);
      expect(updated.predictions[2]).toEqual(original.predictions[2]);
      expect(updated.predictions[1].predictedSeconds).toBeCloseTo(15150.372161576, 6);
    });

    it('converts mile-based inputs and display units without changing finish time', () => {
      const options = {
        baseDistanceMeters: 21097.5, baseTimeSeconds: 6000,
        marathonModel: 'weekly-mileage' as const, weeklyDistanceMeters: 50000,
      };
      const metric = calculateRacePredictions(options)!;
      const imperial = calculateRacePredictions({
        ...options, weeklyDistanceMeters: (50 / 1.609344) * 1609.344, unit: 'mi',
      })!;
      const metricMarathon = metric.predictions[3];
      const imperialMarathon = imperial.predictions[3];
      expect(imperialMarathon.predictedSeconds).toBeCloseTo(metricMarathon.predictedSeconds, 8);
      expect(imperialMarathon.targetPaceSecs).toBeCloseTo(metricMarathon.targetPaceSecs * 1.609344, 8);
    });
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

  it('should safely handle prototype properties as custom target keys without prototype pollution', () => {
    const res = calculateRacePredictions({
      baseDistanceMeters: 10000,
      baseTimeSeconds: 2700,
      targetDistances: [
        { key: 'constructor', meters: 5000 },
        { key: '__proto__', meters: 21097.5 },
      ],
    });

    expect(res).not.toBeNull();
    expect(res!.predictions.length).toBe(2);
    for (const pred of res!.predictions) {
      expect(typeof pred.distanceLabel).toBe('string');
      expect(pred.distanceLabel).not.toContain('[native code]');
      expect(typeof (pred as any).distanceLabel).not.toBe('function');
    }
    expect(res!.predictions[0].distanceLabel).toBe('5.0 km');
    expect(res!.predictions[1].distanceLabel).toBe('21.1 km');
  });
});
