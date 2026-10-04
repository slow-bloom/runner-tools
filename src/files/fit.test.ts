import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseFIT, serializeToFIT } from './fit.js';
import { parseGPX } from './gpx.js';
import { parseTCX } from './tcx.js';
import type { Activity, FITMessage, Trackpoint } from './types.js';

// These fixtures are assembled from wire bytes, independently of the production encoder.
// Field IDs/units: https://github.com/garmin/fit-javascript-sdk/blob/main/src/profile.js
// Header/CRC/compression: https://developer.garmin.com/fit/protocol/
type WireField = [number, number, number];
const epoch = Date.UTC(1989, 11, 31);
const start = 0x4000001e;
const date = (seconds: number) => new Date(epoch + seconds * 1000);

function checksum(bytes: number[]): number {
  let remainder = 0;
  for (const byte of bytes) {
    remainder ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      remainder = remainder & 1 ? (remainder >>> 1) ^ 0xa001 : remainder >>> 1;
    }
  }
  return remainder;
}

function u16(value: number, big = false): number[] {
  const bytes = [value & 255, (value >>> 8) & 255];
  return big ? bytes.reverse() : bytes;
}

function u32(value: number, big = false): number[] {
  const bytes = [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255];
  return big ? bytes.reverse() : bytes;
}

function text(value: string): number[] {
  return [...new TextEncoder().encode(value), 0];
}

function f64(value: number, big = false): number[] {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat64(0, value, !big);
  return Array.from(bytes);
}

function definition(global: number, local: number, fields: WireField[], big = false, developer: WireField[] = []): number[] {
  return [
    0x40 | local | (developer.length ? 0x20 : 0), 0, big ? 1 : 0, ...u16(global, big),
    fields.length, ...fields.flat(),
    ...(developer.length ? [developer.length, ...developer.flat()] : []),
  ];
}

function fixture(body: number[], headerSize = 14, zeroHeaderCrc = false): Uint8Array {
  const header = [headerSize, 0x20, ...u16(2184), ...u32(body.length), 46, 70, 73, 84];
  if (headerSize === 14) header.push(...u16(zeroHeaderCrc ? 0 : checksum(header)));
  const bytes = [...header, ...body];
  return Uint8Array.from([...bytes, ...u16(checksum(bytes))]);
}

function fileId(): number[] {
  return [
    ...definition(0, 0, [[0, 1, 0], [1, 2, 0x84], [4, 4, 0x86]]),
    0, 4, ...u16(255), ...u32(start),
  ];
}

function developerDescriptions(): number[] {
  const name = text('custom_load');
  const units = text('au');
  return [
    ...definition(207, 3, [[1, 16, 13], [3, 1, 2]]),
    3, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 0,
    ...definition(206, 4, [[0, 1, 2], [1, 1, 2], [2, 1, 2], [3, name.length, 7], [6, 1, 2], [7, 1, 1], [8, units.length, 7]]),
    4, 0, 0, 0x84, ...name, 10, 2, ...units,
  ];
}

function summaryBytes(global: 18 | 19, local: number, sport: number, developer = true): number[] {
  const session = global === 18;
  const fields: WireField[] = [
    [253, 4, 0x86], [2, 4, 0x86], [session ? 5 : 25, 1, 0], [session ? 6 : 39, 1, 0],
    [7, 4, 0x86], [8, 4, 0x86], [9, 4, 0x86], [10, 4, 0x86], [11, 2, 0x84],
    [session ? 14 : 13, 2, 0x84], [session ? 15 : 14, 2, 0x84],
    [session ? 124 : 110, 4, 0x86], [session ? 125 : 111, 4, 0x86],
    [session ? 16 : 15, 1, 2], [session ? 17 : 16, 1, 2],
    [session ? 18 : 17, 1, 2], [session ? 19 : 18, 1, 2],
    [session ? 92 : 80, 1, 2], [session ? 93 : 81, 1, 2], [session ? 94 : 82, 1, 2],
    [session ? 20 : 19, 2, 0x84], [session ? 21 : 20, 2, 0x84],
    [session ? 22 : 21, 2, 0x84], [session ? 23 : 22, 2, 0x84],
    [session ? 89 : 77, 2, 0x84], [session ? 90 : 78, 2, 0x84], [session ? 91 : 79, 2, 0x84],
    [session ? 132 : 118, 2, 0x84], [session ? 133 : 119, 2, 0x84], [session ? 134 : 120, 2, 0x84],
    [session ? 57 : 50, 1, 1], [session ? 58 : 51, 1, 1], [session ? 150 : 124, 1, 1],
    [session ? 34 : 33, 2, 0x84], [session ? 59 : 52, 4, 0x86],
  ];
  return [
    ...definition(global, local, fields, false, developer ? [[0, 2, 0]] : []),
    local, ...u32(start + 3), ...u32(start), sport, 3,
    ...u32(3500), ...u32(3000), ...u32(420), ...u32(4), ...u16(2),
    ...u16(1200), ...u16(1300), ...u32(4200), ...u32(4250),
    152, 155, 90, 91, 64, 32, 32,
    ...u16(277), ...u16(280), ...u16(1), ...u16(2),
    ...u16(1234), ...u16(3900), ...u16(2500), ...u16(875), ...u16(5025), ...u16(12345),
    4, 18, 246, ...u16(279), ...u32(2750),
    ...(developer ? u16(777) : []),
  ];
}

