import type {
  Activity,
  ActivitySummary,
  FITDeveloperField,
  FITExportOptions,
  FITField,
  FITMessage,
  FITRecordMetadata,
  FITValue,
  ParseTrackOptions,
  Trackpoint,
} from './types.js';
import { calculateActivitySummary } from './geo.js';
import { getLocale } from '../i18n/index.js';

// Wire rules: https://developer.garmin.com/fit/protocol/
// Field numbers/scales: Garmin's FIT Profile 21.217 (not SDK implementation code).
// https://github.com/garmin/fit-javascript-sdk/blob/main/src/profile.js
const FIT_EPOCH = Date.UTC(1989, 11, 31);
const ABSOLUTE_TIME_MIN = 0x10000000;
const SEMICIRCLES_TO_DEGREES = 180 / 0x80000000;
const PROFILE_VERSION = 21217;
const TYPE_SIZE = [1, 1, 1, 2, 2, 4, 4, 1, 4, 8, 1, 2, 4, 1, 8, 8, 8];
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');

const crcTable = Uint16Array.from({ length: 256 }, (_, byte) => {
  let crc = byte;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xa001 : 0);
  return crc;
});

function crc16(bytes: Uint8Array, start = 0, end = bytes.length): number {
  let crc = 0;
  for (let i = start; i < end; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xff];
  return crc;
}

export class FITError extends Error {
  constructor(public readonly code: 'invalid-file' | 'timestamps-required', message: string) {
    super(`FIT: ${message}`);
    this.name = 'FITError';
  }
}

function fail(message: string, code: FITError['code'] = 'invalid-file'): never {
  throw new FITError(code, message);
}

interface FieldDefinition {
  number: number;
  size: number;
  baseType: number;
}

interface DeveloperDefinition {
  number: number;
  size: number;
  developerDataIndex: number;
}

interface Definition {
  globalMessageNumber: number;
  littleEndian: boolean;
  fields: FieldDefinition[];
  developerFields: DeveloperDefinition[];
}

