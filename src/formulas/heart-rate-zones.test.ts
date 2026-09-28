import { describe, expect, it } from 'vitest';
import {
  calculateHeartRateZones,
  calculateHeartRateZonesRaw,
  estimateMaxHR,
} from './heart-rate-zones.js';

describe('estimateMaxHR', () => {
  it('estimates max HR by age using Fox formula (220 - age)', () => {
    expect(estimateMaxHR(30)).toBe(190);
    expect(estimateMaxHR(45)).toBe(175);
  });

  it('estimates max HR using Tanaka formula (208 - 0.7 * age)', () => {
    expect(estimateMaxHR(40, 'tanaka')).toBe(180);
  });

  it('estimates max HR using Gellish formula (207 - 0.7 * age)', () => {
    expect(estimateMaxHR(50, 'gellish')).toBe(172);
  });

  it('returns null on invalid or out-of-range age', () => {
    expect(estimateMaxHR(0)).toBeNull();
    expect(estimateMaxHR(-10)).toBeNull();
    expect(estimateMaxHR(130)).toBeNull();
    expect(estimateMaxHR(NaN)).toBeNull();
  });
});

describe('calculateHeartRateZonesRaw', () => {
  it('calculates raw Max HR percentage zones correctly', () => {
    const zones = calculateHeartRateZonesRaw({ method: 'maxhr', maxHR: 190 });
    expect(zones).not.toBeNull();
    expect(zones).toHaveLength(5);

    expect(zones![0]).toEqual({
      zone: 'z1',
      low: 95,
      high: 114,
      minPercent: 50,
      maxPercent: 60,
    });
    expect(zones![1]).toEqual({
      zone: 'z2',
      low: 115,
      high: 133,
      minPercent: 60,
      maxPercent: 70,
    });
    expect(zones![2]).toEqual({
      zone: 'z3',
      low: 134,
      high: 152,
      minPercent: 70,
      maxPercent: 80,
    });
    expect(zones![3]).toEqual({
      zone: 'z4',
      low: 153,
      high: 171,
      minPercent: 80,
      maxPercent: 90,
    });
    expect(zones![4]).toEqual({
      zone: 'z5',
      low: 172,
      high: 190,
      minPercent: 90,
      maxPercent: 100,
    });
  });

  it('calculates Karvonen (HRR) zones correctly', () => {
    const zones = calculateHeartRateZonesRaw({
      method: 'karvonen',
      maxHR: 190,
      restingHR: 60,
    });
    expect(zones).not.toBeNull();
    expect(zones).toHaveLength(5);

    // HRR = 130
    // Z1: 130 * 0.50 + 60 = 125; 130 * 0.60 + 60 = 138
    expect(zones![0].low).toBe(125);
    expect(zones![0].high).toBe(138);

    // Z2: 139 - 151
    expect(zones![1].low).toBe(139);
    expect(zones![1].high).toBe(151);

    // Z5: 178 - 190
    expect(zones![4].low).toBe(178);
    expect(zones![4].high).toBe(190);
  });

  it('calculates LTHR zones correctly', () => {
    const zones = calculateHeartRateZonesRaw({ method: 'lthr', lthr: 165 });
    expect(zones).not.toBeNull();
    expect(zones).toHaveLength(5);

    // Z1: < 85% LTHR (85% of 165 = 140.25 -> 140 -> high 139)
    expect(zones![0].low).toBe(0);
    expect(zones![0].high).toBe(139);
    expect(zones![0].isLowerOpen).toBe(true);

    // Z2: 85 - 89% LTHR -> 140 - 148 (contiguous with Z3)
    expect(zones![1].low).toBe(140);
    expect(zones![1].high).toBe(148);

    // Z3: 90 - 94% LTHR -> 149 - 156 (contiguous with Z4)
    expect(zones![2].low).toBe(149);
    expect(zones![2].high).toBe(156);

    // Z4: 95 - 99% LTHR -> 157 - 164 (contiguous with Z5)
    expect(zones![3].low).toBe(157);
    expect(zones![3].high).toBe(164);

    // Z5: >= 100% LTHR -> low 165, high null
    expect(zones![4].low).toBe(165);
    expect(zones![4].high).toBeNull();
    expect(zones![4].isUpperOpen).toBe(true);

    // Assert that every integer heart rate from 135 to 170 is covered contiguously
    expect(zones![0].high + 1).toBe(zones![1].low);
    expect(zones![1].high! + 1).toBe(zones![2].low);
    expect(zones![2].high! + 1).toBe(zones![3].low);
    expect(zones![3].high! + 1).toBe(zones![4].low);
  });

  it('handles invalid inputs gracefully by returning null', () => {
    expect(calculateHeartRateZonesRaw({ method: 'maxhr', maxHR: 40 })).toBeNull();
    expect(calculateHeartRateZonesRaw({ method: 'maxhr', maxHR: NaN })).toBeNull();
    expect(
      calculateHeartRateZonesRaw({ method: 'karvonen', maxHR: 160, restingHR: 170 })
    ).toBeNull();
    expect(
      calculateHeartRateZonesRaw({ method: 'karvonen', maxHR: 190, restingHR: 15 })
    ).toBeNull();
    expect(calculateHeartRateZonesRaw({ method: 'lthr', lthr: 20 })).toBeNull();
  });
});

describe('calculateHeartRateZones (presentation)', () => {
  it('formats English zones with app colors and descriptions', () => {
    const res = calculateHeartRateZones(
      { method: 'karvonen', maxHR: 190, restingHR: 60 },
      { locale: 'en' }
    );
    expect(res).not.toBeNull();
    expect(res!.method).toBe('karvonen');
    expect(res!.zones[1].name).toBe('Zone 2');
    expect(res!.zones[1].categoryName).toBe('Easy / Aerobic');
    expect(res!.zones[1].bpmFormatted).toBe('139 - 151 bpm');
    expect(res!.zones[1].pctFormatted).toBe('60 - 70%');
    expect(res!.zones[1].basisFormatted).toBe('of HRR');
    expect(res!.zones[1].color.main).toBe('#34c759');
  });

  it('formats Chinese zones with Chinese category names and basis labels', () => {
    const res = calculateHeartRateZones(
      { method: 'lthr', lthr: 165 },
      { locale: 'zh' }
    );
    expect(res).not.toBeNull();
    expect(res!.zones[0].categoryName).toBe('恢复排酸');
    expect(res!.zones[0].bpmFormatted).toBe('< 139 bpm');
    expect(res!.zones[0].pctFormatted).toBe('< 85%');
    expect(res!.zones[0].basisFormatted).toBe('LTHR 比例');

    expect(res!.zones[4].categoryName).toBe('无氧极限');
    expect(res!.zones[4].bpmFormatted).toBe('≥ 165 bpm');
    expect(res!.zones[4].pctFormatted).toBe('>= 100%');
  });
});