function activityFixture(sport = 1, developer = true): Uint8Array {
  const record: WireField[] = [
    [253, 4, 0x86], [0, 4, 0x85], [1, 4, 0x85], [2, 2, 0x84], [78, 4, 0x86],
    [3, 1, 2], [4, 1, 2], [53, 1, 2], [5, 4, 0x86], [6, 2, 0x84], [73, 4, 0x86],
    [7, 2, 0x84], [85, 2, 0x84], [39, 2, 0x84], [41, 2, 0x84], [13, 1, 1],
    [83, 2, 0x84], [84, 2, 0x84], [40, 2, 0x84],
    [200, 3, 31],
  ];
  const sample = (time: number, hr: number, distance: number, cadenceFraction: number) => [
    1, ...u32(time), ...u32(1), ...u32(-1), ...u16(2600), ...u32(3000),
    hr, 90, cadenceFraction, ...u32(distance), ...u16(3200), ...u32(4200),
    ...u16(275), ...u16(12345), ...u16(1234), ...u16(2500), 18,
    ...u16(875), ...u16(5025), ...u16(3900), 0x11, 0x22, 0x33,
    ...(developer ? u16(234) : []),
  ];
  return fixture([
    ...fileId(),
    ...(developer ? developerDescriptions() : []),
    ...definition(20, 1, record, false, developer ? [[0, 2, 0]] : []),
    ...sample(start, 150, 0, 64),
    ...sample(start + 3, 155, 420, 32),
    ...summaryBytes(19, 2, sport, developer),
    ...summaryBytes(18, 5, sport, developer),
    ...definition(34, 6, [[253, 4, 0x86], [0, 4, 0x86], [1, 2, 0x84], [2, 1, 0]]),
    6, ...u32(start + 3), ...u32(3000), ...u16(1), 0,
  ]);
}

function multisportFixture(withLaps: boolean): Uint8Array {
  const body = [
    ...fileId(),
    ...definition(20, 1, [[253, 4, 0x86], [4, 1, 2], [53, 1, 2], [42, 1, 0]]),
    ...definition(18, 3, [
      [253, 4, 0x86], [2, 4, 0x86], [5, 1, 0], [7, 4, 0x86], [8, 4, 0x86], [9, 4, 0x86],
      [18, 1, 2], [92, 1, 2],
    ]),
    ...definition(19, 2, [
      [253, 4, 0x86], [2, 4, 0x86], [7, 4, 0x86], [8, 4, 0x86], [9, 4, 0x86],
      [17, 1, 2], [80, 1, 2], [23, 1, 0], [24, 1, 0],
    ]),
  ];
  for (let leg = 0; leg < 2; leg++) {
    // A walking motion flag in a running session does not change the session's cadence units.
    body.push(1, ...u32(start + leg * 10), leg ? 80 : 90, leg ? 32 : 64, leg ? 2 : 6);
    if (withLaps) {
      body.push(2, ...u32(start + leg * 10 + 10), ...u32(start + leg * 10),
        ...u32(10000), ...u32(10000), ...u32(1000), leg ? 80 : 90, leg ? 32 : 64, 1, 2);
    }
    body.push(3, ...u32(start + leg * 10 + 10), ...u32(start + leg * 10), leg ? 2 : 1,
      ...u32(10000), ...u32(10000), ...u32(1000), leg ? 80 : 90, leg ? 32 : 64);
  }
  return fixture(body);
}

function raw(message: FITMessage, number: number) {
  return message.fields.find((field) => field.number === number)?.value;
}

function messages(activity: Activity, global: number): FITMessage[] {
  return activity.fit!.messages.filter((message) => message.globalMessageNumber === global);
}

function point(overrides: Partial<Trackpoint> = {}): Trackpoint {
  return { lat: null, lon: null, ele: null, time: null, hr: null, cad: null, distance: null, ...overrides };
}

function bareActivity(points: Trackpoint[], sport = 'running'): Activity {
  return {
    name: 'Morning run',
    points,
    summary: {
      distance: 0, duration: 0, totalElapsedTime: 0, avgPaceSecs: 0,
      avgHeartRate: null, maxHeartRate: null, avgCadence: null, maxCadence: null,
      totalAscent: null, totalDescent: null, avgPower: null, maxPower: null, sport,
    },
  };
}

// An independent, deliberately minimal wire inspector for validating the writer's output.
// It does not use parseFIT, the profile mapping, or any production utility.
function inspectWire(bytes: Uint8Array): Array<{ global: number; fields: Map<number, number[]>; developer: number[][] }> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const definitions = new Map<number, { global: number; fields: WireField[]; developer: WireField[] }>();
  const result: Array<{ global: number; fields: Map<number, number[]>; developer: number[][] }> = [];
  const end = bytes[0] + view.getUint32(4, true);
  expect(checksum(Array.from(bytes.slice(0, end)))).toBe(view.getUint16(end, true));
  expect(checksum(Array.from(bytes.slice(0, 12)))).toBe(view.getUint16(12, true));
  let cursor = bytes[0];
  while (cursor < end) {
    const header = bytes[cursor++];
    const local = header & 15;
    expect(header & 0x80).toBe(0);
    if (header & 0x40) {
      cursor++;
      const little = bytes[cursor++] === 0;
      const global = view.getUint16(cursor, little);
      cursor += 2;
      const count = bytes[cursor++];
      const fields: WireField[] = [];
      for (let i = 0; i < count; i++) {
        fields.push([bytes[cursor], bytes[cursor + 1], bytes[cursor + 2]]);
        cursor += 3;
      }
      const developer: WireField[] = [];
      if (header & 0x20) {
        const count = bytes[cursor++];
        for (let i = 0; i < count; i++) {
          developer.push([bytes[cursor], bytes[cursor + 1], bytes[cursor + 2]]);
          cursor += 3;
        }
      }
      definitions.set(local, { global, fields, developer });
    } else {
      const definition = definitions.get(local)!;
      expect(definition).toBeDefined();
      const fields = new Map<number, number[]>();
      for (const [number, size] of definition.fields) {
        fields.set(number, Array.from(bytes.slice(cursor, cursor + size)));
        cursor += size;
      }
      const developer: number[][] = [];
      for (const [, size] of definition.developer) {
        developer.push(Array.from(bytes.slice(cursor, cursor + size)));
        cursor += size;
      }
      result.push({ global: definition.global, fields, developer });
    }
  }
  expect(cursor).toBe(end);
  return result;
}

