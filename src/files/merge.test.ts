import { describe, it, expect } from 'vitest';
import { mergeActivities } from './merge.js';
import type { Activity } from './types.js';
import { calculateActivitySummary } from './geo.js';

describe('Activity Merge', () => {
  it('combines multiple activities chronologically and aligns cumulative distance', () => {
    const act1: Activity = {
      name: 'Part 1',
      points: [
        { lat: 0, lon: 0, ele: 0, time: new Date('2026-03-01T08:00:00Z'), hr: 140, cad: 180, distance: 0 },
        { lat: 0, lon: 0, ele: 0, time: new Date('2026-03-01T08:05:00Z'), hr: 145, cad: 180, distance: 1000 },
      ],
      summary: calculateActivitySummary([]),
    };

    const act2: Activity = {
      name: 'Part 2',
      points: [
        { lat: 0, lon: 0, ele: 0, time: new Date('2026-03-01T08:05:30Z'), hr: 150, cad: 182, distance: 0 },
        { lat: 0, lon: 0, ele: 0, time: new Date('2026-03-01T08:10:30Z'), hr: 155, cad: 182, distance: 1000 },
      ],
      summary: calculateActivitySummary([]),
    };

    const merged = mergeActivities([act1, act2], { name: 'Full Run' });
    expect(merged.name).toBe('Full Run');
    expect(merged.points).toHaveLength(4);
    // Cumulative distance should seamlessly continue from 1000 to 2000
    expect(merged.points[0].distance).toBe(0);
    expect(merged.points[1].distance).toBe(1000);
    expect(merged.points[2].distance).toBe(1000);
    expect(merged.points[3].distance).toBe(2000);
    expect(merged.summary.distance).toBe(2000);
  });

  it('handles empty input gracefully and supports localized titles', () => {
    const mergedDefault = mergeActivities([]);
    expect(mergedDefault.points).toHaveLength(0);
    expect(mergedDefault.name).toBe('Empty Activity');

    const mergedZh = mergeActivities([], { locale: 'zh' });
    expect(mergedZh.name).toBe('空活动');
  });

  it('correctly orders mixed dated and undated points without generating negative elapsed time', () => {
    // Array with time offsets: [10s, null, 0s, 1s]
    const baseDate = new Date('2026-03-01T08:00:00Z');
    const act: Activity = {
      name: 'Unordered Run',
      points: [
        { lat: 0, lon: 0, ele: 0, time: new Date(baseDate.getTime() + 10000), hr: null, cad: null, distance: 0 },
        { lat: 0, lon: 0, ele: 0, time: null, hr: null, cad: null, distance: 0 },
        { lat: 0, lon: 0, ele: 0, time: new Date(baseDate.getTime() + 0), hr: null, cad: null, distance: 0 },
        { lat: 0, lon: 0, ele: 0, time: new Date(baseDate.getTime() + 1000), hr: null, cad: null, distance: 0 },
      ],
      summary: calculateActivitySummary([]),
    };

    const merged = mergeActivities([act], { sortChronologically: true });
    // First dated point must be 0s, followed by 1s, then 10s
    expect(merged.points[0].time?.getTime()).toBe(baseDate.getTime());
    expect(merged.points[1].time?.getTime()).toBe(baseDate.getTime() + 1000);
    expect(merged.points[2].time?.getTime()).toBe(baseDate.getTime() + 10000);
    expect(merged.points[3].time).toBeNull();

    // Elapsed time between dated points must be positive (10s), NOT -9s
    const datedPoints = merged.points.filter((p) => p.time !== null);
    const elapsed =
      (datedPoints[datedPoints.length - 1].time!.getTime() - datedPoints[0].time!.getTime()) / 1000;
    expect(elapsed).toBe(10);
  });

  it('resolves merged activity title using localized suffix', () => {
    const act1: Activity = {
      name: '晨跑',
      points: [],
      summary: calculateActivitySummary([]),
    };
    const act2: Activity = {
      name: '加练',
      points: [],
      summary: calculateActivitySummary([]),
    };
    const mergedZh = mergeActivities([act1, act2], { locale: 'zh' });
    expect(mergedZh.name).toBe('晨跑 (合并)');
  });
});
