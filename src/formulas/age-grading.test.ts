import { describe, expect, it } from 'vitest';
import {
  calculateAgeGrading,
  calculateAgeGradingRaw,
  getAgeGradingLevel,
  normalizeDistanceKey,
  normalizeGender,
} from './age-grading.js';

describe('normalizeGender & normalizeDistanceKey', () => {
  it('normalizes gender inputs correctly', () => {
    expect(normalizeGender('M')).toBe('M');
    expect(normalizeGender('male')).toBe('M');
    expect(normalizeGender('F')).toBe('F');
    expect(normalizeGender('female')).toBe('F');
    expect(normalizeGender('other')).toBeNull();
  });

  it('normalizes distance inputs flexibly', () => {
    expect(normalizeDistanceKey(5000)).toBe('5000');
    expect(normalizeDistanceKey('5k')).toBe('5000');
    expect(normalizeDistanceKey('10000')).toBe('10000');
    expect(normalizeDistanceKey('halfmarathon')).toBe('21097');
    expect(normalizeDistanceKey(21097)).toBe('21097');
    expect(normalizeDistanceKey('marathon')).toBe('42195');
    expect(normalizeDistanceKey(42195)).toBe('42195');
    expect(normalizeDistanceKey('unknown')).toBeNull();
  });
});

describe('calculateAgeGradingRaw', () => {
  it('calculates raw WMA 2020 age grading score for Male 40 Half Marathon', () => {
    // 1h 49m 0s = 6540s
    const res = calculateAgeGradingRaw({
      gender: 'M',
      age: 40,
      distance: '21097',
      timeSeconds: 6540,
    });

    expect(res).not.toBeNull();
    expect(res!.gender).toBe('M');
    expect(res!.age).toBe(40);
    expect(res!.openStandardSeconds).toBe(3503);
    expect(res!.ageStandardSeconds).toBeGreaterThan(res!.openStandardSeconds);
    expect(res!.score).toBeCloseTo((res!.ageStandardSeconds / 6540) * 100, 4);
    expect(res!.ageEquivalentSeconds).toBeCloseTo(6540 * (res!.openStandardSeconds / res!.ageStandardSeconds), 4);
  });

  it('returns null on invalid or out-of-bounds inputs', () => {
    expect(
      calculateAgeGradingRaw({
        gender: 'M',
        age: 3, // < 5
        distance: '5000',
        timeSeconds: 1200,
      })
    ).toBeNull();

    expect(
      calculateAgeGradingRaw({
        gender: 'M',
        age: 105, // > 100
        distance: '5000',
        timeSeconds: 1200,
      })
    ).toBeNull();

    expect(
      calculateAgeGradingRaw({
        gender: 'M',
        age: 40,
        distance: '5000',
        timeSeconds: -50,
      })
    ).toBeNull();
  });
});

describe('getAgeGradingLevel', () => {
  it('classifies levels properly according to WMA percentage thresholds', () => {
    expect(getAgeGradingLevel(92, { locale: 'en' }).key).toBe('worldClass');
    expect(getAgeGradingLevel(92, { locale: 'en' }).label).toBe('World Class');

    expect(getAgeGradingLevel(85, { locale: 'en' }).key).toBe('nationalClass');
    expect(getAgeGradingLevel(75, { locale: 'en' }).key).toBe('regionalClass');
    expect(getAgeGradingLevel(65, { locale: 'en' }).key).toBe('localClass');
    expect(getAgeGradingLevel(55, { locale: 'en' }).key).toBe('activeRunner');
    expect(getAgeGradingLevel(45, { locale: 'en' }).key).toBe('recreationalRunner');
  });

  it('translates levels properly for Chinese locale', () => {
    const zhLevel = getAgeGradingLevel(85, { locale: 'zh' });
    expect(zhLevel.key).toBe('nationalClass');
    expect(zhLevel.label).toBe('国家精英级 (National Class)');
  });
});

describe('calculateAgeGrading (presentation)', () => {
  it('formats output with formatted time, percentage, and level info', () => {
    // Male, age 40, Half Marathon 1:49:00 (6540s)
    const res = calculateAgeGrading(
      {
        gender: 'M',
        age: 40,
        distance: '21097',
        timeSeconds: 6540,
      },
      { locale: 'en' }
    );

    expect(res).not.toBeNull();
    expect(res!.scoreFormatted).toMatch(/^\d+\.\d%$/);
    expect(res!.level.label).toBeDefined();
    expect(res!.ageEquivalentTimeFormatted).toMatch(/^\d+:\d{2}:\d{2}$/);
    expect(res!.openStandardFormatted).toBe('58:23'); // 3503s = 58m 23s
  });
});