describe('FIT reader: independent protocol fixtures', () => {
  it('decodes an independent Garmin SDK 21.217 fixture, including its 0x02 protocol-byte quirk', () => {
    // Generated by @garmin/fitsdk's Encoder from synthetic measurements, not this codec.
    // No SDK code or dependency is needed to run the regression test.
    const bytes = readFileSync(new URL('./fixtures/garmin-sdk-activity.fit', import.meta.url));
    expect(bytes[1]).toBe(2);
    const activity = parseFIT(bytes);
    expect(activity.name).toBe('SDK synthetic run');
    expect(activity.points).toHaveLength(2);
    expect(activity.points[0]).toMatchObject({
      time: new Date('2026-03-01T08:00:00Z'), lat: 180 / 2147483648, lon: -180 / 2147483648,
      ele: 100, speed: 4.2, distance: 0, cad: 181.5, power: 289, hr: 150,
      stepLength: 1200.5, verticalOscillation: 82.3, stanceTime: 260.1, temp: 21,
    });
    expect(activity.points[1]).toMatchObject({ lat: null, lon: null, cad: 182.5, distance: 21 });
    expect(activity.points[0].fit!.developerFields[0]).toMatchObject({ name: 'synthetic_load', value: 123.4 });
    expect(activity.summary).toMatchObject({
      distance: 21, duration: 5, totalElapsedTime: 5.25, totalCalories: 4, totalCycles: 7.5,
      avgSpeed: 4.2, maxSpeed: 4.25, avgCadence: 181.5, maxCadence: 182.5,
      avgPower: 290, maxPower: 292, avgStepLength: 1202.5,
    });
    expect(messages(activity, 19)[0].developerFields[0].value).toBe(125);
    expect(messages(activity, 18)[0].developerFields[0].value).toBe(125.5);
  });

  it('reads record, session, lap, enhanced fields and running dynamics in canonical units', () => {
    const activity = parseFIT(activityFixture());
    expect(activity.recordedLaps).toEqual([{
      startTime: date(start), endTime: date(start + 3),
      distance: 4.2, endTimeBasis: 'recorded',
    }]);
    expect(activity.points).toHaveLength(2);
    expect(activity.points[0]).toMatchObject({
      lat: 180 / 2147483648, lon: -180 / 2147483648, time: date(start),
      ele: 100, hr: 150, cad: 181, distance: 0, speed: 4.2, power: 275,
      temp: 18, stepLength: 1234.5, verticalOscillation: 123.4, stanceTime: 250,
      stanceTimePercent: 39, verticalRatio: 8.75, stanceTimeBalance: 50.25,
    });
    expect(activity.points[1].cad).toBe(180.5);
    const expected = {
      distance: 4.2, duration: 3, totalElapsedTime: 3.5, totalCalories: 2, totalCycles: 4.25,
      avgCadence: 181, maxCadence: 182.5, avgHeartRate: 152, maxHeartRate: 155,
      avgSpeed: 4.2, maxSpeed: 4.25, avgPower: 277, maxPower: 280,
      totalAscent: 1, totalDescent: 2, avgStepLength: 1234.5, avgVerticalOscillation: 123.4,
      avgStanceTime: 250, avgStanceTimePercent: 39, avgVerticalRatio: 8.75,
      avgStanceTimeBalance: 50.25, avgTemperature: 4, maxTemperature: 18, minTemperature: -10,
      normalizedPower: 279, totalMovingTime: 2.75, sport: 'running', subSport: 'trail',
    };
    expect(activity.summary).toMatchObject(expected);
    expect(messages(activity, 18)[0].summary).toMatchObject(expected);
    expect(messages(activity, 19)[0].summary).toMatchObject(expected);
  });

  it('preserves developer descriptions, scaled values, bytes and opaque fields', () => {
    const activity = parseFIT(activityFixture());
    expect(messages(activity, 207)).toHaveLength(1);
    expect(messages(activity, 206)).toHaveLength(1);
    expect(activity.points[0].fit!.developerFields[0]).toEqual({
      number: 0, developerDataIndex: 0, baseType: 0x84,
      name: 'custom_load', units: 'au', data: Uint8Array.from([234, 0]), value: 21.4,
    });
    expect(activity.points[0].fit!.fields.find((field) => field.number === 200)).toEqual({
      number: 200, baseType: 31, data: Uint8Array.from([17, 34, 51]), value: null,
    });
    expect(messages(activity, 18)[0].developerFields[0].value).toBeCloseTo(75.7);
  });

  it('uses explicit native developer mappings and retains big-endian, higher-precision values', () => {
    const name = text('custom_power');
    const input = fixture([
      ...fileId(),
      ...definition(207, 3, [[1, 16, 13], [3, 1, 2]]),
      3, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 0,
      ...definition(206, 4, [[0, 1, 2], [1, 1, 2], [2, 1, 2], [3, name.length, 7], [14, 2, 0x84], [15, 1, 2]], true),
      4, 0, 0, 0x89, ...name, ...u16(20, true), 7,
      ...definition(20, 1, [[253, 4, 0x86], [7, 2, 0x84], [99, 2, 0x83]], true, [[0, 8, 0]]),
      1, ...u32(start, true), ...u16(65535, true), ...u16(-5, true), ...f64(250.125, true),
    ]);
    const original = parseFIT(input);
    expect(original.points[0].power).toBe(250.125);
    expect(original.points[0].fit!.developerFields[0]).toMatchObject({
      nativeMessageNumber: 20, nativeFieldNumber: 7, value: 250.125,
    });
    const reread = parseFIT(serializeToFIT(original));
    expect(reread.points[0].power).toBe(250.125);
    expect(reread.points[0].fit!.littleEndian).toBe(false);
    expect(reread.points[0].fit!.fields.find((field) => field.number === 99)?.value).toBe(-5);
    expect(reread.points[0].fit!.developerFields).toEqual(original.points[0].fit!.developerFields);
    expect(reread.points[0].fit!.fields.some((field) => field.number === 7)).toBe(false);
  });

  it('preserves unresolved developer bytes without guessing their type or native meaning', () => {
    const input = fixture([
      ...definition(20, 0, [[253, 4, 0x86]], false, [[9, 3, 2]]),
      0, ...u32(start), 1, 2, 3,
    ]);
    const activity = parseFIT(input);
    expect(activity.points[0].power).toBeNull();
    expect(activity.points[0].fit!.developerFields).toEqual([{
      number: 9, developerDataIndex: 2, data: Uint8Array.from([1, 2, 3]),
    }]);
    expect(() => serializeToFIT(activity)).toThrow(/developer field 2:9 needs/);
  });

  it('never guesses semicircle units from a coordinate magnitude', () => {
    const input = fixture([
      ...definition(20, 0, [[0, 4, 0x85], [1, 4, 0x85]]),
      0, ...u32(0), ...u32(100),
      0, ...u32(-50), ...u32(-0x80000000),
    ]);
    const { points } = parseFIT(input);
    expect(points[0].lat).toBe(0);
    expect(points[0].lon).toBeCloseTo(100 * 180 / 2147483648, 12);
    expect(points[1].lat).toBeCloseTo(-50 * 180 / 2147483648, 12);
    expect(points[1].lon).toBe(-180);
  });

  it('does not double cycling cadence or discard fractional cadence', () => {
    const activity = parseFIT(activityFixture(2));
    expect(activity.summary.sport).toBe('cycling');
    expect(activity.summary.avgCadence).toBe(90.5);
    expect(activity.summary.maxCadence).toBe(91.25);
    expect(activity.points.map((point) => point.cad)).toEqual([90.5, 90.25]);
    expect(activity.points.every((point) => point.cadenceUnit === 'cycles/min')).toBe(true);
  });

  it('explicitly marks slow canonical running cadence and preserves its fractional mean', () => {
    const activity = parseFIT(fixture([
      ...definition(20, 0, [[253, 4, 0x86], [4, 1, 2], [53, 1, 2], [42, 1, 0], [5, 4, 0x86]]),
      0, ...u32(start), 40, 16, 1, ...u32(0),
      0, ...u32(start + 3), 41, 32, 1, ...u32(300),
    ]));
    expect(activity.points.map((point) => point.cad)).toEqual([80.25, 82.5]);
    expect(activity.points.every((point) => point.cadenceUnit === 'steps/min')).toBe(true);
    expect(activity.summary.avgCadence).toBe(81.375);
    expect(activity.summary.maxCadence).toBe(82.5);
    expect(parseFIT(serializeToFIT(activity)).summary.avgCadence).toBe(81.375);
  });

  it('decodes big-endian definitions and low-five-bit timestamp wrap above the signed boundary', () => {
    const clock = 0x8000001f;
    const input = fixture([
      ...definition(20, 0, [[253, 4, 0x86], [0, 4, 0x85], [3, 1, 2]], true),
      0, ...u32(clock, true), ...u32(-1, true), 150,
      ...definition(40000, 2, [[99, 3, 31]], true),
      2, 0xee, 0xff, 0xdd,
      ...definition(20, 1, [[0, 4, 0x85], [3, 1, 2]], true),
      0xa0, ...u32(1, true), 151,
      0xa3, ...u32(2, true), 152,
    ]);
    const activity = parseFIT(input);
    expect(activity.points.map((point) => point.time)).toEqual([date(clock), date(clock + 1), date(clock + 4)]);
    expect(activity.points.map((point) => point.hr)).toEqual([150, 151, 152]);
    expect(activity.points[0].lat).toBe(-180 / 2147483648);
    expect(messages(activity, 40000)[0].fields[0].data).toEqual(Uint8Array.from([0xee, 0xff, 0xdd]));
  });

  it('supports compressed replacement of a defined timestamp and subsequent full timestamp resets', () => {
    const input = fixture([
      ...definition(20, 0, [[253, 4, 0x86], [3, 1, 2]]),
      0, ...u32(start), 150,
      0x80 | 1, 151,
      0, ...u32(start + 100), 152,
      0x80 | ((start + 101) & 31), 153,
    ]);
    expect(parseFIT(input).points.map((point) => point.time)).toEqual([
      date(start), date(start + 3), date(start + 100), date(start + 101),
    ]);
  });

  it('keeps GPS-less records, all invalid sentinels, zero measurements, and missing times distinct', () => {
    const fields: WireField[] = [
      [253, 4, 0x86], [0, 4, 0x85], [1, 4, 0x85], [2, 2, 0x84], [3, 1, 2],
      [4, 1, 2], [53, 1, 2], [5, 4, 0x86], [6, 2, 0x84], [7, 2, 0x84], [13, 1, 1],
    ];
    const input = fixture([
      ...definition(20, 0, fields),
      0, ...u32(0xffffffff), ...u32(0x7fffffff), ...u32(0x7fffffff), ...u16(0xffff),
      255, 255, 255, ...u32(0xffffffff), ...u16(0xffff), ...u16(0xffff), 127,
      0, ...u32(start), ...u32(0x7fffffff), ...u32(0x7fffffff), ...u16(2500),
      0, 0, 0, ...u32(0), ...u16(0), ...u16(0), 0,
    ]);
    const activity = parseFIT(input);
    expect(activity.points).toHaveLength(2);
    expect(activity.points[0]).toMatchObject({
      lat: null, lon: null, ele: null, time: null, hr: null, cad: null, distance: null, speed: null, power: null, temp: null,
    });
    expect(activity.points[1]).toMatchObject({
      lat: null, lon: null, ele: 0, time: date(start), hr: 0, cad: 0, distance: 0, speed: 0, power: 0, temp: 0,
    });
  });

  it('does not reinterpret device-uptime timestamps as UTC dates', () => {
    const input = fixture([...definition(20, 0, [[253, 4, 0x86], [3, 1, 2]]), 0, ...u32(42), 150]);
    expect(parseFIT(input).points[0].time).toBeNull();
    expect(() => serializeToFIT(parseFIT(input))).toThrow(/explicit startTime/);
  });

  it('expands packed speed/distance with cumulative-distance rollover', () => {
    const packed = (speed: number, distance: number) => [speed & 255, (speed >>> 8) | ((distance & 15) << 4), distance >>> 4];
    const input = fixture([
      ...definition(20, 0, [[8, 3, 13]]),
      0, ...packed(321, 4090),
      0, ...packed(325, 20),
    ]);
    const { points } = parseFIT(input);
    expect(points[0]).toMatchObject({ speed: 3.21, distance: 4090 / 16 });
    expect(points[1]).toMatchObject({ speed: 3.25, distance: 4116 / 16 });
  });

  it('does not create an extra compressed-distance rollover at a full-field rounding boundary', () => {
    const input = fixture([
      ...definition(20, 0, [[5, 4, 0x86]]), 0, ...u32(25599),
      ...definition(20, 1, [[8, 3, 13]]), 1, 0x2c, 0xf1, 0xff,
    ]);
    expect(parseFIT(input).points[1].distance).toBe(4095 / 16);
  });

  it('uses recorded activity timer time and real timer-event intervals before movement heuristics', () => {
    const records = [
      ...definition(20, 0, [[253, 4, 0x86], [3, 1, 2]]),
      0, ...u32(start), 150, 0, ...u32(start + 30), 155,
    ];
    const fromActivity = parseFIT(fixture([
      ...records, ...definition(34, 1, [[0, 4, 0x86]]), 1, ...u32(1750),
    ]));
    expect(fromActivity.summary.duration).toBe(1.75);
    const events = [
      ...definition(21, 1, [[253, 4, 0x86], [0, 1, 0], [1, 1, 0]]),
      1, ...u32(start), 0, 0, 1, ...u32(start + 10), 0, 1,
      1, ...u32(start + 20), 0, 0, 1, ...u32(start + 30), 0, 4,
    ];
    const fromEvents = parseFIT(fixture([...records, ...events]));
    expect(fromEvents.summary.duration).toBe(20);
    expect(messages(parseFIT(serializeToFIT(fromEvents)), 21)).toHaveLength(4);
  });

  it.each([false, true])('preserves multisport session/cadence semantics and lap ownership (laps=%s)', (withLaps) => {
    const activity = parseFIT(multisportFixture(withLaps));
    expect(activity.points.map((point) => point.sport)).toEqual(['running', 'cycling']);
    expect(activity.points.map((point) => point.cad)).toEqual([181, 80.25]);
    expect(activity.summary).toMatchObject({ distance: 20, duration: 20, sport: 'multisport', avgCadence: null, maxCadence: null });
    if (withLaps) {
      expect(messages(activity, 19).map((message) => message.summary?.avgCadence)).toEqual([181, 80.25]);
    }
    const result = parseFIT(serializeToFIT(activity, { name: 'Two sports' }));
    expect(result.name).toBe('Two sports');
    expect(result.points.map((point) => point.cad)).toEqual([181, 80.25]);
    expect(messages(result, 18)).toHaveLength(2);
    expect(messages(result, 19)).toHaveLength(2);
    expect(messages(result, 18).map((message) => raw(message, 26))).toEqual([1, 1]);
    expect(messages(result, 18).map((message) => raw(message, 25))).toEqual([0, 1]);
    expect(raw(messages(result, 34)[0], 1)).toBe(2);
    if (withLaps) {
      expect(messages(result, 19).map((message) => raw(message, 23))).toEqual([1, 1]);
      expect(messages(result, 19).map((message) => raw(message, 24))).toEqual([2, 2]);
    }
    const stripped = parseFIT(serializeToFIT(activity, { stripLaps: true }));
    expect(messages(stripped, 19)).toHaveLength(0);
    expect(messages(stripped, 18).map((message) => raw(message, 26))).toEqual([0, 0]);
  });

  it('reads all base types including partial-invalid arrays and exact 64-bit developer data', () => {
    const input = fixture([
      ...definition(500, 0, [
        [1, 4, 0x83], [2, 2, 10], [3, 4, 0x8b], [4, 8, 0x8c],
        [5, 8, 0x88], [6, 8, 0x89], [7, 8, 0x8e], [8, 8, 0x8f], [9, 8, 0x90], [10, 3, 13],
      ]),
      0, ...u16(-2), ...u16(32767), 0, 5, ...u16(0), ...u16(3), ...u32(0), ...u32(5),
      0, 0, 192, 63, 255, 255, 255, 255,
      0, 0, 0, 0, 0, 0, 4, 64,
      254, 255, 255, 255, 255, 255, 255, 255,
      1, 0, 0, 0, 0, 0, 32, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      1, 255, 3,
    ]);
    const message = messages(parseFIT(input), 500)[0];
    expect(raw(message, 1)).toEqual([-2, null]);
    expect(raw(message, 2)).toEqual([null, 5]);
    expect(raw(message, 3)).toEqual([null, 3]);
    expect(raw(message, 4)).toEqual([null, 5]);
    expect(raw(message, 5)).toEqual([1.5, null]);
    expect(raw(message, 6)).toBe(2.5);
    expect(raw(message, 7)).toBe(-2n);
    expect(raw(message, 8)).toBe(9007199254740993n);
    expect(raw(message, 9)).toBeNull();
    expect(raw(message, 10)).toEqual([1, 255, 3]);
  });

  it.each([[12, false], [14, true], [14, false]] as const)('accepts the valid %i-byte header variant (zero CRC=%s)', (size, zero) => {
    const input = fixture([...definition(20, 0, [[3, 1, 2]]), 0, 123], size, zero);
    expect(parseFIT(input).points[0].hr).toBe(123);
  });

  it('honors Uint8Array offsets and ArrayBuffer input, and localizes unnamed activities', () => {
    const bytes = activityFixture();
    const backing = new Uint8Array(bytes.length + 20).fill(0x99);
    backing.set(bytes, 9);
    expect(parseFIT(backing.subarray(9, 9 + bytes.length)).points).toEqual(parseFIT(bytes.buffer).points);
    expect(parseFIT(bytes, { locale: 'zh-CN' }).name).toBe('运动记录');
  });

  it('owns native and developer bytes even when the input is a Node Buffer with slicing views', () => {
    const bytes = readFileSync(new URL('./fixtures/garmin-sdk-activity.fit', import.meta.url));
    const activity = parseFIT(bytes);
    const snapshot = structuredClone(activity);
    bytes.fill(0);
    expect(activity).toEqual(snapshot);
    expect(activity.points[0].fit!.fields[0].data.constructor).toBe(Uint8Array);
    expect(activity.points[0].fit!.developerFields[0].data.constructor).toBe(Uint8Array);
  });
});

