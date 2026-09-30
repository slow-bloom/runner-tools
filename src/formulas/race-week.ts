import { getLocale, type LocaleInput } from '../i18n/index.js';
import { convertPace, KM_PER_MILE } from './pace.js';
import { formatPace } from '../utils/format.js';

export interface RaceWeekParams {
  distanceKm: 5 | 10 | 21.0975 | 42.195;
  raceDay: 'sat' | 'sun';
  weeklyDistance: number;
  unit?: 'km' | 'mi';
  frequency: number;
  goalTimeSeconds: number;
  gunTime: string;
  locale?: LocaleInput;
}

type SessionKind = 'recovery' | 'easy' | 'tuneup' | 'rest' | 'shakeout' | 'activation' | 'race' | 'postrace';

export interface RaceWeekDay {
  name: string;
  tag: string;
  title: string;
  dist: number;
  distanceKm: number;
  type: 'rest' | 'easy' | 'tuneup' | 'shakeout' | 'race';
  pace: string;
  paceKind: 'value' | 'instruction';
  hr: string;
  focus: string;
}

export interface RaceWeekPlan {
  distanceKm: number;
  raceDay: 'sat' | 'sun';
  gunTime: string;
  goalTimeSeconds: number;
  unit: 'km' | 'mi';
  locale: string;
  raceTitle: string;
  baselineDistance: number;
  targetPaceSecondsKm: number;
  targetPaceDisplay: string;
  alternatePaceDisplay: string;
  taperDistance: number;
  taperRatio: number;
  cutPercent: number;
  schedule: RaceWeekDay[];
  timeline: Array<{ mins: number; time: string; dayOffset: number; title: string; desc: string }>;
  fueling: { title: string; description: string };
  phases: Array<{ name: string; split: string; targetPace: string; desc: string }>;
  disclaimer: string;
}

/** Website taper template, not an individualized training prescription. All arithmetic is metric. */
export function createRaceWeekPlan(params: RaceWeekParams): RaceWeekPlan | null {
  const { distanceKm, raceDay, weeklyDistance, frequency, goalTimeSeconds, gunTime, unit = 'km' } = params;
  const raceIndex = [5, 10, 21.0975, 42.195].indexOf(distanceKm);
  if (raceIndex < 0 || !['sat', 'sun'].includes(raceDay) || !['km', 'mi'].includes(unit) ||
    !Number.isFinite(weeklyDistance) || weeklyDistance < 1 || weeklyDistance > 500 ||
    !Number.isInteger(frequency) || frequency < 2 || frequency > 7 ||
    !Number.isFinite(goalTimeSeconds) || goalTimeSeconds <= 0 ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(gunTime)) return null;
  const pace = convertPace({ paceSeconds: goalTimeSeconds / distanceKm });
  if (!pace) return null;
  const loc = getLocale(params.locale);
  const copy = loc.raceWeek;
  const scale = unit === 'mi' ? KM_PER_MILE : 1;
  const baselineKm = weeklyDistance * scale;
  const targetPaceSecondsKm = goalTimeSeconds / distanceKm;
  const paceDisplay = (secondsPerKm: number) => `${formatPace(secondsPerKm * scale)} /${copy.units[unit]}`;
  const targetPaceDisplay = paceDisplay(targetPaceSecondsKm);
  const days: SessionKind[] = raceDay === 'sun'
    ? [frequency >= 5 ? 'recovery' : 'rest', 'easy', 'tuneup', 'rest', 'shakeout', 'activation', 'race']
    : ['easy', 'tuneup', 'rest', 'shakeout', 'activation', 'race', 'postrace'];
  // Lower-frequency runners omit optional sessions before the key tune-up and race-day activation.
  const optional: SessionKind[] = ['recovery', 'shakeout', 'easy', 'activation'];
  for (const kind of optional) {
    if (days.filter((day) => !['rest', 'postrace'].includes(day)).length <= frequency) break;
    const index = days.indexOf(kind);
    if (index >= 0) days[index] = 'rest';
  }
  const rawDistance = (kind: SessionKind): number => {
    if (kind === 'recovery') return Math.max(3, baselineKm * 0.07);
    if (kind === 'easy') return Math.max(4, baselineKm * 0.11);
    if (kind === 'tuneup') return Math.max(5, baselineKm * 0.11);
    if (kind === 'shakeout') return Math.max(3, baselineKm * 0.08);
    if (kind === 'activation') return 2;
    return 0;
  };
  const rawTotal = days.reduce((sum, day) => sum + rawDistance(day), 0);
  const targetRatio = distanceKm >= 21 ? 0.45 : 0.55;
  const volumeScale = Math.min(1, baselineKm * targetRatio / rawTotal);
  const raceDayIndex = raceDay === 'sun' ? 6 : 5;
  const round = (value: number) => Math.round(value * 100) / 100;
  const raceTitle = copy.weekTitle.replace('{race}', copy.raceNames[raceIndex]);
  const schedule: RaceWeekDay[] = days.map((kind, index) => {
    const km = kind === 'race' ? distanceKm : rawDistance(kind) * volumeScale;
    const offset = index - raceDayIndex;
    return {
      name: copy.weekdays[index],
      tag: kind === 'race' ? copy.raceDay : offset > 0 ? `D+${offset}` : `D${offset}`,
      title: kind === 'race' ? `${copy.raceNames[raceIndex]} (${round(distanceKm / scale)} ${copy.units[unit]})` : copy.titles[kind],
      dist: round(km / scale),
      distanceKm: km,
      type: kind === 'race' ? 'race' : kind === 'tuneup' ? 'tuneup'
        : kind === 'easy' ? 'easy' : ['activation', 'shakeout'].includes(kind) ? 'shakeout' : 'rest',
      pace: kind === 'activation' ? copy.strides : kind === 'tuneup' || kind === 'race'
        ? targetPaceDisplay : paceDisplay(targetPaceSecondsKm + 50),
      paceKind: kind === 'activation' ? 'instruction' : 'value',
      hr: kind === 'race' || kind === 'tuneup' ? 'Zone 3' : 'Zone 1 / Zone 2',
      focus: copy.notes[kind],
    };
  });
  const taperKm = schedule.filter((day) => day.type !== 'race').reduce((sum, day) => sum + day.distanceKm, 0);
  const [hour, minute] = gunTime.split(':').map(Number);
  const timeline = [-180, -120, -90, -45, -25, -12, 0].map((mins, index) => {
    const absoluteMinute = hour * 60 + minute + mins;
    const clockMinute = ((absoluteMinute % 1440) + 1440) % 1440;
    return {
      mins,
      time: `${String(Math.floor(clockMinute / 60)).padStart(2, '0')}:${String(clockMinute % 60).padStart(2, '0')}`,
      dayOffset: Math.floor(absoluteMinute / 1440),
      title: copy.timelineTitles[index], desc: copy.timelineNotes[index],
    };
  });
  const boundaries = distanceKm === 21.0975 ? [0, 3, 16, distanceKm]
    : distanceKm === 42.195 ? [0, 10, 30, distanceKm]
      : [0, distanceKm * 0.25, distanceKm * 0.75, distanceKm];
  const phases = [0, 1, 2].map((index) => ({
    name: copy.phaseNames[index],
    split: `${round(boundaries[index] / scale)} - ${round(boundaries[index + 1] / scale)} ${copy.units[unit]}`,
    targetPace: paceDisplay(targetPaceSecondsKm + (index === 0 ? 8 : index === 2 && distanceKm < 40 ? -5 : 0)),
    desc: copy.phaseNotes[index],
  }));
  return {
    distanceKm, raceDay, gunTime, goalTimeSeconds, unit, locale: loc.locale, raceTitle,
    baselineDistance: weeklyDistance, targetPaceSecondsKm, targetPaceDisplay,
    alternatePaceDisplay: unit === 'km'
      ? `${pace.speedKmh.toFixed(1)} ${copy.units.speedKm} | ${formatPace(targetPaceSecondsKm * KM_PER_MILE)} /${copy.units.mi}`
      : `${pace.speedMph.toFixed(1)} ${copy.units.speedMi} | ${formatPace(targetPaceSecondsKm)} /${copy.units.km}`,
    taperDistance: round(taperKm / scale), taperRatio: taperKm / baselineKm,
    cutPercent: Math.round((1 - taperKm / baselineKm) * 100), schedule, timeline, phases,
    fueling: { title: copy.fuelingTitles[raceIndex], description: copy.fuelingNotes[raceIndex] },
    disclaimer: copy.disclaimer,
  };
}

