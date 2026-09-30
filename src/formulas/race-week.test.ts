import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRaceWeekCalendar, createRaceWeekPlan, type RaceWeekParams } from './race-week.js';
import { KM_PER_MILE } from './pace.js';

const defaults: RaceWeekParams = {
  distanceKm: 21.0975, raceDay: 'sun', weeklyDistance: 50,
  frequency: 5, goalTimeSeconds: 6600, gunTime: '07:30',
};

describe('race-week planning', () => {
  it.each([5, 10, 21.0975, 42.195] as const)('builds a complete week for %s km', (distanceKm) => {
    const plan = createRaceWeekPlan({ ...defaults, distanceKm })!;
    expect(plan.schedule).toHaveLength(7);
    expect(plan.schedule[6].type).toBe('race');
    expect(plan.schedule[6].distanceKm).toBe(distanceKm);
    expect(plan.timeline).toHaveLength(7);
    expect(plan.timeline[0].time).toBe('04:30');
    expect(plan.timeline.at(-1)?.time).toBe('07:30');
    expect(plan.phases).toHaveLength(3);
    expect(plan.schedule.filter((day) => day.dist > 0)).toHaveLength(5);
    expect(plan.schedule.filter((day) => day.type !== 'race').reduce((sum, day) => sum + day.distanceKm, 0))
      .toBeCloseTo(plan.taperDistance, 2);
    expect(plan.taperDistance).toBeLessThanOrEqual(50 * (distanceKm >= 21 ? 0.45 : 0.55));
  });

  it('keeps the physical plan and pace offsets identical when display units change', () => {
    const metric = createRaceWeekPlan(defaults)!;
    const imperial = createRaceWeekPlan({ ...defaults, unit: 'mi', weeklyDistance: 50 / KM_PER_MILE })!;
    expect(imperial.targetPaceSecondsKm).toBe(metric.targetPaceSecondsKm);
    imperial.schedule.forEach((day, index) => expect(day.distanceKm).toBeCloseTo(metric.schedule[index].distanceKm, 8));
    expect(imperial.phases[0].targetPace).not.toBe(metric.phases[0].targetPace);
    expect(imperial.cutPercent).toBe(metric.cutPercent);
  });

  it('supports Saturday racing, low volume and fewer training days without increasing baseline load', () => {
    for (const frequency of [2, 3, 4, 5, 6, 7]) {
      const plan = createRaceWeekPlan({ ...defaults, raceDay: 'sat', weeklyDistance: 10, frequency })!;
      expect(plan.schedule[5].type).toBe('race');
      expect(plan.schedule[6].tag).toBe('D+1');
      expect(plan.schedule.filter((day) => day.dist > 0).length).toBeLessThanOrEqual(frequency);
      expect(plan.taperDistance).toBeLessThanOrEqual(4.5);
    }
  });

  it('handles midnight countdowns and afternoon starts without incorrect AM labels', () => {
    const early = createRaceWeekPlan({ ...defaults, gunTime: '01:30' })!;
    expect(early.timeline[0]).toMatchObject({ time: '22:30', dayOffset: -1 });
    const late = createRaceWeekPlan({ ...defaults, gunTime: '15:45' })!;
    expect(late.timeline[0].time).toBe('12:45');
    expect(late.timeline.at(-1)?.time).toBe('15:45');
  });

  it('localizes all generated day, nutrition and pace text', () => {
    const plan = createRaceWeekPlan({ ...defaults, locale: 'zh-CN' })!;
    expect(plan.schedule[0].name).toBe('星期一');
    expect(plan.targetPaceDisplay).toContain('公里');
    expect(plan.alternatePaceDisplay).toContain('公里/小时');
    expect(plan.fueling.title).toContain('半马');
    expect(plan.disclaimer).toContain('模板');
  });

  it.each([
    { weeklyDistance: 0 }, { weeklyDistance: Infinity }, { weeklyDistance: 501 },
    { goalTimeSeconds: -1 }, { goalTimeSeconds: 1 }, { frequency: 2.5 }, { frequency: 8 },
    { gunTime: '24:00' }, { gunTime: '07:60' }, { gunTime: '7:30' },
  ])('rejects invalid planning values %j', (invalid) => {
    expect(createRaceWeekPlan({ ...defaults, ...invalid })).toBeNull();
  });
});

describe('race-week calendar', () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it('writes four RFC 5545 events with stable IDs, timestamps and the actual goal duration', () => {
    vi.stubEnv('TZ', 'UTC');
    const plan = createRaceWeekPlan(defaults)!;
    const now = new Date('2026-09-29T08:00:00Z');
    const before = now.getTime();
    const ics = createRaceWeekCalendar(plan, { now });
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(4);
    expect(ics.match(/UID:/g)).toHaveLength(4);
    expect(ics.match(/DTSTAMP:20260929T080000Z/g)).toHaveLength(4);
    expect(ics).toContain('DTSTART:20261004T073000Z');
    expect(ics).toContain('DTEND:20261004T092000Z');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
    expect(createRaceWeekCalendar(plan, { now })).toBe(ics);
    expect(now.getTime()).toBe(before);
  });

  it('uses the next week on the race weekday and handles the local daylight-saving transition', () => {
    vi.stubEnv('TZ', 'America/New_York');
    const plan = createRaceWeekPlan(defaults)!;
    const ics = createRaceWeekCalendar(plan, { now: new Date('2026-03-06T12:00:00-05:00') });
    expect(ics).toContain('DTSTART:20260308T113000Z');
    expect(ics).toContain('DTSTART:20260307T210000Z');
    const following = createRaceWeekCalendar(plan, { now: new Date('2026-03-08T06:00:00-04:00') });
    expect(following).toContain('DTSTART:20260315T113000Z');
  });

  it('escapes text and folds UTF-8 without splitting characters', () => {
    const plan = createRaceWeekPlan({ ...defaults, locale: 'zh' })!;
    plan.raceTitle = '长跑,测试;计划\\日历\n新行'.repeat(10);
    const ics = createRaceWeekCalendar(plan, { now: new Date('2026-09-29T08:00:00Z') });
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain('\\,');
    expect(unfolded).toContain('\\;');
    expect(unfolded).toContain('\\\\');
    expect(unfolded).toContain('\\n');
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics).not.toContain('\uFFFD');
    expect(() => createRaceWeekCalendar(plan, { now: new Date(NaN) })).toThrow(/valid calendar/);
  });
});