describe('FIT malformed input', () => {
  it('rejects invalid signature, truncated header, unsupported protocol, length mismatch and bad CRC', () => {
    expect(() => parseFIT(new Uint8Array())).toThrow(/truncated file header/);
    const wrongSignature = activityFixture();
    wrongSignature[8] = 0;
    expect(() => parseFIT(wrongSignature)).toThrow(/signature/);
    const badVersion = activityFixture();
    badVersion[1] = 0x30;
    expect(() => parseFIT(badVersion)).toThrow(/unsupported protocol/);
    const badHeader = activityFixture();
    badHeader[2] ^= 1;
    expect(() => parseFIT(badHeader)).toThrow(/header CRC/);
    const badData = activityFixture();
    badData[30] ^= 1;
    expect(() => parseFIT(badData)).toThrow(/file CRC/);
    expect(() => parseFIT(activityFixture().slice(0, -1))).toThrow(/truncated/);
    expect(() => parseFIT(Uint8Array.from([...activityFixture(), 0]))).toThrow(/file size/);
  });

  it.each([
    [[0], /undefined local/],
    [[0x40, 0], /truncated message/],
    [[0x40, 0, 2, 20, 0, 0], /architecture/],
    [[...definition(20, 0, [[3, 1, 2]]), 0], /truncated message/],
    [[...definition(20, 0, [[5, 3, 0x86]])], /invalid size/],
    [[...definition(20, 0, [[3, 0, 2]])], /zero-sized/],
    [[...definition(20, 0, [[3, 1, 2], [3, 1, 2]])], /duplicate field/],
    [[...definition(20, 0, [[3, 1, 2]]), 0x81, 123], /no preceding full timestamp/],
    [[...definition(20, 0, [[253, 4, 0x86]]), 0, ...u32(0xfffffffe), 0x81], /overflows/],
  ])('rejects malformed message streams even with a valid CRC', (body, error) => {
    expect(() => parseFIT(fixture(body as number[]))).toThrow(error as RegExp);
  });
});

