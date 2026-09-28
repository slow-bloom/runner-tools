import { describe, expect, it } from 'vitest';
import {
  calculateDistance,
  calculatePace,
  calculateTime,
  convertPace,
  solvePace,
} from './pace.js';

describe('Pace Pure Formulas', () => {
  it('calculates pace accurately', () => {
    // 10K in 45:00 (2700s) -> 270s/km (4:30 /km)
    const pace = calculatePace(10, 2700);
    expect(pace).toBe(270);
  });

  it('calculates total time accurately', () => {
    // 10K at 270s/km -> 2700s (45:00)
    const time = calculateTime(10, 270);
    expect(time).toBe(2700);
  });

  it('calculates distance accurately', () => {
    // 2700s at 270s/km -> 10 km
    const dist = calculateDistance(2700, 270);
    expect(dist).toBe(10);
  });

  it('rejects unphysiological, zero, or negative inputs with null', () => {
    expect(calculatePace(0, 2700)).toBeNull();
    expect(calculatePace(10, -50)).toBeNull();
    expect(calculatePace(10, 10)).toBeNull(); // 1 s/km is unphysiological sprint
    expect(calculateTime(0, 300)).toBeNull();
    expect(calculateDistance(300, 0)).toBeNull();
  });
});

describe('Pace Converter', () => {
  it('converts min/km pace into speeds and imperial pace', () => {
    // 5:00 min/km = 300s
    const res = convertPace({ paceSeconds: 300, paceUnit: 'km' });
    expect(res).not.toBeNull();
    expect(res!.paceKmFormatted).toBe('5\'00"');
    expect(res!.speedKmh).toBe(12.0);
    expect(res!.speedMph).toBeCloseTo(7.46, 1);
    expect(res!.paceMiFormatted).toBe('8\'03"');

    // Check estimated race finish splits
    expect(res!.splits).toHaveLength(4);
    expect(res!.splits[0].distanceKey).toBe('k5');
    expect(res!.splits[0].timeFormatted).toBe('25:00');
    expect(res!.splits[3].distanceKey).toBe('marathon');
    expect(res!.splits[3].timeFormatted).toBe('3:30:59');
  });

  it('converts treadmill speeds (km/h and mph) into accurate paces', () => {
    const fromKmh = convertPace({ speedKmh: 12.0 });
    expect(fromKmh).not.toBeNull();
    expect(fromKmh!.paceKmFormatted).toBe('5\'00"');

    const fromMph = convertPace({ speedMph: 7.45645 });
    expect(fromMph).not.toBeNull();
    expect(fromMph!.paceKmFormatted).toBe('5\'00"');
  });

  it('supports localized split labels in Chinese', () => {
    const resZh = convertPace({ paceSeconds: 300, paceUnit: 'km' }, { locale: 'zh' });
    expect(resZh).not.toBeNull();
    expect(resZh!.splits[0].distanceLabel).toContain('5 公里');
    expect(resZh!.splits[3].distanceLabel).toContain('全程马拉松');
  });
});