function escapeCalendar(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

function foldCalendarLine(value: string): string {
  const encoder = new TextEncoder();
  let result = '';
  let bytes = 0;
  for (const character of value) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) { result += '\r\n '; bytes = 1; }
    result += character;
    bytes += size;
  }
  return result;
}

/** Export the next selected race weekday; local date arithmetic preserves the clock across DST. */
export function createRaceWeekCalendar(plan: RaceWeekPlan, options: { now: Date }): string {
  const now = options.now;
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new RangeError('A valid calendar reference date is required.');
  const targetDay = plan.raceDay === 'sun' ? 0 : 6;
  const daysAhead = (targetDay - now.getDay() + 7) % 7 || 7;
  const race = new Date(now);
  race.setDate(race.getDate() + daysAhead);
  const [hour, minute] = plan.gunTime.split(':').map(Number);
  race.setHours(hour, minute, 0, 0);
  const beforeRace = (days: number, hour: number, minute: number) => {
    const result = new Date(race);
    result.setDate(result.getDate() - days);
    result.setHours(hour, minute, 0, 0);
    return result;
  };
  const copy = getLocale(plan.locale).raceWeek;
  const events = [
    { key: 'race', start: race, seconds: plan.goalTimeSeconds, title: `${copy.calendar.race}: ${plan.raceTitle}`, description: `${copy.target}: ${plan.targetPaceDisplay}. ${copy.notes.race}` },
    { key: 'breakfast', start: new Date(race.getTime() - 180 * 60000), seconds: 45 * 60, title: copy.calendar.breakfast, description: copy.timelineNotes[0] },
    { key: 'shakeout', start: beforeRace(1, 16, 0), seconds: 30 * 60, title: copy.calendar.shakeout, description: copy.notes.activation },
    { key: 'tuneup', start: beforeRace(4, 7, 0), seconds: 45 * 60, title: copy.calendar.tuneup, description: `${copy.target}: ${plan.targetPaceDisplay}. ${copy.notes.tuneup}` },
  ];
  const timestamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Runner Tools//Race Week//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${timestamp(race)}-${event.key}@runner-tools`,
      `DTSTAMP:${timestamp(now)}`,
      `SUMMARY:${escapeCalendar(event.title)}`,
      `DESCRIPTION:${escapeCalendar(event.description)}`,
      `DTSTART:${timestamp(event.start)}`,
      `DTEND:${timestamp(new Date(event.start.getTime() + event.seconds * 1000))}`,
      'STATUS:CONFIRMED', 'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldCalendarLine).join('\r\n') + '\r\n';
}
