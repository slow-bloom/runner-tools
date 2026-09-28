import { describe, expect, it } from 'vitest';
import { calculateWeeklyMileagePlan } from './weekly-mileage.js';

describe('Weekly Mileage Plan Calculator', () => {
  it('generates structured weekly mileage ramp-up with deload weeks', () => {
    // 25 km to 50 km at 10% rule with deload every 4 weeks
    const plan = calculateWeeklyMileagePlan({
      currentDistance: 25,
      targetDistance: 50,
      unit: 'km',
      maxWeeklyIncreasePct: 10,
      includeDeload: true,
      deloadFrequency: 4,
      deloadReductionPct: 20,
    });

    expect(plan).not.toBeNull();
    expect(plan!.totalWeeks).toBeGreaterThan(5);
    expect(plan!.weeks[0].distance).toBe(25);
    expect(plan!.weeks[0].status).toBe('base');

    // Week 4 must be a deload week
    const week4 = plan!.weeks[3];
    expect(week4.weekNumber).toBe(4);
    expect(week4.isDeload).toBe(true);
    expect(week4.status).toBe('deload');
    expect(week4.pctChange).toBeLessThan(0);

    // Final week must hit target
    const finalWeek = plan!.weeks[plan!.weeks.length - 1];
    expect(finalWeek.distance).toBe(50);
    expect(finalWeek.isTarget).toBe(true);
    expect(finalWeek.status).toBe('target');
  });

  it('generates ramp-up without deload weeks when disabled', () => {
    const plan = calculateWeeklyMileagePlan({
      currentDistance: 20,
      targetDistance: 40,
      includeDeload: false,
    });

    expect(plan).not.toBeNull();
    // No deload weeks
    const hasDeload = plan!.weeks.some((w) => w.isDeload);
    expect(hasDeload).toBe(false);
  });

  it('supports Chinese status labels correctly', () => {
    const planZh = calculateWeeklyMileagePlan({
      currentDistance: 25,
      targetDistance: 50,
      lang: 'zh',
    });

    expect(planZh).not.toBeNull();
    expect(planZh!.weeks[0].statusLabel).toBe('基准跑量');
    const deload = planZh!.weeks.find((w) => w.isDeload);
    expect(deload!.statusLabel).toBe('减量恢复周');
  });

  it('rejects invalid, negative, or target < current distances with null', () => {
    expect(calculateWeeklyMileagePlan({ currentDistance: 0, targetDistance: 50 })).toBeNull();
    expect(calculateWeeklyMileagePlan({ currentDistance: 50, targetDistance: 20 })).toBeNull();
    expect(calculateWeeklyMileagePlan({ currentDistance: NaN, targetDistance: 50 })).toBeNull();
    // Out of domain bounds [1, 500] and increase [1, 50]
    expect(calculateWeeklyMileagePlan({ currentDistance: 0.01, targetDistance: 1 })).toBeNull();
    expect(calculateWeeklyMileagePlan({ currentDistance: 1, targetDistance: 600 })).toBeNull();
    expect(calculateWeeklyMileagePlan({ currentDistance: 10, targetDistance: 20, maxWeeklyIncreasePct: 0.5 })).toBeNull();
  });

  it('preserves full-precision progression without stalling at small increase percentages', () => {
    // Starting at 1, targeting 1.2, with 1% increase and no deload
    const plan = calculateWeeklyMileagePlan({
      currentDistance: 1,
      targetDistance: 1.2,
      maxWeeklyIncreasePct: 1,
      includeDeload: false,
    });

    expect(plan).not.toBeNull();
    // Must progress through intermediate weeks rather than stalling indefinitely at 1
    expect(plan!.totalWeeks).toBeLessThan(52);
    expect(plan!.weeks[1].distance).toBe(1.01);
    expect(plan!.weeks[plan!.weeks.length - 1].distance).toBe(1.2);
    expect(plan!.weeks[plan!.weeks.length - 1].isTarget).toBe(true);
  });

  it('does not exceed the configured weekly increase cap due to rounding', () => {
    // Starting at 1.5 with 10% cap
    const plan = calculateWeeklyMileagePlan({
      currentDistance: 1.5,
      targetDistance: 5,
      maxWeeklyIncreasePct: 10,
      includeDeload: false,
    });

    expect(plan).not.toBeNull();
    // Week 2 must be 1.65 (not 1.7 which would be a 13.3% increase exceeding the 10% cap)
    const week2 = plan!.weeks[1];
    expect(week2.distance).toBe(1.65);
    expect(week2.pctChange).toBe(10);
    expect(week2.pctChangeFormatted).toBe('+10.0%');
    expect(week2.pctChange).toBeLessThanOrEqual(10);
  });

  it('resolves timeline summary and distance units through the locale dictionary', () => {
    const planZh = calculateWeeklyMileagePlan({
      currentDistance: 25,
      targetDistance: 50,
      lang: 'zh',
    });

    expect(planZh).not.toBeNull();
    expect(planZh!.timelineSummary).toContain('周');
    expect(planZh!.timelineSummary).not.toContain('Weeks');
    expect(planZh!.weeks[0].distanceFormatted).toContain('公里');

    const planCustom = calculateWeeklyMileagePlan({
      currentDistance: 25,
      targetDistance: 50,
      // @ts-expect-error test deep partial override
      lang: { weeklyMileage: { units: { km: '千米' }, labels: { weeks: '个周期' } } },
    });
    expect(planCustom).not.toBeNull();
    expect(planCustom!.timelineSummary).toContain('个周期');
    expect(planCustom!.weeks[0].distanceFormatted).toContain('千米');
  });
});
