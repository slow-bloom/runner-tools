import { describe, expect, it } from 'vitest';
import {
  FileConversionError,
  parseActivityFile,
  processActivities,
  serializeActivity,
} from './converter.js';
import { calculateActivitySummary } from './geo.js';
import type { Activity, FITField, Trackpoint } from './types.js';

function activity(name = 'Run', offsetSeconds = 0): Activity {
  const points: Trackpoint[] = Array.from({ length: 6 }, (_, index) => ({
    lat: 0,
    lon: index * 0.0003,
    ele: 10 + index,
    time: new Date(Date.UTC(2026, 8, 29, 0, 0, offsetSeconds + index * 10)),
    hr: 140 + index,
    cad: 170,
    distance: index * 30,
    speed: 3,
    power: 200 + index,
  }));
  return { name, points, summary: calculateActivitySummary(points) };
}

function activityWithDeveloper(value: number, offsetSeconds = 0): Activity {
  const input = activity('Developer run', offsetSeconds);
  const field = (number: number, value: number): FITField => ({
    number, value, baseType: 2, data: new Uint8Array([value]),
  });
  input.fit = {
    protocolVersion: 0x20,
    profileVersion: 2100,
    messages: [
      { globalMessageNumber: 207, recordIndex: 0, littleEndian: true, fields: [field(3, 0)], developerFields: [] },
      {
        globalMessageNumber: 206, recordIndex: 0, littleEndian: true,
        fields: [
          field(0, 0), field(1, 5), field(2, 0x84),
          { number: 3, value: 'custom', baseType: 7, data: new TextEncoder().encode('custom\0') },
        ],
        developerFields: [],
      },
      { globalMessageNumber: 200, recordIndex: 6, littleEndian: true, fields: [field(0, 42)], developerFields: [] },
    ],
  };
  input.points.forEach((point) => {
    point.sport = 'running';
    point.fit = {
      littleEndian: true,
      fields: [],
      developerFields: [{
        number: 5, developerDataIndex: 0, baseType: 0x84,
        data: new Uint8Array([value, 0]), value,
      }],
    };
  });
  return input;
}

