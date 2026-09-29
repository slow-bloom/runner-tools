import { describe, it, expect } from 'vitest';
import { parseTCX, serializeToTCX } from './tcx.js';

describe('TCX Parser & Serializer', () => {
  const SAMPLE_TCX = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Running">
      <Id>2026-03-01T07:00:00Z</Id>
      <Lap StartTime="2026-03-01T07:00:00Z">
        <TotalTimeSeconds>1200.0</TotalTimeSeconds>
        <DistanceMeters>4000.0</DistanceMeters>
        <Cadence>180</Cadence>
        <Track>
          <Trackpoint>
            <Time>2026-03-01T07:00:00Z</Time>
            <Position>
              <LatitudeDegrees>31.230400</LatitudeDegrees>
              <LongitudeDegrees>121.473700</LongitudeDegrees>
            </Position>
            <AltitudeMeters>12.50</AltitudeMeters>
            <DistanceMeters>0.0</DistanceMeters>
            <HeartRateBpm>
              <Value>138</Value>
            </HeartRateBpm>
            <Cadence>176</Cadence>
          </Trackpoint>
          <Trackpoint>
            <Time>2026-03-01T07:00:10Z</Time>
            <Position>
              <LatitudeDegrees>31.230700</LatitudeDegrees>
              <LongitudeDegrees>121.474000</LongitudeDegrees>
            </Position>
            <AltitudeMeters>12.80</AltitudeMeters>
            <DistanceMeters>42.0</DistanceMeters>
            <HeartRateBpm>
              <Value>142</Value>
            </HeartRateBpm>
            <Cadence>180</Cadence>
          </Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

  it('parses Garmin TCX 2.0 with laps and metrics', () => {
    const activity = parseTCX(SAMPLE_TCX);
    expect(activity.points).toHaveLength(2);

    const pt0 = activity.points[0];
    expect(pt0.lat).toBeCloseTo(31.2304, 4);
    expect(pt0.lon).toBeCloseTo(121.4737, 4);
    expect(pt0.ele).toBe(12.5);
    expect(pt0.hr).toBe(138);
    expect(pt0.cad).toBe(176);

    const pt1 = activity.points[1];
    expect(pt1.hr).toBe(142);
    expect(pt1.distance).toBe(42.0);

    expect(activity.summary.sport).toBe('running');
  });

  it('serializes activity to valid TCX format and round-trips metrics', () => {
    const original = parseTCX(SAMPLE_TCX);
    const serialized = serializeToTCX(original);

    expect(serialized).toContain('<TrainingCenterDatabase');
    expect(serialized).toContain('<Activity Sport="Running">');
    expect(serialized).toContain('<LatitudeDegrees>31.230400</LatitudeDegrees>');
    expect(serialized).toContain('<HeartRateBpm>');
    expect(serialized).toContain('<Value>138</Value>');

    const roundTripped = parseTCX(serialized);
    expect(roundTripped.points).toHaveLength(2);
    expect(roundTripped.points[0].lat).toBeCloseTo(31.2304, 4);
    expect(roundTripped.points[0].hr).toBe(138);
    expect(roundTripped.points[1].hr).toBe(142);
  });

  it('handles empty input safely', () => {
    const act = parseTCX('');
    expect(act.points).toHaveLength(0);
    expect(act.summary.distance).toBe(0);
  });
});
