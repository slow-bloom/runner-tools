import type { Activity, Trackpoint } from './types.js';
import { normalizeTrackDistances, calculateActivitySummary } from './geo.js';

export const CSV_HEADER =
  'Timestamp,Latitude,Longitude,Elevation(m),Distance(m),HeartRate(bpm),Cadence(spm),Speed(m/s),Power(w)';

/**
 * Serialize an Activity or array of Trackpoints into standard CSV format.
 *
 * @param activityOrPoints Activity object or array of Trackpoint objects
 * @returns Comma-separated values string with standard header
 */
export function serializeToCSV(activityOrPoints: Activity | Trackpoint[]): string {
  const points = Array.isArray(activityOrPoints) ? activityOrPoints : activityOrPoints.points;

  let csv = `${CSV_HEADER}\n`;

  for (const pt of points) {
    const timeStr =
      pt.time instanceof Date && !isNaN(pt.time.getTime())
        ? pt.time.toISOString()
        : '';
    const latStr = pt.lat !== null && Number.isFinite(pt.lat) ? pt.lat.toFixed(6) : '';
    const lonStr = pt.lon !== null && Number.isFinite(pt.lon) ? pt.lon.toFixed(6) : '';
    const eleStr = pt.ele !== null && Number.isFinite(pt.ele) ? pt.ele.toFixed(2) : '';
    const distStr = pt.distance !== null && Number.isFinite(pt.distance) ? pt.distance.toFixed(1) : '';
    const hrStr = pt.hr !== null && Number.isFinite(pt.hr) ? String(Math.round(pt.hr)) : '';
    const cadStr = pt.cad !== null && Number.isFinite(pt.cad) ? String(Math.round(pt.cad)) : '';
    const spdStr = pt.speed !== undefined && pt.speed !== null && Number.isFinite(pt.speed) ? pt.speed.toFixed(2) : '';
    const pwrStr = pt.power !== undefined && pt.power !== null && Number.isFinite(pt.power) ? String(Math.round(pt.power)) : '';

    csv += `${timeStr},${latStr},${lonStr},${eleStr},${distStr},${hrStr},${cadStr},${spdStr},${pwrStr}\n`;
  }

  return csv;
}

/**
 * Parse standard runner CSV text into an Activity object.
 *
 * @param csvText CSV string with header
 * @returns Activity object
 */
export function parseCSV(csvText: string): Activity {
  if (!csvText || typeof csvText !== 'string') {
    return {
      name: 'Activity',
      points: [],
      summary: calculateActivitySummary([]),
    };
  }

  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length <= 1) {
    return {
      name: 'Activity',
      points: [],
      summary: calculateActivitySummary([]),
    };
  }

  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(',').map((h) => h.trim());

  const idxTime = headers.findIndex((h) => h.includes('time'));
  const idxLat = headers.findIndex((h) => h.includes('lat'));
  const idxLon = headers.findIndex((h) => h.includes('lon'));
  const idxEle = headers.findIndex((h) => h.includes('ele') || h.includes('alt'));
  const idxDist = headers.findIndex((h) => h.includes('dist'));
  const idxHr = headers.findIndex((h) => h.includes('heart') || h.includes('hr'));
  const idxCad = headers.findIndex((h) => h.includes('cad') || h.includes('rpm') || h.includes('spm'));
  const idxSpd = headers.findIndex((h) => h.includes('speed') || h.includes('spd'));
  const idxPwr = headers.findIndex((h) => h.includes('power') || h.includes('watt'));

  const rawPoints: Trackpoint[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(',');

    let time: Date | null = null;
    if (idxTime >= 0 && cols[idxTime]) {
      const d = new Date(cols[idxTime].trim());
      if (!isNaN(d.getTime())) time = d;
    }

    const lat = idxLat >= 0 && cols[idxLat] ? parseFloat(cols[idxLat]) : null;
    const lon = idxLon >= 0 && cols[idxLon] ? parseFloat(cols[idxLon]) : null;
    const ele = idxEle >= 0 && cols[idxEle] ? parseFloat(cols[idxEle]) : null;
    const dist = idxDist >= 0 && cols[idxDist] ? parseFloat(cols[idxDist]) : null;
    const hr = idxHr >= 0 && cols[idxHr] ? parseInt(cols[idxHr], 10) : null;
    const cad = idxCad >= 0 && cols[idxCad] ? parseInt(cols[idxCad], 10) : null;
    const spd = idxSpd >= 0 && cols[idxSpd] ? parseFloat(cols[idxSpd]) : null;
    const pwr = idxPwr >= 0 && cols[idxPwr] ? parseFloat(cols[idxPwr]) : null;

    rawPoints.push({
      time,
      lat: lat !== null && Number.isFinite(lat) ? lat : null,
      lon: lon !== null && Number.isFinite(lon) ? lon : null,
      ele: ele !== null && Number.isFinite(ele) ? ele : null,
      distance: dist !== null && Number.isFinite(dist) ? dist : null,
      hr: hr !== null && Number.isFinite(hr) ? hr : null,
      cad: cad !== null && Number.isFinite(cad) ? cad : null,
      speed: spd !== null && Number.isFinite(spd) ? spd : null,
      power: pwr !== null && Number.isFinite(pwr) ? pwr : null,
    });
  }

  const normalizedPoints = normalizeTrackDistances(rawPoints);
  const summary = calculateActivitySummary(normalizedPoints);

  return {
    name: 'Activity',
    points: normalizedPoints,
    summary,
  };
}
