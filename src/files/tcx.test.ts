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
    expect(activity.recordedLaps).toEqual([{
      startTime: new Date('2026-03-01T07:00:00Z'),
      endTime: new Date('2026-03-01T07:00:10Z'),
      distance: 4000,
      endTimeBasis: 'last-sample',
    }]);
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

  it('aggregates all laps in multi-lap TCX activities', () => {
    const multiLapTcx = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Running">
      <Id>2026-03-01T07:00:00Z</Id>
      <Lap StartTime="2026-03-01T07:00:00Z">
        <TotalTimeSeconds>300.0</TotalTimeSeconds>
        <DistanceMeters>1000.0</DistanceMeters>
        <Cadence>180</Cadence>
      </Lap>
      <Lap StartTime="2026-03-01T07:05:00Z">
        <TotalTimeSeconds>300.0</TotalTimeSeconds>
        <DistanceMeters>1000.0</DistanceMeters>
        <Cadence>184</Cadence>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

    const act = parseTCX(multiLapTcx);
    // Two 1000m / 300s laps must produce 2000m / 600s totals
    expect(act.summary.distance).toBe(2000);
    expect(act.summary.duration).toBe(600);
    expect(act.summary.avgCadence).toBe(182);
  });

  it('emits mandatory schema elements (Calories, Intensity) and omits invalid Device_t creator', () => {
    const points = [
      { lat: 31.2, lon: 121.4, ele: 10, time: new Date('2026-03-01T07:00:00Z'), hr: 140, cad: 180, distance: 5000 },
    ];
    const xml = serializeToTCX(points);
    expect(xml).toContain('<Calories>');
    expect(xml).toContain('<Intensity>Active</Intensity>');
    expect(xml).toContain('<TriggerMethod>Manual</TriggerMethod>');
    // Must NOT contain invalid partial Device_t without UnitId/ProductID
    expect(xml).not.toContain('<Creator xsi:type="Device_t">');
  });

  it('safely serializes with invalid Date(NaN) timestamps without throwing RangeError', () => {
    const points = [
      { lat: 31.2, lon: 121.4, ele: 10, time: new Date(NaN), hr: 140, cad: 180, distance: 0 },
    ];
    expect(() => serializeToTCX(points)).not.toThrow();
  });

  it('returns localized defaultName on successful parse when locale is provided', () => {
    const act = parseTCX(SAMPLE_TCX, { locale: 'zh-CN' });
    expect(act.name).toBe('运动记录');
  });

  it('serializes 0 calories by default or caller-supplied calories without inventing estimations', () => {
    const points = [
      { lat: 31.2, lon: 121.4, ele: 10, time: new Date('2026-03-01T07:00:00Z'), hr: 140, cad: 180, distance: 10000 },
    ];
    // Default should be 0 (unknown/unmeasured), NOT 600 kcal
    const defaultXml = serializeToTCX(points);
    expect(defaultXml).toContain('<Calories>0</Calories>');

    // Caller-supplied calories must be honored
    const customXml = serializeToTCX(points, { calories: 520 });
    expect(customXml).toContain('<Calories>520</Calories>');
  });

  it('calculates trackpoint average cadence when lap-level cadence is absent, without trackpoints corrupting lap summary', () => {
    const tcxWithoutLapCadence = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Running">
      <Id>2026-03-01T07:00:00Z</Id>
      <Lap StartTime="2026-03-01T07:00:00Z">
        <TotalTimeSeconds>100.0</TotalTimeSeconds>
        <DistanceMeters>300.0</DistanceMeters>
        <Track>
          <Trackpoint>
            <Time>2026-03-01T07:00:00Z</Time>
            <DistanceMeters>0.0</DistanceMeters>
            <Cadence>180</Cadence>
          </Trackpoint>
          <Trackpoint>
            <Time>2026-03-01T07:00:50Z</Time>
            <DistanceMeters>150.0</DistanceMeters>
            <Cadence>200</Cadence>
          </Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

    const act = parseTCX(tcxWithoutLapCadence);
    // Point cadences 180 and 200 must yield 190 (mean), NOT 180 (from first trackpoint)
    expect(act.summary.avgCadence).toBe(190);
  });
});
