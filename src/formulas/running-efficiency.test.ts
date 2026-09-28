import { describe, expect, it } from 'vitest';
import {
  calculateDutyFactor,
  calculateEfficiencyFactor,
  calculateRunningEfficiency,
  calculateVerticalRatio,
  getDutyFactorLevel,
  getEfficiencyFactorLevel,
  getVerticalRatioLevel,
  paceToSpeed,
} from './running-efficiency.js';

describe('calculateVerticalRatio', () => {
  it('calculates vertical ratio correctly', () => {
    // 8.2 cm VO, 1.15 m stride length
    const vr = calculateVerticalRatio(8.2, 1.15);
    expect(vr).not.toBeNull();
    expect(vr!).toBeCloseTo(7.1304, 4);
  });

  it('returns null on invalid inputs', () => {
    expect(calculateVerticalRatio(-1, 1.2)).toBeNull();
    expect(calculateVerticalRatio(8.0, 0)).toBeNull();
    expect(calculateVerticalRatio(NaN, 1.0)).toBeNull();
  });
});

describe('calculateDutyFactor', () => {
  it('calculates duty factor percentage correctly', () => {
    // 175 spm, 235 ms GCT
    const df = calculateDutyFactor(175, 235);
    expect(df).not.toBeNull();
    expect(df!).toBeCloseTo(34.2708, 4);
  });

  it('returns null on invalid inputs', () => {
    expect(calculateDutyFactor(0, 200)).toBeNull();
    expect(calculateDutyFactor(180, -10)).toBeNull();
  });
});

describe('paceToSpeed & calculateEfficiencyFactor', () => {
  it('converts min/km pace to speed in m/s and km/h', () => {
    // 5:00 min/km = 300s
    const speed = paceToSpeed(300, 'km');
    expect(speed).not.toBeNull();
    expect(speed!.speedMs).toBeCloseTo(3.3333, 4);
    expect(speed!.speedKmh).toBeCloseTo(12.0, 1);
  });

  it('converts min/mi pace to speed in m/s', () => {
    // 8:00 min/mi = 480s
    const speed = paceToSpeed(480, 'mi');
    expect(speed).not.toBeNull();
    expect(speed!.speedMs).toBeCloseTo(3.3528, 4);
  });

  it('calculates Efficiency Factor (EF) in meters per beat', () => {
    // 3.3333 m/s, 145 bpm -> (3.3333 * 60) / 145 = 1.3793 m/beat
    const ef = calculateEfficiencyFactor(3.3333, 145);
    expect(ef).not.toBeNull();
    expect(ef!).toBeCloseTo(1.3793, 4);
  });
});

describe('level classifications', () => {
  it('classifies vertical ratio levels correctly', () => {
    expect(getVerticalRatioLevel(5.5, { locale: 'en' }).key).toBe('elite');
    expect(getVerticalRatioLevel(7.1, { locale: 'en' }).key).toBe('advanced');
    expect(getVerticalRatioLevel(9.0, { locale: 'en' }).key).toBe('average');
    expect(getVerticalRatioLevel(11.0, { locale: 'en' }).key).toBe('needsImprovement');
  });

  it('classifies duty factor levels correctly', () => {
    expect(getDutyFactorLevel(28.0, { locale: 'en' }).key).toBe('elite');
    expect(getDutyFactorLevel(34.0, { locale: 'en' }).key).toBe('advanced');
    expect(getDutyFactorLevel(45.0, { locale: 'en' }).key).toBe('recreational');
  });

  it('classifies efficiency factor levels correctly in English and Chinese', () => {
    const enEf = getEfficiencyFactorLevel(1.38, { locale: 'en' });
    expect(enEf.key).toBe('advanced');
    expect(enEf.label).toContain('Advanced Aerobic Engine');

    const zhEf = getEfficiencyFactorLevel(1.25, { locale: 'zh' });
    expect(zhEf.key).toBe('solid');
    expect(zhEf.label).toContain('扎实有氧平台期');
  });
});

describe('calculateRunningEfficiency (presentation)', () => {
  it('formats full form economy and aerobic efficiency in English', () => {
    const res = calculateRunningEfficiency(
      {
        verticalOscillationCm: 8.2,
        strideLengthM: 1.15,
        cadenceSpm: 175,
        groundContactTimeMs: 235,
        paceSeconds: 300,
        paceUnit: 'km',
        heartRateBpm: 145,
      },
      { locale: 'en' }
    );

    expect(res.formEconomy).not.toBeNull();
    expect(res.formEconomy!.verticalRatioFormatted).toBe('7.1%');
    expect(res.formEconomy!.dutyFactorFormatted).toBe('34.3%');

    expect(res.aerobicEfficiency).not.toBeNull();
    expect(res.aerobicEfficiency!.efficiencyFactorFormatted).toBe('1.38 m/beat');
    expect(res.aerobicEfficiency!.speedDisplay).toContain('3.33 m/s');
    expect(res.aerobicEfficiency!.speedDisplay).toContain('12.0 km/h');
  });

  it('formats full efficiency results in Chinese', () => {
    const res = calculateRunningEfficiency(
      {
        paceSeconds: 300,
        paceUnit: 'km',
        heartRateBpm: 145,
      },
      { locale: 'zh' }
    );

    expect(res.formEconomy).toBeNull();
    expect(res.aerobicEfficiency).not.toBeNull();
    expect(res.aerobicEfficiency!.efficiencyFactorFormatted).toBe('1.38 米/跳');
    expect(res.aerobicEfficiency!.speedDisplay).toContain('米/秒');
    expect(res.aerobicEfficiency!.speedDisplay).toContain('公里/小时');
  });
});