function decodeValue(data: Uint8Array, baseType: number, littleEndian: boolean): FITValue {
  const type = baseType & 0x1f;
  const size = TYPE_SIZE[type];
  if (!size) return null;
  if (data.length % size !== 0) fail(`field size ${data.length} is not a multiple of base type ${type}'s size`);
  if (type === 7) {
    const end = data.indexOf(0);
    const value = decoder.decode(end < 0 ? data : data.subarray(0, end));
    return value || null;
  }
  if (type === 13) {
    if (data.every((byte) => byte === 0xff)) return null;
    return data.length === 1 ? data[0] : Array.from(data);
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const values: Array<number | bigint | null> = [];
  for (let at = 0; at < data.length; at += size) {
    let value: number | bigint;
    let invalid: number | bigint;
    switch (type) {
      case 0: case 2: value = view.getUint8(at); invalid = 0xff; break;
      case 1: value = view.getInt8(at); invalid = 0x7f; break;
      case 3: value = view.getInt16(at, littleEndian); invalid = 0x7fff; break;
      case 4: value = view.getUint16(at, littleEndian); invalid = 0xffff; break;
      case 5: value = view.getInt32(at, littleEndian); invalid = 0x7fffffff; break;
      case 6: value = view.getUint32(at, littleEndian); invalid = 0xffffffff; break;
      case 8: value = view.getFloat32(at, littleEndian); invalid = NaN; break;
      case 9: value = view.getFloat64(at, littleEndian); invalid = NaN; break;
      case 10: value = view.getUint8(at); invalid = 0; break;
      case 11: value = view.getUint16(at, littleEndian); invalid = 0; break;
      case 12: value = view.getUint32(at, littleEndian); invalid = 0; break;
      case 14: value = view.getBigInt64(at, littleEndian); invalid = 0x7fffffffffffffffn; break;
      case 15: value = view.getBigUint64(at, littleEndian); invalid = 0xffffffffffffffffn; break;
      case 16: value = view.getBigUint64(at, littleEndian); invalid = 0n; break;
      default: return null;
    }
    values.push(value === invalid || (typeof value === 'number' && !Number.isFinite(value)) ? null : value);
  }
  return values.length === 1 ? values[0] : values;
}

function nativeNumber(message: FITRecordMetadata, number: number): number | null {
  const value = message.fields.find((field) => field.number === number)?.value;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nativeString(message: FITRecordMetadata, number: number): string | undefined {
  const value = message.fields.find((field) => field.number === number)?.value;
  return typeof value === 'string' ? value : undefined;
}

function dateFromTimestamp(value: number | null): Date | null {
  // Lower values are device-uptime clocks, not UTC (FIT date_time.min).
  return value !== null && value >= ABSOLUTE_TIME_MIN && value < 0xffffffff
    ? new Date(FIT_EPOCH + value * 1000)
    : null;
}

function timestampFromDate(value: Date | null | undefined): number | null {
  if (value == null) return null;
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) fail('invalid Date timestamp');
  const seconds = Math.floor((value.getTime() - FIT_EPOCH) / 1000);
  if (seconds < ABSOLUTE_TIME_MIN || seconds >= 0xffffffff) {
    fail('timestamp is outside the FIT absolute UTC range (1998-07-03 through 2126-02-06)');
  }
  return seconds;
}

function scaledValue(value: FITValue, scale: number, offset: number): FITValue {
  if (Array.isArray(value)) return value.map((item) => typeof item === 'number' ? item / scale - offset : item);
  return typeof value === 'number' ? value / scale - offset : value;
}

type DeveloperDescriptions = Map<string, FITMessage>;

function developerKey(index: number, number: number): string {
  return `${index}:${number}`;
}

function describeDeveloperFields(message: FITMessage, descriptions: DeveloperDescriptions): void {
  for (const field of message.developerFields) {
    const description = descriptions.get(developerKey(field.developerDataIndex, field.number));
    if (!description) continue;
    const baseType = nativeNumber(description, 2);
    if (baseType === null) continue;
    field.baseType = baseType;
    field.name = nativeString(description, 3);
    field.units = nativeString(description, 8);
    const scale = nativeNumber(description, 6) ?? 1;
    field.value = scaledValue(
      decodeValue(field.data, baseType, message.littleEndian),
      scale > 0 ? scale : 1,
      nativeNumber(description, 7) ?? 0
    );
    const nativeMessage = nativeNumber(description, 14);
    const nativeField = nativeNumber(description, 15);
    if (nativeMessage !== null) field.nativeMessageNumber = nativeMessage;
    if (nativeField !== null) field.nativeFieldNumber = nativeField;
  }
}

function readMessages(input: ArrayBuffer | Uint8Array): {
  messages: FITMessage[];
  protocolVersion: number;
  profileVersion: number;
} {
  if (!(input instanceof ArrayBuffer) && !(input instanceof Uint8Array)) {
    fail('input must be an ArrayBuffer or Uint8Array');
  }
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 14) fail('truncated file header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerSize = bytes[0];
  if (headerSize < 12 || headerSize === 13) fail(`invalid header size ${headerSize}`);
  if (headerSize + 2 > bytes.length) fail('truncated file header');
  if (bytes[8] !== 0x2e || bytes[9] !== 0x46 || bytes[10] !== 0x49 || bytes[11] !== 0x54) {
    fail('invalid .FIT signature');
  }
  const protocolVersion = bytes[1];
  // Garmin's JavaScript Encoder 21.217 writes 0x02 instead of the standard 0x20.
  // Accept that producer quirk, but always emit the standard version byte.
  const majorVersion = protocolVersion === 2 ? 2 : protocolVersion >>> 4;
  if (majorVersion !== 1 && majorVersion !== 2) fail(`unsupported protocol version ${majorVersion}`);
  const dataEnd = headerSize + view.getUint32(4, true);
  if (dataEnd + 2 > bytes.length) fail('truncated data or missing file CRC');
  if (dataEnd + 2 !== bytes.length) fail('file size does not match header (trailing data or chained FIT files)');
  if (headerSize >= 14) {
    const headerCrc = view.getUint16(headerSize - 2, true);
    if (headerCrc !== 0 && crc16(bytes, 0, headerSize - 2) !== headerCrc) fail('header CRC mismatch');
  }
  if (crc16(bytes, 0, dataEnd) !== view.getUint16(dataEnd, true)) fail('file CRC mismatch');

  const definitions = new Map<number, Definition>();
  const descriptions: DeveloperDescriptions = new Map();
  const messages: FITMessage[] = [];
  let position = headerSize;
  let lastTimestamp: number | null = null;
  let recordIndex = 0;
  const requireBytes = (count: number) => {
    if (position + count > dataEnd) fail(`truncated message at byte ${position}`);
  };
  while (position < dataEnd) {
    const header = bytes[position++];
    const compressed = (header & 0x80) !== 0;
    const local = compressed ? (header >>> 5) & 3 : header & 15;
    if (!compressed && (header & 0x10)) fail(`reserved record-header bit at byte ${position - 1}`);
    if (!compressed && (header & 0x40)) {
      requireBytes(5);
      if (bytes[position++] !== 0) fail('nonzero reserved byte in message definition');
      const architecture = bytes[position++];
      if (architecture !== 0 && architecture !== 1) fail(`invalid architecture ${architecture}`);
      const littleEndian = architecture === 0;
      const globalMessageNumber = view.getUint16(position, littleEndian);
      position += 2;
      const count = bytes[position++];
      const fields: FieldDefinition[] = [];
      const developerFields: DeveloperDefinition[] = [];
      const numbers = new Set<number>();
      requireBytes(count * 3);
      for (let i = 0; i < count; i++) {
        const number = bytes[position++];
        const size = bytes[position++];
        const baseType = bytes[position++];
        if (number === 255 || numbers.has(number)) fail(`invalid or duplicate field number ${number}`);
        numbers.add(number);
        if (size === 0) fail(`zero-sized field ${number}`);
        const baseSize = TYPE_SIZE[baseType & 0x1f];
        if (baseSize && size % baseSize !== 0) fail(`invalid size for field ${number}`);
        fields.push({ number, size, baseType });
      }
      if (header & 0x20) {
        if (majorVersion < 2) fail('developer fields require FIT protocol 2.0');
        requireBytes(1);
        const developerCount = bytes[position++];
        requireBytes(developerCount * 3);
        const keys = new Set<string>();
        for (let i = 0; i < developerCount; i++) {
          const number = bytes[position++];
          const size = bytes[position++];
          const developerDataIndex = bytes[position++];
          const key = developerKey(developerDataIndex, number);
          if (size === 0 || number === 255 || developerDataIndex === 255 || keys.has(key)) {
            fail('invalid or duplicate developer field definition');
          }
          keys.add(key);
          developerFields.push({ number, size, developerDataIndex });
        }
      }
      definitions.set(local, { globalMessageNumber, littleEndian, fields, developerFields });
      continue;
    }
    if (!compressed && (header & 0x20)) fail('reserved developer bit in data-message header');
    const definition = definitions.get(local);
    if (!definition) fail(`data message references undefined local message ${local}`);
    let compressedTimestamp: number | null = null;
    if (compressed) {
      if (lastTimestamp === null) fail('compressed timestamp has no preceding full timestamp');
      const offset = header & 31;
      compressedTimestamp = lastTimestamp - (lastTimestamp % 32) + offset;
      if (offset < lastTimestamp % 32) compressedTimestamp += 32;
      if (compressedTimestamp >= 0xffffffff) fail('compressed timestamp overflows FIT date_time');
    }
    const message: FITMessage = {
      globalMessageNumber: definition.globalMessageNumber,
      littleEndian: definition.littleEndian,
      fields: [],
      developerFields: [],
      recordIndex,
    };
    for (const field of definition.fields) {
      // Compressed messages can omit timestamp from the definition, or replace its 4-byte value.
      if (compressed && field.number === 253) {
        if ((field.baseType & 0x1f) !== 6 || field.size !== 4) fail('invalid compressed timestamp field');
        continue;
      }
      requireBytes(field.size);
      const data = new Uint8Array(bytes.subarray(position, position + field.size));
      position += field.size;
      message.fields.push({
        number: field.number,
        baseType: field.baseType,
        data,
        value: decodeValue(data, field.baseType, definition.littleEndian),
      });
    }
    if (compressedTimestamp !== null) {
      message.fields.unshift(numberField(253, 0x86, compressedTimestamp, definition.littleEndian));
    }
    for (const field of definition.developerFields) {
      requireBytes(field.size);
      const data = new Uint8Array(bytes.subarray(position, position + field.size));
      position += field.size;
      message.developerFields.push({ number: field.number, developerDataIndex: field.developerDataIndex, data });
    }
    const timestamp = nativeNumber(message, 253);
    if (timestamp !== null) lastTimestamp = timestamp;
    if (message.globalMessageNumber === 206) {
      const index = nativeNumber(message, 0);
      const number = nativeNumber(message, 1);
      if (index !== null && number !== null) descriptions.set(developerKey(index, number), message);
    }
    describeDeveloperFields(message, descriptions);
    messages.push(message);
    if (message.globalMessageNumber === 20) recordIndex++;
  }
  return { messages, protocolVersion, profileVersion: view.getUint16(2, true) };
}

const SPORTS: Record<number, string> = {
  0: 'generic', 1: 'running', 2: 'cycling', 3: 'transition', 4: 'fitness_equipment',
  5: 'swimming', 6: 'basketball', 7: 'soccer', 8: 'tennis', 9: 'american_football',
  10: 'training', 11: 'walking', 12: 'cross_country_skiing', 13: 'alpine_skiing',
  14: 'snowboarding', 15: 'rowing', 16: 'mountaineering', 17: 'hiking', 18: 'multisport',
  19: 'paddling', 20: 'flying', 21: 'e_biking', 22: 'motorcycling', 23: 'boating',
  24: 'driving', 25: 'golf', 26: 'hang_gliding', 27: 'horseback_riding', 28: 'hunting',
  29: 'fishing', 30: 'inline_skating', 31: 'rock_climbing', 32: 'sailing', 33: 'ice_skating',
  34: 'sky_diving', 35: 'snowshoeing', 36: 'snowmobiling', 37: 'stand_up_paddleboarding',
  38: 'surfing', 39: 'wakeboarding', 40: 'water_skiing', 41: 'kayaking', 42: 'rafting',
  43: 'windsurfing', 44: 'kitesurfing', 45: 'tactical', 46: 'jumpmaster', 47: 'boxing',
  48: 'floor_climbing', 49: 'baseball', 53: 'diving', 56: 'shooting', 58: 'winter_sport',
  59: 'grinding', 62: 'hiit', 63: 'video_gaming', 64: 'racket', 65: 'wheelchair_push_walk',
  66: 'wheelchair_push_run', 67: 'meditation', 68: 'para_sport', 69: 'disc_golf',
  70: 'team_sport', 71: 'cricket', 72: 'rugby', 73: 'hockey', 74: 'lacrosse',
  75: 'volleyball', 76: 'water_tubing', 77: 'wakesurfing', 78: 'water_sport',
  79: 'archery', 80: 'mixed_martial_arts', 81: 'motor_sports', 82: 'snorkeling',
  83: 'dance', 84: 'jump_rope', 85: 'pool_apnea', 86: 'mobility', 87: 'geocaching',
  88: 'canoeing', 254: 'all',
};
const SUB_SPORTS: Record<number, string> = {
  0: 'generic', 1: 'treadmill', 2: 'street', 3: 'trail', 4: 'track', 5: 'spin',
  6: 'indoor_cycling', 7: 'road', 8: 'mountain', 9: 'downhill', 10: 'recumbent',
  11: 'cyclocross', 12: 'hand_cycling', 13: 'track_cycling', 14: 'indoor_rowing',
  15: 'elliptical', 16: 'stair_climbing', 17: 'lap_swimming', 18: 'open_water',
  19: 'flexibility_training', 20: 'strength_training', 21: 'warm_up', 22: 'match',
  23: 'exercise', 24: 'challenge', 25: 'indoor_skiing', 26: 'cardio_training',
  27: 'indoor_walking', 28: 'e_bike_fitness', 29: 'bmx', 30: 'casual_walking',
  31: 'speed_walking', 32: 'bike_to_run_transition', 33: 'run_to_bike_transition',
  34: 'swim_to_bike_transition', 35: 'atv', 36: 'motocross', 37: 'backcountry',
  38: 'resort', 39: 'rc_drone', 40: 'wingsuit', 41: 'whitewater', 42: 'skate_skiing',
  43: 'yoga', 44: 'pilates', 45: 'indoor_running', 46: 'gravel_cycling',
  47: 'e_bike_mountain', 48: 'commuting', 49: 'mixed_surface', 50: 'navigate',
  51: 'track_me', 52: 'map', 53: 'single_gas_diving', 54: 'multi_gas_diving',
  55: 'gauge_diving', 56: 'apnea_diving', 57: 'apnea_hunting', 58: 'virtual_activity',
  59: 'obstacle', 62: 'breathing', 63: 'ccr_diving', 65: 'sail_race', 66: 'expedition',
  67: 'ultra', 68: 'indoor_climbing', 69: 'bouldering', 70: 'hiit', 71: 'indoor_grinding',
  72: 'hunting_with_dogs', 73: 'amrap', 74: 'emom', 75: 'tabata', 77: 'esport',
  78: 'triathlon', 79: 'duathlon', 80: 'brick', 81: 'swim_run', 82: 'adventure_race',
  83: 'trucker_workout', 84: 'pickleball', 85: 'padel', 86: 'indoor_wheelchair_walk',
  87: 'indoor_wheelchair_run', 88: 'indoor_hand_cycling', 90: 'field', 91: 'ice',
  92: 'ultimate', 93: 'platform', 94: 'squash', 95: 'badminton', 96: 'racquetball',
  97: 'table_tennis', 98: 'overland', 99: 'trolling_motor', 110: 'fly_canopy',
  111: 'fly_paraglide', 112: 'fly_paramotor', 113: 'fly_pressurized', 114: 'fly_navigate',
  115: 'fly_timer', 116: 'fly_altimeter', 117: 'fly_wx', 118: 'fly_vfr', 119: 'fly_ifr',
  121: 'dynamic_apnea', 123: 'enduro', 124: 'rucking', 125: 'rally',
  126: 'pool_triathlon', 127: 'e_bike_enduro', 254: 'all',
};
const ACTIVITY_TYPES: Record<number, string> = {
  0: 'generic', 1: 'running', 2: 'cycling', 3: 'transition', 4: 'fitness_equipment',
  5: 'swimming', 6: 'walking', 8: 'sedentary', 13: 'wheelchair_pushing',
};

function enumName(value: number | null, table: Record<number, string>, kind: string): string | undefined {
  return value === null ? undefined : table[value] ?? `fit_${kind}_${value}`;
}

function enumNumber(value: string, table: Record<number, string>, kind: string): number {
  const normalized = value.replace(/[\s_-]/g, '').toLowerCase();
  const entry = Object.entries(table).find(([, name]) => name.replace(/_/g, '') === normalized);
  if (entry) return Number(entry[0]);
  const raw = new RegExp(`^fit_${kind}_(\\d+)$`).exec(value);
  if (raw && Number(raw[1]) < 255) return Number(raw[1]);
  return fail(`unsupported ${kind.replace(/_/g, ' ')} "${value}"`);
}

function cadenceFactor(sport: string): number {
  return sport.toLowerCase() === 'running' ? 2 : 1;
}

interface Metric {
  key: keyof ActivitySummary;
  session: number;
  lap: number;
  baseType: number;
  scale?: number;
  aggregate: 'sum' | 'avg' | 'max' | 'min' | 'single';
}

const METRICS: Metric[] = [
  { key: 'totalElapsedTime', session: 7, lap: 7, baseType: 0x86, scale: 1000, aggregate: 'sum' },
  { key: 'duration', session: 8, lap: 8, baseType: 0x86, scale: 1000, aggregate: 'sum' },
  { key: 'distance', session: 9, lap: 9, baseType: 0x86, scale: 100, aggregate: 'sum' },
  { key: 'totalCalories', session: 11, lap: 11, baseType: 0x84, aggregate: 'sum' },
  { key: 'avgSpeed', session: 124, lap: 110, baseType: 0x86, scale: 1000, aggregate: 'avg' },
  { key: 'maxSpeed', session: 125, lap: 111, baseType: 0x86, scale: 1000, aggregate: 'max' },
  { key: 'avgHeartRate', session: 16, lap: 15, baseType: 2, aggregate: 'avg' },
  { key: 'maxHeartRate', session: 17, lap: 16, baseType: 2, aggregate: 'max' },
  { key: 'avgCadence', session: 18, lap: 17, baseType: 2, aggregate: 'avg' },
  { key: 'maxCadence', session: 19, lap: 18, baseType: 2, aggregate: 'max' },
  { key: 'avgPower', session: 20, lap: 19, baseType: 0x84, aggregate: 'avg' },
  { key: 'maxPower', session: 21, lap: 20, baseType: 0x84, aggregate: 'max' },
  { key: 'totalAscent', session: 22, lap: 21, baseType: 0x84, aggregate: 'sum' },
  { key: 'totalDescent', session: 23, lap: 22, baseType: 0x84, aggregate: 'sum' },
  { key: 'normalizedPower', session: 34, lap: 33, baseType: 0x84, aggregate: 'single' },
  { key: 'avgTemperature', session: 57, lap: 50, baseType: 1, aggregate: 'avg' },
  { key: 'maxTemperature', session: 58, lap: 51, baseType: 1, aggregate: 'max' },
  { key: 'minTemperature', session: 150, lap: 124, baseType: 1, aggregate: 'min' },
  { key: 'totalMovingTime', session: 59, lap: 52, baseType: 0x86, scale: 1000, aggregate: 'sum' },
  { key: 'avgVerticalOscillation', session: 89, lap: 77, baseType: 0x84, scale: 10, aggregate: 'avg' },
  { key: 'avgStanceTimePercent', session: 90, lap: 78, baseType: 0x84, scale: 100, aggregate: 'avg' },
  { key: 'avgStanceTime', session: 91, lap: 79, baseType: 0x84, scale: 10, aggregate: 'avg' },
  { key: 'avgVerticalRatio', session: 132, lap: 118, baseType: 0x84, scale: 100, aggregate: 'avg' },
  { key: 'avgStanceTimeBalance', session: 133, lap: 119, baseType: 0x84, scale: 100, aggregate: 'avg' },
  { key: 'avgStepLength', session: 134, lap: 120, baseType: 0x84, scale: 10, aggregate: 'avg' },
  { key: 'totalCycles', session: 10, lap: 10, baseType: 0x86, aggregate: 'sum' },
];

function readSummary(message: FITMessage, fallbackSport: string): Partial<ActivitySummary> {
  const session = message.globalMessageNumber === 18;
  const sport = enumName(nativeNumber(message, session ? 5 : 25), SPORTS, 'sport') ?? fallbackSport;
  const subSport = enumName(nativeNumber(message, session ? 6 : 39), SUB_SPORTS, 'sub_sport');
  const summary: Partial<ActivitySummary> = { sport };
  if (subSport) summary.subSport = subSport;
  for (const metric of METRICS) {
    let value = nativeNumber(message, session ? metric.session : metric.lap);
    if (value === null && (metric.key === 'avgSpeed' || metric.key === 'maxSpeed')) {
      value = nativeNumber(message, (session ? 14 : 13) + (metric.key === 'maxSpeed' ? 1 : 0));
    }
    if (value === null) continue;
    value /= metric.scale ?? 1;
    if (metric.key === 'avgCadence' || metric.key === 'maxCadence') {
      value = (value + (nativeNumber(message, (session ? 92 : 80) + (metric.key === 'maxCadence' ? 1 : 0)) ?? 0) / 128)
        * cadenceFactor(sport);
    }
    if (metric.key === 'totalCycles') value += (nativeNumber(message, session ? 94 : 82) ?? 0) / 128;
    Object.assign(summary, { [metric.key]: value });
  }
  return summary;
}

function aggregateSummaries(summaries: Partial<ActivitySummary>[]): Partial<ActivitySummary> {
  if (summaries.length === 1) return { ...summaries[0] };
  const result: Partial<ActivitySummary> = {};
  for (const metric of METRICS) {
    let total = 0;
    let weights = 0;
    let count = 0;
    let extreme = metric.aggregate === 'min' ? Infinity : -Infinity;
    for (const summary of summaries) {
      const value = summary[metric.key];
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      const weight = summary.duration && summary.duration > 0 ? summary.duration : 1;
      total += value * (metric.aggregate === 'avg' ? weight : 1);
      weights += weight;
      count++;
      extreme = metric.aggregate === 'min' ? Math.min(extreme, value) : Math.max(extreme, value);
    }
    if (!count || (metric.aggregate === 'single' && summaries.length !== 1)) continue;
    Object.assign(result, {
      [metric.key]: metric.aggregate === 'avg' ? total / weights
        : metric.aggregate === 'min' || metric.aggregate === 'max' ? extreme : total,
    });
  }
  const sports = new Set(summaries.map((summary) => summary.sport).filter(Boolean));
  if (sports.size) result.sport = sports.size === 1 ? [...sports][0] : 'multisport';
  if (new Set([...sports].map((sport) => cadenceFactor(sport!))).size > 1) {
    result.avgCadence = null;
    result.maxCadence = null;
  }
  const subSports = new Set(summaries.map((summary) => summary.subSport).filter(Boolean));
  if (subSports.size) result.subSport = subSports.size === 1 ? [...subSports][0] : 'generic';
  return result;
}

function meanAndMax(points: Trackpoint[], key: keyof Trackpoint): { mean: number | null; max: number | null } {
  let sum = 0;
  let count = 0;
  let max = -Infinity;
  for (const point of points) {
    const value = point[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    sum += value;
    count++;
    if (value > max) max = value;
  }
  return { mean: count ? sum / count : null, max: count ? max : null };
}

function completeSummary(points: Trackpoint[], source: Partial<ActivitySummary>): ActivitySummary {
  const cadence = meanAndMax(points, 'cad');
  const heartRate = meanAndMax(points, 'hr');
  const speed = meanAndMax(points, 'speed');
  const elevationMeasured = points.some((point) => point.ele !== null);
  const fallback = calculateActivitySummary(points, {
    ...source,
    avgHeartRate: source.avgHeartRate ?? heartRate.mean,
    maxHeartRate: source.maxHeartRate ?? heartRate.max,
    avgCadence: source.avgCadence ?? cadence.mean,
    maxCadence: source.maxCadence ?? cadence.max,
  });
  const summary: ActivitySummary = {
    ...fallback,
    totalAscent: source.totalAscent ?? (elevationMeasured ? fallback.totalAscent : null),
    totalDescent: source.totalDescent ?? (elevationMeasured ? fallback.totalDescent : null),
    avgSpeed: source.avgSpeed ?? speed.mean,
    maxSpeed: source.maxSpeed ?? speed.max,
    avgStepLength: meanAndMax(points, 'stepLength').mean,
    avgVerticalOscillation: meanAndMax(points, 'verticalOscillation').mean,
    avgStanceTime: meanAndMax(points, 'stanceTime').mean,
    avgStanceTimePercent: meanAndMax(points, 'stanceTimePercent').mean,
    avgStanceTimeBalance: meanAndMax(points, 'stanceTimeBalance').mean,
    avgVerticalRatio: meanAndMax(points, 'verticalRatio').mean,
    avgTemperature: meanAndMax(points, 'temp').mean,
    maxTemperature: meanAndMax(points, 'temp').max,
    ...source,
  };
  summary.avgPaceSecs = summary.distance > 0 && summary.duration > 0
    ? summary.duration * 1000 / summary.distance : 0;
  return summary;
}

function recordedTimerDuration(messages: FITMessage[]): number | null {
  let start: number | null = null;
  let duration = 0;
  let completed = false;
  for (const message of messages) {
    if (message.globalMessageNumber !== 21 || nativeNumber(message, 0) !== 0
      || (nativeNumber(message, 4) ?? 0) !== 0) continue;
    const time = nativeNumber(message, 253);
    const type = nativeNumber(message, 1);
    if (time === null) continue;
    if (type === 0) start ??= time;
    else if (type !== null && [1, 4, 8, 9].includes(type)) {
      if (start !== null && time >= start) {
        duration += time - start;
        completed = true;
      }
      start = null;
    }
  }
  return completed && start === null ? duration : null;
}

/**
 * Decode a CRC-checked FIT activity without dependencies, DOM APIs, or Node globals.
 * Unknown native/developer data is retained in typed, structured-cloneable metadata.
 */
export function parseFIT(input: ArrayBuffer | Uint8Array, options?: ParseTrackOptions): Activity {
  const decoded = readMessages(input);
  const nonRecords = decoded.messages.filter((message) => message.globalMessageNumber !== 20);
  const records = decoded.messages.filter((message) => message.globalMessageNumber === 20);
  const sessions = nonRecords.filter((message) => message.globalMessageNumber === 18);
  const laps = nonRecords.filter((message) => message.globalMessageNumber === 19);
  const sportMessage = nonRecords.find((message) => message.globalMessageNumber === 12);
  const fallbackSport = enumName(sessions[0] ? nativeNumber(sessions[0], 5) : null, SPORTS, 'sport')
    ?? (sportMessage ? enumName(nativeNumber(sportMessage, 0), SPORTS, 'sport') : undefined) ?? 'generic';
  for (const message of sessions) message.summary = readSummary(message, fallbackSport);
  for (const message of laps) {
    const session = sessions.find((candidate) => {
      const lapStart = nativeNumber(message, 2);
      const sessionStart = nativeNumber(candidate, 2);
      const lapEnd = nativeNumber(message, 253);
      const sessionEnd = nativeNumber(candidate, 253);
      return lapStart !== null && sessionStart !== null && lapEnd !== null && sessionEnd !== null
        && lapStart >= sessionStart && lapEnd <= sessionEnd;
    }) ?? sessions.find((candidate) => candidate.recordIndex >= message.recordIndex);
    message.summary = readSummary(message, session?.summary?.sport ?? fallbackSport);
  }
  let distanceAccumulator = 0;
  const indexedSessions = sessions.every((session, index) =>
    session.recordIndex > (index ? sessions[index - 1].recordIndex : 0));
  const points: Trackpoint[] = records.map((message, index) => {
    const timestamp = nativeNumber(message, 253);
    const timedSessions = sessions.filter((candidate) => {
      const start = nativeNumber(candidate, 2);
      const end = nativeNumber(candidate, 253);
      return timestamp !== null && start !== null && end !== null && timestamp >= start && timestamp <= end;
    });
    const session = (indexedSessions ? sessions.find((candidate) => candidate.recordIndex > index) : undefined)
      ?? timedSessions[timedSessions.length - 1] ?? sessions.find((candidate) => candidate.recordIndex > index);
    const activityType = nativeNumber(message, 42);
    const sessionSport = session?.summary?.sport;
    const sport = sessionSport && sessionSport !== 'generic' && sessionSport !== 'multisport'
      ? sessionSport
      : (activityType !== null && activityType !== 0 ? ACTIVITY_TYPES[activityType] : undefined)
        ?? sessionSport ?? fallbackSport;
    const get = (number: number, scale = 1, offset = 0): number | null => {
      const native = nativeNumber(message, number);
      if (native !== null) return native / scale - offset;
      for (const field of message.developerFields) {
        if (field.nativeFieldNumber !== number) continue;
        if (field.nativeMessageNumber !== undefined && field.nativeMessageNumber !== 20) continue;
        if (typeof field.value === 'number' && Number.isFinite(field.value)) return field.value;
      }
      return null;
    };
    const rawLat = get(0);
    const rawLon = get(1);
    const lat = rawLat === null ? null : rawLat * SEMICIRCLES_TO_DEGREES;
    const lon = rawLon === null ? null : rawLon * SEMICIRCLES_TO_DEGREES;
    let distance = get(5, 100);
    let speed = get(73, 1000) ?? get(6, 1000);
    const packed = message.fields.find((field) => field.number === 8)?.data;
    if (packed && packed.length >= 3 && !packed.every((byte) => byte === 0xff)) {
      const speedBits = packed[0] | ((packed[1] & 15) << 8);
      const distanceBits = (packed[1] >>> 4) | (packed[2] << 4);
      speed ??= speedBits / 100;
      distanceAccumulator += (distanceBits - (distanceAccumulator % 4096) + 4096) % 4096;
      distance ??= distanceAccumulator / 16;
    }
    if (distance !== null) distanceAccumulator = Math.floor(distance * 16);
    const cadence = get(4);
    return {
      lat: lat !== null && Math.abs(lat) <= 90 ? lat : null,
      lon: lon !== null && Math.abs(lon) <= 180 ? lon : null,
      ele: get(78, 5, 500) ?? get(2, 5, 500),
      time: dateFromTimestamp(timestamp),
      hr: get(3),
      cad: cadence === null ? null : (cadence + (get(53, 128) ?? 0)) * cadenceFactor(sport),
      cadenceUnit: cadenceFactor(sport) === 2 ? 'steps/min' : 'cycles/min',
      distance,
      recordedDistance: distance,
      speed,
      power: get(7),
      temp: get(13),
      stepLength: get(85, 10),
      verticalOscillation: get(39, 10),
      stanceTime: get(41, 10),
      stanceTimePercent: get(40, 100),
      verticalRatio: get(83, 100),
      stanceTimeBalance: get(84, 100),
      sport,
      fit: {
        littleEndian: message.littleEndian,
        fields: message.fields,
        developerFields: message.developerFields,
      },
    };
  });
  const source = {
    ...aggregateSummaries(laps.map((message) => message.summary!)),
    ...aggregateSummaries(sessions.map((message) => message.summary!)),
  };
  if (source.duration === undefined) {
    const activity = nonRecords.find((message) => message.globalMessageNumber === 34);
    const timerTime = activity ? nativeNumber(activity, 0) : null;
    const duration = timerTime !== null ? timerTime / 1000 : recordedTimerDuration(nonRecords);
    if (duration !== null) source.duration = duration;
  }
  if (!source.sport) {
    const sports = new Set(points.map((point) => point.sport));
    source.sport = sports.size === 1 ? points[0].sport : sports.size > 1 ? 'multisport' : fallbackSport;
    if (new Set([...sports].map((sport) => cadenceFactor(sport!))).size > 1) {
      source.avgCadence = null;
      source.maxCadence = null;
    }
  }
  if (!source.subSport && sportMessage) {
    source.subSport = enumName(nativeNumber(sportMessage, 1), SUB_SPORTS, 'sub_sport');
  }
  const summary = completeSummary(points, source);
  return {
    name: sessions.map((message) => nativeString(message, 110)).find(Boolean)
      ?? (sportMessage ? nativeString(sportMessage, 3) : undefined)
      ?? getLocale(options?.locale).files.defaultActivityName,
    points,
    summary,
    recordedDistance: source.distance ?? null,
    recordedDuration: source.duration ?? null,
    recordedLaps: laps.map((lap) => ({
      startTime: dateFromTimestamp(nativeNumber(lap, 2)),
      endTime: dateFromTimestamp(nativeNumber(lap, 253)),
      distance: lap.summary?.distance ?? null,
      endTimeBasis: 'recorded',
    })),
    fit: {
      protocolVersion: decoded.protocolVersion,
      profileVersion: decoded.profileVersion,
      recordCount: points.length,
      sourceSummary: { ...summary },
      messages: nonRecords,
    },
  };
}

function numberField(number: number, baseType: number, value: number, littleEndian = true): FITField {
  if (!Number.isFinite(value)) fail(`non-finite value for field ${number}`);
  const type = baseType & 0x1f;
  const rounded = Math.round(value);
  const ranges: Record<number, [number, number]> = {
    0: [0, 254], 1: [-128, 126], 2: [0, 254], 3: [-32768, 32766],
    4: [0, 65534], 5: [-2147483648, 2147483646], 6: [0, 4294967294],
    10: [1, 255], 11: [1, 65535], 12: [1, 4294967295],
  };
  const range = ranges[type];
  if (!range || rounded < range[0] || rounded > range[1]) fail(`value ${value} is outside field ${number}'s FIT range`);
  const data = new Uint8Array(TYPE_SIZE[type]);
  const view = new DataView(data.buffer);
  switch (type) {
    case 0: case 2: case 10: view.setUint8(0, rounded); break;
    case 1: view.setInt8(0, rounded); break;
    case 3: view.setInt16(0, rounded, littleEndian); break;
    case 4: case 11: view.setUint16(0, rounded, littleEndian); break;
    case 5: view.setInt32(0, rounded, littleEndian); break;
    case 6: case 12: view.setUint32(0, rounded, littleEndian); break;
  }
  return { number, baseType, data, value: rounded };
}

function stringField(number: number, value: string): FITField {
  const encoded = encoder.encode(value.replace(/\0/g, ''));
  let size = Math.min(encoded.length, 254);
  // Field sizes are one byte; avoid cutting a UTF-8 code point at the boundary.
  while (size < encoded.length && size > 0 && (encoded[size] & 0xc0) === 0x80) size--;
  const data = new Uint8Array(size + 1);
  data.set(encoded.subarray(0, size));
  return { number, baseType: 7, data, value: decoder.decode(data.subarray(0, size)) };
}

class BinaryWriter {
  private readonly chunks: Uint8Array[] = [];
  private readonly definitions = new Map<string, number>();
  private readonly slots: string[] = [];
  private nextSlot = 0;
  private size = 0;

  private append(bytes: Uint8Array): void {
    this.size += bytes.length;
    if (this.size > 0xffffffff) fail('output exceeds the FIT data-size limit');
    this.chunks.push(bytes);
  }

  write(message: FITMessage): void {
    if (message.fields.length > 255 || message.developerFields.length > 255) fail('too many message fields');
    if (!Number.isInteger(message.globalMessageNumber) || message.globalMessageNumber < 0 || message.globalMessageNumber > 65534) {
      fail('invalid global message number in metadata');
    }
    const nativeNumbers = new Set<number>();
    const developerNumbers = new Set<string>();
    for (const field of message.fields) {
      if (!Number.isInteger(field.number) || field.number < 0 || field.number >= 255 || nativeNumbers.has(field.number)) {
        fail('invalid or duplicate native field in metadata');
      }
      nativeNumbers.add(field.number);
      if (!(field.data instanceof Uint8Array) || field.data.length === 0 || field.data.length > 255) {
        fail('invalid native field bytes in metadata');
      }
      if (!Number.isInteger(field.baseType) || field.baseType < 0 || field.baseType > 255) fail('invalid field base type');
      const size = TYPE_SIZE[field.baseType & 0x1f];
      if (size && field.data.length % size !== 0) fail('invalid field size in metadata');
    }
    for (const field of message.developerFields) {
      const key = developerKey(field.developerDataIndex, field.number);
      if (!Number.isInteger(field.number) || field.number < 0 || field.number >= 255
        || !Number.isInteger(field.developerDataIndex) || field.developerDataIndex < 0 || field.developerDataIndex >= 255
        || developerNumbers.has(key)) fail('invalid or duplicate developer field in metadata');
      developerNumbers.add(key);
      if (!(field.data instanceof Uint8Array) || field.data.length === 0 || field.data.length > 255) {
        fail('invalid developer field bytes in metadata');
      }
    }
    const signature = JSON.stringify([
      message.globalMessageNumber, message.littleEndian,
      message.fields.map((field) => [field.number, field.data.length, field.baseType]),
      message.developerFields.map((field) => [field.number, field.data.length, field.developerDataIndex]),
    ]);
    let local = this.definitions.get(signature);
    if (local === undefined) {
      local = this.nextSlot;
      this.nextSlot = (this.nextSlot + 1) % 16;
      this.definitions.delete(this.slots[local]);
      this.slots[local] = signature;
      this.definitions.set(signature, local);
      const hasDeveloper = message.developerFields.length > 0;
      const definition = new Uint8Array(6 + message.fields.length * 3 + (hasDeveloper ? 1 + message.developerFields.length * 3 : 0));
      definition[0] = 0x40 | (hasDeveloper ? 0x20 : 0) | local;
      definition[2] = message.littleEndian ? 0 : 1;
      new DataView(definition.buffer).setUint16(3, message.globalMessageNumber, message.littleEndian);
      definition[5] = message.fields.length;
      let at = 6;
      for (const field of message.fields) {
        definition.set([field.number, field.data.length, field.baseType], at);
        at += 3;
      }
      if (hasDeveloper) {
        definition[at++] = message.developerFields.length;
        for (const field of message.developerFields) {
          definition.set([field.number, field.data.length, field.developerDataIndex], at);
          at += 3;
        }
      }
      this.append(definition);
    }
    const fields = [...message.fields, ...message.developerFields];
    const data = new Uint8Array(1 + fields.reduce((total, field) => total + field.data.length, 0));
    data[0] = local;
    let at = 1;
    for (const field of fields) {
      data.set(field.data, at);
      at += field.data.length;
    }
    this.append(data);
  }

  finish(profileVersion: number): Uint8Array {
    const bytes = new Uint8Array(14 + this.size + 2);
    const view = new DataView(bytes.buffer);
    bytes.set([14, 0x20]);
    view.setUint16(2, profileVersion, true);
    view.setUint32(4, this.size, true);
    bytes.set([0x2e, 0x46, 0x49, 0x54], 8);
    view.setUint16(12, crc16(bytes, 0, 12), true);
    let position = 14;
    for (const chunk of this.chunks) {
      bytes.set(chunk, position);
      position += chunk.length;
    }
    view.setUint16(position, crc16(bytes, 0, position), true);
    return bytes;
  }
}

function makeMessage(
  globalMessageNumber: number,
  fields: FITField[],
  source?: FITRecordMetadata,
  managed?: Set<number>,
  preserveNative = true
): FITMessage {
  const used = new Set(fields.map((field) => field.number));
  return {
    globalMessageNumber,
    littleEndian: source?.littleEndian ?? true,
    recordIndex: 0,
    fields: [
      ...(preserveNative ? source?.fields.filter((field) => !used.has(field.number) && !managed?.has(field.number)) ?? [] : []),
      ...fields,
    ],
    developerFields: source?.developerFields ?? [],
  };
}

function addNumber(
  fields: FITField[], number: number, baseType: number, value: number | null | undefined,
  littleEndian: boolean, scale = 1, offset = 0
): void {
  if (value != null) fields.push(numberField(number, baseType, (value + offset) * scale, littleEndian));
}

function addCadence(fields: FITField[], integerNumber: number, fractionalNumber: number, value: number | null | undefined, factor: number, littleEndian: boolean): void {
  if (value == null) return;
  const ticks = Math.round(value / factor * 128);
  fields.push(numberField(integerNumber, 2, Math.floor(ticks / 128), littleEndian));
  fields.push(numberField(fractionalNumber, 2, ticks % 128, littleEndian));
}

const RECORD_MANAGED = new Set([253, 0, 1, 2, 3, 4, 5, 6, 7, 8, 13, 39, 40, 41, 42, 53, 73, 78, 83, 84, 85]);

function recordMessage(point: Trackpoint, fallbackSport: string): FITMessage {
  const fields: FITField[] = [];
  const littleEndian = point.fit?.littleEndian ?? true;
  const sport = point.sport ?? fallbackSport;
  const factor = cadenceFactor(sport);
  // Legacy GPX/TCX points use single-leg cadence below 120; marked points are already canonical.
  const cadence = factor === 2 && point.sport === undefined && point.cadenceUnit === undefined
    && point.cad !== null && point.cad < 120 ? point.cad * 2 : point.cad;
  const developerOwns = (numbers: number[], value: number | null | undefined) => value != null
    && !numbers.some((number) => point.fit && nativeNumber(point.fit, number) !== null)
    && point.fit?.developerFields.some((field) => field.nativeFieldNumber !== undefined
      && numbers.includes(field.nativeFieldNumber)
      && (field.nativeMessageNumber === undefined || field.nativeMessageNumber === 20)
      && field.value === value);
  const add = (number: number, type: number, value: number | null | undefined, scale = 1) => {
    if (!developerOwns([number], value)) addNumber(fields, number, type, value, littleEndian, scale);
  };
  const timestamp = timestampFromDate(point.time);
  if (timestamp !== null) fields.push(numberField(253, 0x86, timestamp, littleEndian));
  else {
    const relative = point.fit?.fields.find((field) => field.number === 253);
    if (relative && typeof relative.value === 'number' && relative.value < ABSOLUTE_TIME_MIN) fields.push(relative);
  }
  for (const [number, coordinate, limit] of [[0, point.lat, 90], [1, point.lon, 180]] as const) {
    if (coordinate === null || coordinate === undefined) continue;
    if (!Number.isFinite(coordinate) || Math.abs(coordinate) > limit) fail('invalid GPS coordinate');
    const normalized = coordinate === 180 ? -180 : coordinate;
    const raw = Math.min(0x7ffffffe, Math.round(normalized / SEMICIRCLES_TO_DEGREES));
    fields.push(numberField(number, 0x85, raw, littleEndian));
  }
  if (!developerOwns([2, 78], point.ele)) {
    addNumber(fields, 78, 0x86, point.ele, littleEndian, 5, 500);
    if (point.ele != null && point.ele <= 12606.8) addNumber(fields, 2, 0x84, point.ele, littleEndian, 5, 500);
  }
  add(3, 2, point.hr);
  if (!developerOwns([4], cadence == null ? null : cadence / factor)) {
    addCadence(fields, 4, 53, cadence, factor, littleEndian);
  }
  add(5, 0x86, point.distance, 100);
  if (!developerOwns([6, 73], point.speed)) {
    addNumber(fields, 73, 0x86, point.speed, littleEndian, 1000);
    if (point.speed != null && point.speed <= 65.534) addNumber(fields, 6, 0x84, point.speed, littleEndian, 1000);
  }
  add(7, 0x84, point.power);
  add(13, 1, point.temp);
  add(39, 0x84, point.verticalOscillation, 10);
  add(40, 0x84, point.stanceTimePercent, 100);
  add(41, 0x84, point.stanceTime, 10);
  add(83, 0x84, point.verticalRatio, 100);
  add(84, 0x84, point.stanceTimeBalance, 100);
  add(85, 0x84, point.stepLength, 10);
  const activityType = Object.entries(ACTIVITY_TYPES).find(([, name]) => name === sport)?.[0];
  if (activityType !== undefined) addNumber(fields, 42, 0, Number(activityType), littleEndian);
  return makeMessage(20, fields, point.fit, RECORD_MANAGED);
}

function summaryMatches(source: Partial<ActivitySummary>, current: ActivitySummary, strict = false): boolean {
  return [...METRICS.map((metric) => metric.key), 'sport', 'subSport' as const].every((key) => {
    const before = source[key as keyof ActivitySummary];
    const after = current[key as keyof ActivitySummary];
    return before == null ? !strict || after == null : (typeof before === 'number' && typeof after === 'number'
      ? Math.abs(before - after) < 1e-7 : before === after);
  });
}

function summaryMessage(
  globalMessageNumber: 18 | 19,
  summary: Partial<ActivitySummary>,
  start: number,
  end: number,
  index: number,
  source: FITMessage | undefined,
  preserveNative: boolean,
  lapCount = 0,
  firstLap = 0
): FITMessage {
  const session = globalMessageNumber === 18;
  const littleEndian = source?.littleEndian ?? true;
  const sport = summary.sport ?? 'generic';
  const fields = [
    numberField(254, 0x84, index, littleEndian),
    numberField(253, 0x86, end, littleEndian),
    numberField(0, 0, session ? 8 : 9, littleEndian),
    numberField(1, 0, 1, littleEndian),
    numberField(2, 0x86, start, littleEndian),
    numberField(session ? 5 : 25, 0, enumNumber(sport, SPORTS, 'sport'), littleEndian),
  ];
  const managed = new Set(session
    ? [254, 253, 0, 1, 2, 3, 4, 5, 6, 14, 15, 25, 26, 28, 29, 30, 31, 32, 38, 39, 92, 93, 94]
    : [254, 253, 0, 1, 2, 3, 4, 5, 6, 13, 14, 23, 24, 25, 39, 80, 81, 82]);
  if (summary.subSport != null) fields.push(numberField(session ? 6 : 39, 0, enumNumber(summary.subSport, SUB_SPORTS, 'sub_sport'), littleEndian));
  for (const metric of METRICS) {
    const number = session ? metric.session : metric.lap;
    managed.add(number);
    const value = summary[metric.key];
    if (typeof value !== 'number') continue;
    if (metric.key === 'avgCadence' || metric.key === 'maxCadence') {
      addCadence(fields, number, (session ? 92 : 80) + (metric.key === 'maxCadence' ? 1 : 0), value, cadenceFactor(sport), littleEndian);
    } else if (metric.key === 'totalCycles') {
      const ticks = Math.round(value * 128);
      fields.push(numberField(number, 0x86, Math.floor(ticks / 128), littleEndian));
      fields.push(numberField(session ? 94 : 82, 2, ticks % 128, littleEndian));
    } else {
      addNumber(fields, number, metric.baseType, value, littleEndian, metric.scale);
      if ((metric.key === 'avgSpeed' || metric.key === 'maxSpeed') && value <= 65.534) {
        addNumber(fields, (session ? 14 : 13) + (metric.key === 'maxSpeed' ? 1 : 0), 0x84, value, littleEndian, 1000);
      }
    }
  }
  if (session) {
    fields.push(numberField(26, 0x84, lapCount, littleEndian));
    fields.push(numberField(28, 0, preserveNative && source ? nativeNumber(source, 28) ?? 0 : 0, littleEndian));
    if (lapCount > 0) fields.push(numberField(25, 0x84, firstLap, littleEndian));
  } else {
    fields.push(numberField(23, 0, preserveNative && source ? nativeNumber(source, 23) ?? 0 : 0, littleEndian));
    fields.push(numberField(24, 0, preserveNative && source ? nativeNumber(source, 24) ?? 7 : 7, littleEndian));
  }
  return makeMessage(globalMessageNumber, fields, source, managed, preserveNative);
}

function assertDeveloperMetadata(messages: FITMessage[], points: Trackpoint[]): void {
  const developers = new Set<number>();
  const descriptions: DeveloperDescriptions = new Map();
  for (const message of messages) {
    if (message.globalMessageNumber === 207) {
      const index = nativeNumber(message, 3);
      if (index !== null) developers.add(index);
    }
    if (message.globalMessageNumber === 206) {
      const index = nativeNumber(message, 0);
      const number = nativeNumber(message, 1);
      if (index !== null && number !== null) {
        const key = developerKey(index, number);
        const prior = descriptions.get(key);
        if (prior && JSON.stringify(prior.fields.map((field) => [field.number, Array.from(field.data)]))
          !== JSON.stringify(message.fields.map((field) => [field.number, Array.from(field.data)]))) {
          fail(`conflicting developer descriptions for ${key}; remap developer indexes before merging FIT metadata`);
        }
        descriptions.set(key, message);
      }
    }
  }
  const check = (fields: FITDeveloperField[]) => {
    for (const field of fields) {
      const key = developerKey(field.developerDataIndex, field.number);
      if (!developers.has(field.developerDataIndex) || !descriptions.has(key)) {
        fail(`developer field ${key} needs its developer_data_id and field_description in activity.fit`);
      }
    }
  };
  for (const message of messages) check(message.developerFields);
  for (const point of points) check(point.fit?.developerFields ?? []);
}

/**
 * Encode an activity with valid FIT definitions, header/file CRCs and refreshed summaries.
 * No wall clock, sample interval, missing sensor value, or timezone is invented.
 * Drop opaque metadata for privacy, and source summary metadata after changing its scope.
 * Legacy unmarked running cadence below 120 is interpreted as strides/minute.
 * Set point.sport or point.cadenceUnit to preserve low canonical cadence without that heuristic.
 */
export function serializeToFIT(activity: Activity, options?: FITExportOptions): Uint8Array {
  const points = activity.points;
  const metadata = activity.fit?.messages ?? [];
  const sourceSessions = metadata.filter((message) => message.globalMessageNumber === 18);
  const sourceLaps = metadata.filter((message) => message.globalMessageNumber === 19);
  const sourceSummaries = sourceSessions.length ? sourceSessions : sourceLaps;
  const originalSummary = activity.fit?.sourceSummary ?? aggregateSummaries(sourceSummaries.map((message) =>
    message.summary ?? readSummary(message, activity.summary.sport)));
  const summary: ActivitySummary = { ...activity.summary };
  if (summary.avgSpeed == null && summary.distance > 0 && summary.duration > 0) {
    summary.avgSpeed = summary.distance / summary.duration;
  }
  summary.maxSpeed ??= meanAndMax(points, 'speed').max;
  const originalCount = activity.fit?.recordCount ?? metadata.reduce((max, message) => Math.max(max, message.recordIndex), 0);
  const timesUnchanged = points.every((point) => {
    if (!point.fit) return false;
    const before = nativeNumber(point.fit, 253);
    const after = timestampFromDate(point.time);
    return before === after || (after === null && (before === null || before < ABSOLUTE_TIME_MIN));
  });
  const unchanged = (activity.fit?.sourceSummary !== undefined || sourceSummaries.length > 0)
    && originalCount === points.length && timesUnchanged
    && summaryMatches(originalSummary, activity.summary, activity.fit?.sourceSummary !== undefined);

  let first: number | null = null;
  let last: number | null = null;
  for (const point of points) {
    const timestamp = timestampFromDate(point.time);
    if (timestamp === null) continue;
    first = first === null ? timestamp : Math.min(first, timestamp);
    last = last === null ? timestamp : Math.max(last, timestamp);
  }
  const explicitStart = timestampFromDate(options?.startTime);
  const sourceStart = sourceSessions[0] ? nativeNumber(sourceSessions[0], 2) : null;
  const sourceEnd = sourceSessions.length ? nativeNumber(sourceSessions[sourceSessions.length - 1], 253) : null;
  const recordedStart = sourceStart !== null && sourceStart >= ABSOLUTE_TIME_MIN ? sourceStart : null;
  const start = (unchanged ? recordedStart : null) ?? first ?? explicitStart ?? recordedStart;
  if (start === null) {
    fail('export requires a recorded timestamp or an explicit startTime; missing point timestamps are not invented', 'timestamps-required');
  }
  if (!Number.isFinite(summary.totalElapsedTime) || summary.totalElapsedTime < 0
    || !Number.isFinite(summary.duration) || summary.duration < 0
    || !Number.isFinite(summary.distance) || summary.distance < 0) fail('invalid activity duration, elapsed time, or distance');
  const end = Math.max(start, last ?? start, start + Math.round(summary.totalElapsedTime),
    unchanged && sourceEnd !== null ? sourceEnd : start);
  if (end >= 0xffffffff) fail('activity end overflows FIT date_time');

  const retainedSessions = unchanged && sourceSessions.length > 1 ? sourceSessions : [];
  const retainedLaps = !options?.stripLaps && unchanged ? sourceLaps : [];
  const sessionLaps: FITMessage[][] = retainedSessions.map(() => []);
  for (let i = 0; retainedSessions.length && i < retainedLaps.length; i++) {
    const lap = retainedLaps[i];
    const lapIndex = (nativeNumber(lap, 254) ?? i) & 0x0fff;
    let owner = retainedSessions.findIndex((session) => {
      const first = nativeNumber(session, 25);
      const count = nativeNumber(session, 26);
      return first !== null && count !== null && lapIndex >= first && lapIndex < first + count;
    });
    if (owner < 0) {
      owner = retainedSessions.findIndex((session) => {
        const lapStart = nativeNumber(lap, 2);
        const lapEnd = nativeNumber(lap, 253);
        const sessionStart = nativeNumber(session, 2);
        const sessionEnd = nativeNumber(session, 253);
        return lapStart !== null && lapEnd !== null && sessionStart !== null && sessionEnd !== null
          && lapStart >= sessionStart && lapEnd <= sessionEnd;
      });
    }
    if (owner < 0) owner = retainedSessions.findIndex((session) => session.recordIndex >= lap.recordIndex);
    if (owner < 0) fail('source lap cannot be associated with a preserved session');
    sessionLaps[owner].push(lap);
  }
  const sessionLapCounts = retainedSessions.map((_, index) => options?.stripLaps ? 0
    : retainedLaps.length ? sessionLaps[index].length : 1);
  if (!unchanged) {
    for (const message of [...sourceSessions, ...(options?.stripLaps ? [] : sourceLaps)]) {
      if (message.developerFields.length) {
        fail('edited session/lap contains opaque developer aggregates; remove its source summary metadata before export');
      }
    }
  }
  const lapCount = options?.stripLaps ? 0 : retainedLaps.length || 1;
  const checkedMetadata = options?.stripLaps ? metadata.filter((message) => message.globalMessageNumber !== 19) : metadata;
  assertDeveloperMetadata(checkedMetadata, points);
  for (const global of [0, 12, 34]) {
    if (metadata.filter((message) => message.globalMessageNumber === global).slice(1).some((message) => message.developerFields.length)) {
      fail(`multiple message ${global} instances contain developer data; cannot combine them without losing data`);
    }
  }
  const writer = new BinaryWriter();
  const creator = options?.creator ?? 'ApexRun';
  const name = options?.name ?? activity.name ?? getLocale(options?.locale).files.defaultActivityName;
  const sourceFile = metadata.find((message) => message.globalMessageNumber === 0);
  const fileEndian = sourceFile?.littleEndian ?? true;
  writer.write(makeMessage(0, [
    numberField(0, 0, 4, fileEndian),
    numberField(1, 0x84, 255, fileEndian),
    numberField(2, 0x84, 0, fileEndian),
    numberField(4, 0x86, start, fileEndian),
    stringField(8, creator),
  ], sourceFile, new Set([0, 1, 2, 3, 4, 8])));
  // Descriptor messages precede all data using them, regardless of original local-message IDs.
  for (const global of [207, 206]) {
    for (const message of metadata) if (message.globalMessageNumber === global) writer.write(message);
  }
  const sourceSport = metadata.find((message) => message.globalMessageNumber === 12);
  const sportEndian = sourceSport?.littleEndian ?? true;
  const sportFields = [
    numberField(0, 0, enumNumber(summary.sport, SPORTS, 'sport'), sportEndian),
    stringField(3, name),
  ];
  if (summary.subSport != null) sportFields.push(numberField(1, 0, enumNumber(summary.subSport, SUB_SPORTS, 'sub_sport'), sportEndian));
  writer.write(makeMessage(12, sportFields, sourceSport, new Set([0, 1, 3])));

  const extraMessages = new Map<number, FITMessage[]>();
  const replaced = new Set([0, 12, 18, 19, 20, 34, 206, 207]);
  for (const message of metadata) {
    if (replaced.has(message.globalMessageNumber)) continue;
    if (message.globalMessageNumber === 21 && nativeNumber(message, 0) === 0 && !unchanged) {
      if (message.developerFields.length) fail('edited timer event has developer data; remove its source metadata before export');
      continue;
    }
    const index = Math.max(0, Math.min(points.length, message.recordIndex));
    const group = extraMessages.get(index) ?? [];
    group.push(message);
    extraMessages.set(index, group);
  }
  for (let i = 0; i <= points.length; i++) {
    for (const message of extraMessages.get(i) ?? []) writer.write(message);
    if (i < points.length) writer.write(recordMessage(points[i], summary.sport));
  }
  if (!options?.stripLaps) {
    if (retainedSessions.length) {
      let index = 0;
      for (let i = 0; i < retainedSessions.length; i++) {
        const session = retainedSessions[i];
        if (retainedLaps.length) {
          for (const lap of sessionLaps[i]) {
            writer.write(summaryMessage(19, lap.summary ?? readSummary(lap, session.summary?.sport ?? summary.sport),
              nativeNumber(lap, 2) ?? start, nativeNumber(lap, 253) ?? end, index++, lap, true));
          }
        } else {
          writer.write(summaryMessage(19, session.summary ?? readSummary(session, summary.sport),
            nativeNumber(session, 2) ?? start, nativeNumber(session, 253) ?? end, index++, undefined, false));
        }
      }
    } else if (retainedLaps.length) {
      for (let i = 0; i < retainedLaps.length; i++) {
        const lap = retainedLaps[i];
        writer.write(summaryMessage(19, lap.summary ?? readSummary(lap, summary.sport),
          nativeNumber(lap, 2) ?? start, nativeNumber(lap, 253) ?? end, i, lap, true));
      }
    } else {
      writer.write(summaryMessage(19, summary, start, end, 0, sourceLaps.length === 1 ? sourceLaps[0] : undefined, false));
    }
  }
  if (retainedSessions.length) {
    let nextLap = 0;
    for (let i = 0; i < retainedSessions.length; i++) {
      const session = retainedSessions[i];
      const count = sessionLapCounts[i];
      const message = summaryMessage(18, session.summary ?? readSummary(session, summary.sport),
        nativeNumber(session, 2) ?? start, nativeNumber(session, 253) ?? end, i, session, true, count, nextLap);
      if (i === 0) {
        message.fields = message.fields.filter((field) => field.number !== 110);
        message.fields.push(stringField(110, name));
      }
      writer.write(message);
      nextLap += count;
    }
  } else {
    const session = sourceSessions.length === 1 ? sourceSessions[0] : undefined;
    const message = summaryMessage(18, summary, start, end, 0, session, unchanged, lapCount);
    message.fields = message.fields.filter((field) => field.number !== 110);
    message.fields.push(stringField(110, name));
    writer.write(message);
  }
  const sourceActivity = metadata.find((message) => message.globalMessageNumber === 34);
  if (!unchanged && sourceActivity?.developerFields.length) {
    fail('edited activity has opaque developer aggregates; remove its source activity metadata before export');
  }
  const activityEndian = sourceActivity?.littleEndian ?? true;
  writer.write(makeMessage(34, [
    numberField(253, 0x86, end, activityEndian),
    numberField(0, 0x86, summary.duration * 1000, activityEndian),
    numberField(1, 0x84, retainedSessions.length || 1, activityEndian),
    numberField(2, 0, retainedSessions.length > 1 ? 1 : 0, activityEndian),
    numberField(3, 0, 26, activityEndian),
    numberField(4, 0, 1, activityEndian),
  ], sourceActivity, new Set([253, 0, 1, 2, 3, 4, ...(unchanged ? [] : [5])]), unchanged));
  return writer.finish(Math.max(PROFILE_VERSION, activity.fit?.profileVersion ?? 0));
}