describe('FIT writer', () => {
  it.each([
    ['gpx', 85, 170], ['tcx', 85, 170],
    ['gpx', 170, 170], ['tcx', 170, 170],
    ['gpx', 180, 180], ['tcx', 180, 180],
  ] as const)('preserves legacy %s cadence %i as %i spm through FIT', (format, cadence, expected) => {
    const activity = format === 'gpx'
      ? parseGPX(`<gpx><trk><trkseg><trkpt lat="0" lon="0"><time>2026-03-01T08:00:00Z</time><extensions><cad>${cadence}</cad></extensions></trkpt></trkseg></trk></gpx>`)
      : parseTCX(`<TrainingCenterDatabase><Activities><Activity Sport="Running"><Lap StartTime="2026-03-01T08:00:00Z"><TotalTimeSeconds>1</TotalTimeSeconds><DistanceMeters>0</DistanceMeters><Track><Trackpoint><Time>2026-03-01T08:00:00Z</Time><Cadence>${cadence}</Cadence></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`);
    expect(activity.points[0].cad).toBe(cadence);
    const snapshot = structuredClone(activity);
    const bytes = serializeToFIT(activity);
    const record = inspectWire(bytes).find((message) => message.global === 20)!;
    expect(record.fields.get(4)).toEqual([expected / 2]);
    const decoded = parseFIT(bytes);
    expect(decoded.points[0].cad).toBe(expected);
    expect(decoded.summary.avgCadence).toBe(expected);
    expect(activity).toEqual(snapshot);
  });

  it.each([
    ['legacy fractional running', 85.125, {}, 'running', 170.25],
    ['sport-marked fractional running', 85.125, { sport: 'running' }, 'running', 85.125],
    ['unit-marked fractional running', 85.125, { cadenceUnit: 'steps/min' }, 'running', 85.125],
    ['unmarked cycling', 85.125, {}, 'cycling', 85.125],
    ['measured zero', 0, {}, 'running', 0],
    ['full-step threshold', 120, {}, 'running', 120],
  ] as const)('handles %s cadence without mutating or reinterpreting marked points', (_label, cadence, marker, sport, expected) => {
    const activity = bareActivity([point({ time: date(start), cad: cadence, ...marker })], sport);
    activity.summary.avgCadence = expected;
    activity.summary.maxCadence = expected;
    const snapshot = structuredClone(activity);
    const result = parseFIT(serializeToFIT(activity));
    expect(result.points[0].cad).toBe(expected);
    expect(result.summary.avgCadence).toBe(expected);
    expect(activity).toEqual(snapshot);
  });

  it('emits independently inspectable activity/session/lap fields, proper cadence scales and valid CRCs', () => {
    const activity = bareActivity([
      point({ time: date(start), lat: 0, lon: 0, ele: 100, cad: 181.5, hr: 150, distance: 0 }),
      point({ time: date(start + 10), distance: 40, speed: 4.123, cad: 180.25 }),
    ]);
    Object.assign(activity.summary, {
      distance: 40, duration: 9.5, totalElapsedTime: 10, avgCadence: 180.75, maxCadence: 181.5,
      totalCalories: 12, totalCycles: 14.5, avgSpeed: 4, maxSpeed: 4.123, avgStepLength: 1240.5,
    });
    const bytes = serializeToFIT(activity, { creator: 'Codec test', name: '早跑' });
    const wire = inspectWire(bytes);
    expect(wire[0].global).toBe(0);
    expect(wire[0].fields.get(8)).toEqual(text('Codec test'));
    const records = wire.filter((message) => message.global === 20);
    expect(records[0].fields.get(4)).toEqual([90]);
    expect(records[0].fields.get(53)).toEqual([96]);
    expect(records[1].fields.get(53)).toEqual([16]);
    expect(records[1].fields.get(73)).toEqual(u32(4123));
    const session = wire.find((message) => message.global === 18)!;
    expect(session.fields.get(5)).toEqual([1]);
    expect(session.fields.get(9)).toEqual(u32(4000));
    expect(session.fields.get(8)).toEqual(u32(9500));
    expect(session.fields.get(92)).toEqual([48]);
    expect(session.fields.get(94)).toEqual([64]);
    expect(session.fields.get(134)).toEqual(u16(12405));
    expect(session.fields.get(110)).toEqual(text('早跑'));
    expect(wire.filter((message) => message.global === 19)).toHaveLength(1);
    expect(wire.find((message) => message.global === 34)!.fields.get(0)).toEqual(u32(9500));
  });

  it('round-trips native, developer, lap and session metrics without mutating the source', () => {
    const input = activityFixture();
    const inputCopy = input.slice();
    const activity = parseFIT(input);
    const snapshot = structuredClone(activity);
    const output = serializeToFIT(activity);
    expect(input).toEqual(inputCopy);
    expect(activity).toEqual(snapshot);
    const reread = parseFIT(output);
    expect(reread.summary).toMatchObject(activity.summary);
    expect(reread.points.map(({ fit: _fit, ...point }) => point))
      .toEqual(activity.points.map(({ fit: _fit, ...point }) => point));
    expect(reread.points[0].fit!.developerFields).toEqual(activity.points[0].fit!.developerFields);
    expect(messages(reread, 18)[0].developerFields).toEqual(messages(activity, 18)[0].developerFields);
    expect(messages(reread, 19)[0].developerFields).toEqual(messages(activity, 19)[0].developerFields);
    expect(reread.points[0].fit!.fields.find((field) => field.number === 200)?.data).toEqual(Uint8Array.from([17, 34, 51]));
    input.fill(0);
    expect(activity).toEqual(snapshot);
  });

  it('retains cycling cadence and unknown sport/sub-sport numeric semantics', () => {
    const cycling = parseFIT(activityFixture(2));
    expect(parseFIT(serializeToFIT(cycling)).summary.avgCadence).toBe(90.5);
    const unknown = bareActivity([point({ time: date(start), cad: 90.5 })], 'fit_sport_201');
    unknown.summary.subSport = 'fit_sub_sport_202';
    const reread = parseFIT(serializeToFIT(unknown));
    expect(reread.summary.sport).toBe('fit_sport_201');
    expect(reread.summary.subSport).toBe('fit_sub_sport_202');
    expect(reread.points[0].cad).toBe(90.5);
  });

  it('uses edited summaries, not uncropped session metrics or guessed sensor data', () => {
    const activity = parseFIT(activityFixture(1, false));
    activity.summary = {
      ...activity.summary,
      distance: 2.1, duration: 1.5, totalElapsedTime: 2, totalCalories: null, totalCycles: null,
      avgCadence: 180.5, maxCadence: 180.5, avgPower: null, maxPower: null,
      avgSpeed: 1.4, maxSpeed: 1.4, avgStepLength: 800, totalAscent: 0, totalDescent: 0,
    };
    activity.points = [activity.points[1]];
    const wire = inspectWire(serializeToFIT(activity));
    for (const global of [18, 19]) {
      const message = wire.find((message) => message.global === global)!;
      expect(message.fields.get(9)).toEqual(u32(210));
      expect(message.fields.get(8)).toEqual(u32(1500));
      expect(message.fields.has(11)).toBe(false);
      expect(message.fields.has(10)).toBe(false);
      expect(message.fields.has(global === 18 ? 20 : 19)).toBe(false);
      expect(message.fields.get(global === 18 ? 134 : 120)).toEqual(u16(8000));
    }
  });

  it('requires an explicit start for timeless tracks and leaves their record timestamps missing', () => {
    const activity = bareActivity([point({ distance: 0 }), point({ distance: 30 })]);
    activity.summary.distance = 30;
    expect(() => serializeToFIT(activity)).toThrow(/explicit startTime/);
    const wire = inspectWire(serializeToFIT(activity, { startTime: date(start) }));
    const records = wire.filter((message) => message.global === 20);
    expect(records.every((record) => !record.fields.has(253))).toBe(true);
    expect(records.every((record) => !record.fields.has(3) && !record.fields.has(4) && !record.fields.has(73))).toBe(true);
    const reread = parseFIT(serializeToFIT(activity, { startTime: date(start) }));
    expect(reread.points.map((point) => point.time)).toEqual([null, null]);
    expect(reread.summary.totalCalories).toBeUndefined();
    expect(reread.summary.totalCycles).toBeUndefined();
  });

  it('does not fill partially missing timestamps or create distance for sensor-only records', () => {
    const activity = bareActivity([point({ hr: 150 }), point({ time: date(start + 2), hr: 151 })]);
    const output = parseFIT(serializeToFIT(activity));
    expect(output.points[0].time).toBeNull();
    expect(output.points[1].time).toEqual(date(start + 2));
    expect(output.points.map((point) => point.distance)).toEqual([null, null]);
    expect(output.points.map((point) => point.speed)).toEqual([null, null]);
    expect(messages(output, 21)).toHaveLength(0);
  });

  it('exports indoor and deliberately GPS-stripped activities without a location', () => {
    const activity = parseFIT(activityFixture());
    delete activity.fit;
    activity.points = activity.points.map(({ fit: _fit, ...point }) => ({ ...point, lat: null, lon: null }));
    activity.summary.subSport = 'treadmill';
    const wire = inspectWire(serializeToFIT(activity));
    for (const record of wire.filter((message) => message.global === 20)) {
      expect(record.fields.has(0)).toBe(false);
      expect(record.fields.has(1)).toBe(false);
      expect(record.fields.has(3)).toBe(true);
      expect(record.fields.has(5)).toBe(true);
    }
    const result = parseFIT(serializeToFIT(activity));
    expect(result.points).toHaveLength(2);
    expect(result.points.every((point) => point.lat === null && point.lon === null)).toBe(true);
    expect(result.summary.subSport).toBe('treadmill');
  });

  it('omits all laps only when requested and records a zero lap count without a bogus first index', () => {
    const activity = parseFIT(activityFixture());
    const result = parseFIT(serializeToFIT(activity, { stripLaps: true }));
    expect(messages(result, 19)).toHaveLength(0);
    expect(raw(messages(result, 18)[0], 26)).toBe(0);
    expect(raw(messages(result, 18)[0], 25)).toBeUndefined();
    expect(messages(result, 18)[0].developerFields).toHaveLength(1);
  });

  it('refuses silently dropping developer data or reusing unadjusted opaque aggregates after editing', () => {
    const activity = parseFIT(activityFixture());
    delete activity.fit;
    expect(() => serializeToFIT(activity)).toThrow(/developer_data_id and field_description/);
    const edited = parseFIT(activityFixture());
    edited.summary.distance /= 2;
    expect(() => serializeToFIT(edited)).toThrow(/opaque developer aggregates/);
    edited.fit!.messages = edited.fit!.messages.filter((message) => ![18, 19, 34].includes(message.globalMessageNumber));
    expect(() => serializeToFIT(edited)).not.toThrow();
  });

  it('safely represents longitude +180, high enhanced values, Unicode names and invalid Date errors', () => {
    const activity = bareActivity([point({ lat: 0.00000008381903171539307, lon: 180, time: date(start), ele: 20000, speed: 90 })]);
    const reread = parseFIT(serializeToFIT(activity, { name: '🟢'.repeat(100) }));
    expect(reread.points[0].lat).toBe(180 / 2147483648);
    expect(reread.points[0].lon).toBe(-180);
    expect(reread.points[0].ele).toBe(20000);
    expect(reread.points[0].speed).toBe(90);
    expect(reread.name).not.toContain('\ufffd');
    activity.points[0].time = new Date(NaN);
    expect(() => serializeToFIT(activity)).toThrow(/invalid Date/);
  });
});
