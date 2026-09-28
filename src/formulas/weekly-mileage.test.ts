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
  });
});