describe('Pace Solver', () => {
  it('solves pace given distance and time', () => {
    const res = solvePace({ distance: 10, timeSeconds: 2700, unit: 'km' });
    expect(res).not.toBeNull();
    expect(res!.solvedField).toBe('pace');
    expect(res!.paceSeconds).toBe(270);
    expect(res!.paceFormatted).toBe('4\'30"');
    expect(res!.finishTable).toHaveLength(4);
    // Offset 0 should equal exactly target time for 10K
    const k10 = res!.finishTable.find((t) => t.distanceKey === 'k10')!;
    expect(k10.times[2].timeFormatted).toBe('45:00');
  });

  it('solves time given distance and pace', () => {
    const res = solvePace({ distance: 42.195, paceSeconds: 300, unit: 'km' });
    expect(res).not.toBeNull();
    expect(res!.solvedField).toBe('time');
    expect(res!.timeFormatted).toBe('3:30:59');
  });

  it('solves distance given time and pace', () => {
    const res = solvePace({ timeSeconds: 3600, paceSeconds: 300, unit: 'km' });
    expect(res).not.toBeNull();
    expect(res!.solvedField).toBe('distance');
    expect(res!.distance).toBe(12);
  });

  it('rejects ambiguous inputs (not exactly 2 inputs) with null', () => {
    expect(solvePace({ distance: 10 })).toBeNull();
    expect(solvePace({ distance: 10, paceSeconds: 300, timeSeconds: 3000 })).toBeNull();
    expect(solvePace({})).toBeNull();
  });

  it('rejects calls where a third input is supplied, even if invalid or zero', () => {
    // Exactly two defined parameters must be supplied; third must not be silently overwritten
    expect(solvePace({ distance: 10, paceSeconds: 300, timeSeconds: 0 })).toBeNull();
    expect(solvePace({ distance: 10, paceSeconds: 300, timeSeconds: -50 })).toBeNull();
    expect(solvePace({ distance: 10, paceSeconds: 300, timeSeconds: NaN })).toBeNull();
    // Genuinely omitted third parameter (null or undefined) solves correctly
    const solved = solvePace({ distance: 10, paceSeconds: 300, timeSeconds: null });
    expect(solved).not.toBeNull();
    expect(solved!.timeSeconds).toBe(3000);
  });

  it('enforces distance bounds [0.01, 10000] on both supplied and calculated distances', () => {
    expect(calculatePace(0.001, 300)).toBeNull();
    expect(calculateTime(0.001, 300)).toBeNull();
    expect(calculateDistance(300, 3600000)).toBeNull(); // dist < 0.01

    expect(solvePace({ distance: 0.001, paceSeconds: 300 })).toBeNull();
    expect(solvePace({ distance: 10001, paceSeconds: 300 })).toBeNull();
    // Calculated distance exceeding 10000 is rejected
    expect(solvePace({ timeSeconds: 36000000, paceSeconds: 3000 })).toBeNull();
  });

  it('explicitly represents unsupported finish table offsets with null and em-dash without silent clamping', () => {
    // paceSeconds 60: offsets -10 and -5 would result in 50s and 55s (< 60s minimum)
    const res = solvePace({ distance: 5, paceSeconds: 60, unit: 'km' });
    expect(res).not.toBeNull();
    const k5 = res!.finishTable.find((t) => t.distanceKey === 'k5')!;
    // Offset -10
    expect(k5.times[0].offsetSecs).toBe(-10);
    expect(k5.times[0].paceSecs).toBeNull();
    expect(k5.times[0].timeSeconds).toBeNull();
    expect(k5.times[0].timeFormatted).toBe('—');
    // Offset -5
    expect(k5.times[1].offsetSecs).toBe(-5);
    expect(k5.times[1].paceSecs).toBeNull();
    expect(k5.times[1].timeSeconds).toBeNull();
    expect(k5.times[1].timeFormatted).toBe('—');
    // Offset 0 (valid at 60s/km)
    expect(k5.times[2].offsetSecs).toBe(0);
    expect(k5.times[2].paceSecs).toBe(60);
    expect(k5.times[2].timeSeconds).toBe(300);
    expect(k5.times[2].timeFormatted).toBe('5:00');
  });

  it('resolves unit strings and distance formatting through the locale dictionary', () => {
    const resZh = solvePace({ distance: 10, paceSeconds: 300, lang: 'zh' });
    expect(resZh).not.toBeNull();
    expect(resZh!.distanceFormatted).toBe('10 公里');

    const resCustom = solvePace({
      distance: 10,
      paceSeconds: 300,
      // @ts-expect-error test deep partial override
      lang: { pace: { units: { km: 'kilo' } } },
    });
    expect(resCustom).not.toBeNull();
    expect(resCustom!.distanceFormatted).toBe('10 kilo');
  });
});
