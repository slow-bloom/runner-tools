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

  it('handles empty input gracefully', () => {
    const merged = mergeActivities([]);
    expect(merged.points).toHaveLength(0);
    expect(merged.summary.distance).toBe(0);
  });
});
