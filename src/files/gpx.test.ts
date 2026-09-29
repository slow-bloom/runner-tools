import { describe, it, expect } from 'vitest';
import { parseGPX, serializeToGPX } from './gpx.js';
import type { Activity } from './types.js';

describe('GPX Parser & Serializer', () => {
  const SAMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ApexRun" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <metadata>
    <name>Morning 5K</name>
    <time>2026-03-01T06:30:00Z</time>
  </metadata>
  <trk>
    <name>Morning 5K</name>
    <type>running</type>
    <trkseg>
      <trkpt lat="39.908700" lon="116.397500">
        <ele>45.20</ele>
        <time>2026-03-01T06:30:00Z</time>
        <extensions>
          <gpxtpx:TrackPointExtension>
            <gpxtpx:hr>142</gpxtpx:hr>
            <gpxtpx:cad>178</gpxtpx:cad>
          </gpxtpx:TrackPointExtension>
        </extensions>
      </trkpt>
      <trkpt lat="39.910000" lon="116.398000">
        <ele>46.10</ele>
        <time>2026-03-01T06:30:30Z</time>
        <extensions>
          <gpxtpx:TrackPointExtension>
            <gpxtpx:hr>148</gpxtpx:hr>
            <gpxtpx:cad>182</gpxtpx:cad>
          </gpxtpx:TrackPointExtension>
        </extensions>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

  it('parses GPX 1.1 with trackpoint extensions', () => {
    const activity = parseGPX(SAMPLE_GPX);
    expect(activity.name).toBe('Morning 5K');
    expect(activity.points).toHaveLength(2);

    const pt0 = activity.points[0];
    expect(pt0.lat).toBeCloseTo(39.9087, 4);
    expect(pt0.lon).toBeCloseTo(116.3975, 4);
    expect(pt0.ele).toBe(45.2);
    expect(pt0.time?.toISOString()).toBe('2026-03-01T06:30:00.000Z');
    expect(pt0.hr).toBe(142);
    expect(pt0.cad).toBe(178);
    expect(pt0.distance).toBe(0);

    const pt1 = activity.points[1];
    expect(pt1.hr).toBe(148);
    expect(pt1.cad).toBe(182);
    expect(pt1.distance).toBeGreaterThan(100);

    expect(activity.summary.avgHeartRate).toBe(145);
    expect(activity.summary.avgCadence).toBe(180);
  });

  it('serializes activity to valid GPX format and preserves values round-trip', () => {
    const original = parseGPX(SAMPLE_GPX);
    const serialized = serializeToGPX(original, { name: 'Morning 5K' });

    expect(serialized).toContain('<gpx version="1.1"');
    expect(serialized).toContain('<name>Morning 5K</name>');
    expect(serialized).toContain('<gpxtpx:hr>142</gpxtpx:hr>');
    expect(serialized).toContain('<gpxtpx:cad>178</gpxtpx:cad>');

    const roundTripped = parseGPX(serialized);
    expect(roundTripped.points).toHaveLength(2);
    expect(roundTripped.points[0].lat).toBeCloseTo(39.9087, 4);
    expect(roundTripped.points[0].hr).toBe(142);
    expect(roundTripped.points[0].cad).toBe(178);
  });

  it('handles empty or malformed input gracefully', () => {
    const empty = parseGPX('');
    expect(empty.points).toHaveLength(0);
    expect(empty.name).toBe('Activity');

    const malformed = parseGPX('<gpx><trk><trkseg><trkpt lat="invalid" lon="116.39"></trkpt></trkseg></trk></gpx>');
    expect(malformed.points).toHaveLength(0);
  });

  it('correctly parses self-closing <trkpt .../> elements without point loss', () => {
    const xmlWithSelfClosing = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test">
  <trk>
    <name>Self Closing Track</name>
    <trkseg>
      <trkpt lat="39.908700" lon="116.397500" />
      <trkpt lat="39.910000" lon="116.398000"><ele>50.0</ele></trkpt>
      <trkpt lat="39.912000" lon="116.399000" />
    </trkseg>
  </trk>
</gpx>`;
    const activity = parseGPX(xmlWithSelfClosing);
    expect(activity.points).toHaveLength(3);
    expect(activity.points[0].lat).toBeCloseTo(39.9087, 4);
    expect(activity.points[1].ele).toBe(50.0);
    expect(activity.points[2].lat).toBeCloseTo(39.912, 4);
  });

  it('safely serializes trackpoints with invalid Date(NaN) timestamps without RangeError', () => {
    const points = [
      { lat: 39.9, lon: 116.4, ele: 10, time: new Date(NaN), hr: 140, cad: 180, distance: 0 },
    ];
    expect(() => serializeToGPX(points)).not.toThrow();
    const xml = serializeToGPX(points);
    expect(xml).toContain('<trkpt lat="39.900000" lon="116.400000">');
  });

  it('resolves generated default title through localization', () => {
    const emptyZh = parseGPX('', { locale: 'zh' });
    expect(emptyZh.name).toBe('运动记录');

    const serializedZh = serializeToGPX([{ lat: 39.9, lon: 116.4, ele: 0, time: null, hr: null, cad: null, distance: 0 }], { locale: 'zh' });
    expect(serializedZh).toContain('<name>运动记录</name>');
  });
});
