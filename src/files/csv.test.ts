import { describe, it, expect } from 'vitest';
import { serializeToCSV, parseCSV, CSV_HEADER } from './csv.js';
import type { Trackpoint } from './types.js';

describe('CSV Parser & Serializer', () => {
  const points: Trackpoint[] = [
    {
      time: new Date('2026-03-01T08:00:00Z'),
      lat: 39.9,
      lon: 116.4,
      ele: 50.0,
      distance: 0,
      hr: 140,
      cad: 175,
      speed: 3.2,
      power: 240,
    },
    {
      time: new Date('2026-03-01T08:00:10Z'),
      lat: 39.9003,
      lon: 116.4003,
      ele: 50.5,
      distance: 35.0,
      hr: 144,
      cad: 178,
      speed: 3.5,
      power: 250,
    },
  ];

  it('serializes points to CSV format', () => {
    const csv = serializeToCSV(points);
    expect(csv.startsWith(CSV_HEADER)).toBe(true);
    expect(csv).toContain('2026-03-01T08:00:00.000Z,39.900000,116.400000,50.00,0.0,140,175,3.20,240');
  });

  it('parses CSV into structured activity points', () => {
    const csv = serializeToCSV(points);
    const parsed = parseCSV(csv);
    expect(parsed.points).toHaveLength(2);
    expect(parsed.points[0].lat).toBeCloseTo(39.9, 4);
    expect(parsed.points[0].hr).toBe(140);
    expect(parsed.points[1].cad).toBe(178);
    expect(parsed.points[1].power).toBe(250);
  });

  it('correctly decodes quoted CSV fields without losing numeric or date values', () => {
    const quotedCsv = `Timestamp,Latitude,Longitude,Elevation(m),Distance(m),HeartRate(bpm),Cadence(spm),Speed(m/s),Power(w)
"2026-03-01T08:00:00.000Z","39.900000","116.400000","50.00","0.0","140","175","3.20","240"
"2026-03-01T08:00:10.000Z","39.900300","116.400300","50.50","35.0","144","178","3.50","250"`;

    const parsed = parseCSV(quotedCsv);
    expect(parsed.points).toHaveLength(2);
    expect(parsed.points[0].lat).toBeCloseTo(39.9, 4);
    expect(parsed.points[0].lon).toBeCloseTo(116.4, 4);
    expect(parsed.points[0].ele).toBe(50.0);
    expect(parsed.points[0].hr).toBe(140);
    expect(parsed.points[0].cad).toBe(175);
    expect(parsed.points[0].time?.toISOString()).toBe('2026-03-01T08:00:00.000Z');
  });
});