describe('file conversion interface', () => {
  it('retains source laps only when the activity scope and distance data are unchanged', () => {
    const input = activity();
    input.recordedLaps = [{
      startTime: input.points[0].time, endTime: input.points.at(-1)!.time,
      distance: 150, endTimeBasis: 'recorded',
    }];
    expect(processActivities([input]).activity.recordedLaps).toEqual(input.recordedLaps);
    for (const options of [{ cropStartMeters: 30 }, { stripGPS: true }, { forceGpsDistance: true }]) {
      expect(processActivities([input], options).activity.recordedLaps).toBeUndefined();
    }
    expect(processActivities([input, activity('Second', 60)]).activity.recordedLaps).toBeUndefined();
  });

  it('parses binary text uploads and preserves sensors in GPX, TCX and CSV round trips', () => {
    for (const format of ['gpx', 'tcx', 'csv'] as const) {
      const input = activity();
      const file = serializeActivity(input, format);
      expect(file.extension).toBe(format);
      expect(typeof file.data).toBe('string');
      if (typeof file.data !== 'string') throw new Error('Expected text output');
      const parsed = parseActivityFile(new TextEncoder().encode(file.data), format);
      expect(parsed.points).toHaveLength(input.points.length);
      expect(parsed.points[2].hr).toBe(142);
      expect(parsed.points[2].cad).toBe(170);
      expect(parsed.points[2].time).toEqual(input.points[2].time);
    }
  });

  it('parses KML and emits every text download format with the correct media type', () => {
    const input = activity();
    const expected = {
      gpx: 'application/gpx+xml',
      tcx: 'application/vnd.garmin.tcx+xml',
      kml: 'application/vnd.google-earth.kml+xml',
      csv: 'text/csv',
      geojson: 'application/geo+json',
    };
    for (const format of ['gpx', 'tcx', 'kml', 'csv', 'geojson'] as const) {
      const output = serializeActivity(input, format);
      expect(output.mimeType).toBe(expected[format]);
      expect(output.extension).toBe(format);
    }
    const output = serializeActivity(input, 'kml');
    expect(parseActivityFile(output.data, 'kml').points).toHaveLength(6);
  });

  it('keeps localized fallback titles and XML escaping', () => {
    const input = '<gpx><trk><trkseg><trkpt lat="0" lon="0"/></trkseg></trk></gpx>';
    expect(parseActivityFile(input, 'gpx', { locale: 'zh' }).name).toBe('运动记录');
    const named = activity('Run & <recover>');
    const output = serializeActivity(named, 'gpx');
    expect(output.data).toContain('Run &amp; &lt;recover&gt;');
  });

  it('rejects invalid and truncated XML rather than accepting a partial track', () => {
    const invalid = [
      '<gpx><trkpt lat="0" lon="0"/></gpx',
      '<gpx><trk><trkpt lat="0" lon="0"/></gpx>',
      '<tcx><trkpt lat="0" lon="0"/></tcx>',
      '<gpx><trkpt lat="0" lon="0"/></gpx><gpx/>',
      '<!DOCTYPE gpx SYSTEM "https://example.com/remote.dtd"><gpx/>',
      '<![CDATA[outside root]]><gpx/>',
    ];
    for (const input of invalid) {
      expect(() => parseActivityFile(input, 'gpx')).toThrow(FileConversionError);
    }
    expect(() => parseActivityFile('<gpx/>', 'gpx')).toThrow(/No trackpoints/);
    expect(() => parseActivityFile('<gpx><trkpt lat="91" lon="0"/></gpx>', 'gpx')).toThrow(/coordinates/);
    expect(() => parseActivityFile('not a FIT file', 'fit')).toThrow(/binary/);
    expect(() => parseActivityFile(new Uint8Array([0]), 'fit')).toThrow(/Unable to read FIT/);
    expect(() => parseActivityFile(new Uint8Array([255]), 'gpx')).toThrow(/Unable to read GPX/);
    // JavaScript consumers can pass values outside the TypeScript format union.
    // @ts-expect-error Invalid input format.
    expect(() => parseActivityFile('', 'zip')).toThrow(/Unsupported input format/);
    // @ts-expect-error Invalid output format.
    expect(() => serializeActivity(activity(), 'zip')).toThrow(/Unsupported output format/);
    expect(() => serializeActivity({ ...activity(), points: [] }, 'gpx')).toThrow(/no trackpoints/);
  });

  it('accepts XML declarations, namespaces, comments and CDATA names', () => {
    const input = `<?xml version="1.0"?>
      <!-- a comment -->
      <g:gpx xmlns:g="http://www.topografix.com/GPX/1/1">
        <g:trk><g:name><![CDATA[Morning run]]></g:name>
          <g:trkseg><g:trkpt lat="0" lon="0"/></g:trkseg>
        </g:trk>
      </g:gpx>`;
    expect(parseActivityFile(input, 'gpx').name).toBe('Morning run');
  });

  it('preserves a watch summary until distance or time is edited', () => {
    const input = activity();
    input.summary.distance = 160;
    input.summary.duration = 45;
    input.summary.avgHeartRate = 151;
    input.summary.avgPaceSecs = 281.25;
    const result = processActivities([input]);
    expect(result.activity.summary).toEqual(input.summary);
    expect(result.activity.summary).not.toBe(input.summary);
    expect(result.statistics.avgHeartRate).toBe(143);
  });

  it('uses the selected activity, chronological merging and all recorded summaries', () => {
    const first = activity('First');
    const second = activity('Second', 60);
    first.summary.distance = 160;
    second.summary.distance = 170;
    expect(processActivities([second]).activity.name).toBe('Second');
    const merged = processActivities([second, first]).activity;
    expect(merged.points[0].time).toEqual(first.points[0].time);
    expect(merged.points.at(-1)?.time).toEqual(second.points.at(-1)?.time);
    expect(merged.summary.distance).toBe(330);
    expect(merged.summary.duration).toBe(100);
    expect(merged.summary.totalElapsedTime).toBe(110);
  });

  it('rebases crops and recomputes summaries instead of exporting stale watch totals', () => {
    const input = activity();
    input.summary.distance = 2000;
    input.summary.duration = 600;
    const original = structuredClone(input);
    const cropped = processActivities([input], { cropStartMeters: 30, cropEndMeters: 30 }).activity;
    expect(cropped.points.map((point) => point.distance)).toEqual([0, 30, 60, 90]);
    expect(cropped.summary.distance).toBe(90);
    expect(cropped.summary.duration).toBe(30);
    expect(cropped.summary.totalElapsedTime).toBe(30);
    const tcx = parseActivityFile(serializeActivity(cropped, 'tcx').data, 'tcx');
    expect(tcx.summary.distance).toBe(90);
    expect(tcx.summary.duration).toBe(30);
    expect(input).toEqual(original);
  });

  it('recalculates distance from GPS before cropping or removing coordinates', () => {
    const input = activity();
    const result = processActivities([input], { forceGpsDistance: true, stripGPS: true });
    expect(result.activity.summary.distance).toBeCloseTo(166.79, 1);
    expect(result.activity.summary.duration).toBe(50);
    expect(result.activity.points.every((point) => point.lat === null && point.lon === null)).toBe(true);
    expect(result.activity.points[3].hr).toBe(143);
    expect(input.points[3].lat).toBe(0);
    for (const format of ['tcx', 'csv'] as const) {
      const parsed = parseActivityFile(serializeActivity(result.activity, format).data, format);
      expect(parsed.points).toHaveLength(6);
      expect(parsed.points.every((point) => point.lat === null && point.lon === null)).toBe(true);
    }
  });

  it('rejects empty crops, invalid distances and location-only exports without GPS', () => {
    const input = activity();
    expect(() => processActivities([])).toThrow(/Select an activity/);
    expect(() => processActivities([input], { cropStartMeters: -1 })).toThrow(/non-negative/);
    expect(() => processActivities([input], { cropEndMeters: NaN })).toThrow(/finite/);
    expect(() => processActivities([input], { cropStartMeters: 999 })).toThrow(/every trackpoint/);
    const redacted = processActivities([input], { stripGPS: true }).activity;
    expect(() => processActivities([redacted], { forceGpsDistance: true })).toThrow(/coordinate samples/);
    for (const format of ['gpx', 'kml', 'geojson'] as const) {
      expect(() => serializeActivity(redacted, format)).toThrow(/GPS coordinates/);
    }
  });

  it('requires an explicit start time for FIT exports of undated tracks', () => {
    const input = activity();
    input.points.forEach((point) => { point.time = null; });
    expect(() => serializeActivity(input, 'fit')).toThrow(/explicit startTime/);
    const output = serializeActivity(input, 'fit', { startTime: new Date('2026-09-29T00:00:00Z') });
    const parsed = parseActivityFile(output.data, 'fit');
    expect(parsed.points.every((point) => point.time === null)).toBe(true);
    expect(() => serializeActivity(input, 'fit', { startTime: new Date(NaN) })).toThrow(/valid date/);
  });

  it('preserves opaque FIT data on unedited conversions without mutating it', () => {
    const input = activityWithDeveloper(123);
    const before = structuredClone(input);
    const result = processActivities([input]);
    expect(result.warnings).toEqual([]);
    expect(result.activity.fit).toEqual(input.fit);
    const parsed = parseActivityFile(serializeActivity(result.activity, 'fit').data, 'fit');
    expect(parsed.points[0].fit?.developerFields[0].value).toBe(123);
    expect(input).toEqual(before);
  });

  it('removes opaque location-bearing fields from both scopes during privacy edits', () => {
    const input = activityWithDeveloper(123);
    input.summary.totalCalories = 800;
    input.summary.totalCycles = 4000;
    for (const options of [{ stripGPS: true }, { cropStartMeters: 30 }]) {
      const result = processActivities([input], options);
      expect(result.warnings).toContain('opaque-fit-data-removed');
      expect(result.activity.fit).toBeUndefined();
      expect(result.activity.points.every((point) => point.fit === undefined)).toBe(true);
      const parsed = parseActivityFile(serializeActivity(result.activity, 'fit').data, 'fit');
      expect(parsed.points.every((point) => point.fit?.developerFields.length === 0)).toBe(true);
      expect(parsed.fit?.messages.some((message) => message.globalMessageNumber === 200)).toBe(false);
      if ('stripGPS' in options) {
        expect(parsed.points.every((point) => point.lat === null && point.lon === null)).toBe(true);
        expect(parsed.summary.totalCalories).toBe(800);
      } else {
        expect(result.activity.summary.totalCalories).toBeUndefined();
        expect(result.activity.summary.totalCycles).toBeUndefined();
        expect(parsed.summary.distance).toBe(120);
      }
    }
    expect(input.points[0].fit?.developerFields[0].value).toBe(123);
  });

  it('remaps colliding developer indexes while merging files and retains measurements', () => {
    const first = activityWithDeveloper(123);
    const second = activityWithDeveloper(234, 60);
    first.summary.totalCalories = 20;
    second.summary.totalCalories = 30;
    const result = processActivities([first, second]);
    expect(result.warnings).toContain('fit-summary-metadata-removed');
    expect(result.activity.fit?.messages).toHaveLength(4);
    expect(result.activity.summary.totalCalories).toBe(50);
    expect(result.activity.points[0].fit?.developerFields[0].developerDataIndex).toBe(0);
    expect(result.activity.points[6].fit?.developerFields[0].developerDataIndex).toBe(1);
    const parsed = parseActivityFile(serializeActivity(result.activity, 'fit').data, 'fit');
    expect(parsed.points[0].fit?.developerFields[0].value).toBe(123);
    expect(parsed.points[6].fit?.developerFields[0].value).toBe(234);
    expect(second.points[0].fit?.developerFields[0].developerDataIndex).toBe(0);
  });

  it('retains record-level developer fields when recalculating GPS distance and stripping laps', () => {
    const input = activityWithDeveloper(123);
    input.summary.totalCycles = 100;
    input.summary.totalCalories = 20;
    const result = processActivities([input], { forceGpsDistance: true });
    expect(result.activity.summary.avgStepLength).toBeCloseTo(833.95, 1);
    expect(result.activity.summary.avgSpeed).toBeCloseTo(3.3358, 3);
    const parsed = parseActivityFile(serializeActivity(result.activity, 'fit', { stripLaps: true }).data, 'fit');
    expect(parsed.points[0].fit?.developerFields[0].value).toBe(123);
    expect(parsed.fit?.messages.some((message) => message.globalMessageNumber === 19)).toBe(false);
    expect(parsed.summary.totalCycles).toBe(100);
  });

  it('preserves normalized low cadence and recomputes running dynamics for cropped FIT points', () => {
    const input = activityWithDeveloper(123);
    input.points.forEach((point) => {
      point.cad = 90;
      point.stepLength = 900;
      point.verticalOscillation = 80;
      point.stanceTime = 250;
      point.stanceTimeBalance = 50;
      point.verticalRatio = 8.9;
      point.temp = 18;
    });
    const result = processActivities([input], { cropStartMeters: 30 });
    expect(result.activity.summary.avgCadence).toBe(90);
    expect(result.activity.summary.avgStepLength).toBe(900);
    expect(result.activity.summary.avgVerticalOscillation).toBe(80);
    expect(result.activity.summary.avgStanceTime).toBe(250);
    expect(result.activity.summary.avgTemperature).toBe(18);
    expect(result.activity.summary.minTemperature).toBe(18);
  });

  it('keeps low and fractional explicit CSV steps/minute without treating it as stride cycles', () => {
    const input = 'Timestamp,Distance(m),Cadence(spm)\n2026-09-29T00:00:00Z,0,90.5\n2026-09-29T00:00:01Z,1,90.5\n';
    const parsed = parseActivityFile(input, 'csv');
    expect(parsed.summary.avgCadence).toBe(90.5);
    const fit = parseActivityFile(serializeActivity(parsed, 'fit').data, 'fit');
    expect(fit.points[0].cad).toBe(90.5);
    const csv = parseActivityFile(serializeActivity(parsed, 'csv').data, 'csv');
    expect(csv.points[0].cad).toBe(90.5);
    expect(() => parseActivityFile('unrecognized\ncolumn\n', 'csv')).toThrow(/No trackpoints/);
  });

  it('preserves cycling classification and cadence through TCX and FIT conversion', () => {
    const input = `<TrainingCenterDatabase><Activities><Activity Sport="Biking"><Lap>
      <TotalTimeSeconds>10</TotalTimeSeconds><DistanceMeters>50</DistanceMeters><Cadence>85</Cadence>
      <Track><Trackpoint><Time>2026-09-29T00:00:00Z</Time><DistanceMeters>0</DistanceMeters><Cadence>85</Cadence></Trackpoint>
      <Trackpoint><Time>2026-09-29T00:00:10Z</Time><DistanceMeters>50</DistanceMeters><Cadence>85</Cadence></Trackpoint></Track>
      </Lap></Activity></Activities></TrainingCenterDatabase>`;
    const parsed = parseActivityFile(input, 'tcx');
    expect(parsed.summary.sport).toBe('cycling');
    expect(parsed.summary.avgCadence).toBe(85);
    const fit = parseActivityFile(serializeActivity(parsed, 'fit').data, 'fit');
    expect(fit.summary.sport).toBe('cycling');
    expect(fit.points[0].cad).toBe(85);
  });

  it('normalizes legacy single-leg text cadence before FIT conversion', () => {
    const gpx = '<gpx><trk><trkseg><trkpt lat="0" lon="0"><time>2026-09-29T00:00:00Z</time><extensions><cad>85</cad></extensions></trkpt></trkseg></trk></gpx>';
    const parsed = parseActivityFile(gpx, 'gpx');
    expect(parsed.points[0].cad).toBe(170);
    expect(parsed.summary.avgCadence).toBe(170);
    const fit = parseActivityFile(serializeActivity(parsed, 'fit').data, 'fit');
    expect(fit.points[0].cad).toBe(170);
    const cycling = parseActivityFile(gpx.replace('<trk>', '<trk><type>cycling</type>'), 'gpx');
    expect(cycling.points[0].cad).toBe(85);
    expect(cycling.summary.sport).toBe('cycling');
  });

  it('rejects malformed or excessive FIT developer descriptors before merging', () => {
    const malformed = activityWithDeveloper(123);
    if (!malformed.fit) throw new Error('Missing test metadata');
    malformed.fit.messages[0].fields[0].data = new Uint8Array([0, 0]);
    expect(() => processActivities([malformed], { forceGpsDistance: true })).toThrow(/developer identifier/);
    const excessive = Array.from({ length: 256 }, (_, index) => activityWithDeveloper(1, index * 60));
    expect(() => processActivities(excessive)).toThrow(/Too many FIT developer identifiers/);
  });

  it('remaps shared record objects separately for each input and retains descriptor developer fields', () => {
    const first = activityWithDeveloper(123);
    const second = { ...activityWithDeveloper(234, 60), points: first.points };
    if (!second.fit || !first.points[0].fit) throw new Error('Missing test metadata');
    second.fit.messages[0].developerFields = first.points[0].fit.developerFields;
    const result = processActivities([first, second]);
    expect(result.activity.points[0].fit?.developerFields[0].developerDataIndex).toBe(0);
    expect(result.activity.points[1].fit?.developerFields[0].developerDataIndex).toBe(1);
    expect(result.activity.fit?.messages[2].developerFields[0].developerDataIndex).toBe(1);
    first.points[0].fit.developerFields[0].developerDataIndex = -1;
    expect(() => processActivities([first], { forceGpsDistance: true })).toThrow(/Invalid FIT developer identifier/);
  });

  it('preserves fractional canonical cadence in edited and merged summaries', () => {
    const first = activityWithDeveloper(123);
    first.points.forEach((point) => {
      delete point.sport;
      point.cadenceUnit = 'steps/min';
      point.cad = 90.5;
    });
    const cropped = processActivities([first], { cropStartMeters: 30 }).activity;
    expect(cropped.summary.avgCadence).toBe(90.5);
    expect(cropped.summary.maxCadence).toBe(90.5);
    expect(parseActivityFile(serializeActivity(cropped, 'fit').data, 'fit').summary.avgCadence).toBe(90.5);
    first.summary.avgCadence = 90.5;
    const second = activity('Second', 60);
    second.summary.avgCadence = 91.515625;
    const merged = processActivities([first, second]);
    expect(merged.activity.summary.avgCadence).toBe(91.0078125);
  });

  it('reports the start-time requirement even when a FIT activity contains unrelated metadata', () => {
    const input = activityWithDeveloper(123);
    input.points.forEach((point) => { point.time = null; });
    try {
      serializeActivity(input, 'fit');
      throw new Error('Expected a missing timestamp error');
    } catch (error) {
      expect(error).toBeInstanceOf(FileConversionError);
      expect(error).toMatchObject({ code: 'timestamps-required' });
    }
  });
});
