import type { Activity, Trackpoint, TCXExportOptions, ActivitySummary, ParseTrackOptions } from './types.js';
import {
  extractAllTags,
  getXmlChildTagValue,
  escapeXml,
  safeIsoTimestamp,
} from './xml-utils.js';
import { normalizeTrackDistances, calculateActivitySummary } from './geo.js';
import { getLocale } from '../i18n/index.js';

/**
 * Parse Garmin Training Center XML (TCX 2.0) format into an Activity object.
 * Extracts GPS positions, altitude, heart rate, cadence, distance, and aggregates all lap summaries.
 *
 * @param xmlText TCX XML string
 * @param options Optional parser options such as locale override
 * @returns Fully structured Activity
 */
export function parseTCX(xmlText: string, options?: ParseTrackOptions): Activity {
  const loc = getLocale(options?.locale);
  const defaultName = loc.files.defaultActivityName;

  if (!xmlText || typeof xmlText !== 'string') {
    return {
      name: defaultName,
      points: [],
      summary: calculateActivitySummary([]),
    };
  }

  // Extract Sport
  const sportMatch = xmlText.match(/<Activity\s+[^>]*Sport\s*=\s*(["'])(.*?)\1/i);
  const sport = sportMatch ? sportMatch[2].toLowerCase() : 'running';

  // Aggregate all Laps if present
  const lapMatches = extractAllTags(xmlText, 'Lap');
  let lapSummary: Partial<ActivitySummary> | undefined;

  if (lapMatches.length > 0) {
    let totalDist = 0;
    let totalTime = 0;
    let cadWeightedSum = 0;
    let cadTimeSum = 0;
    let hasLapMetrics = false;

    for (const lap of lapMatches) {
      const lapXml = lap.innerXml;
      // Strip <Track> blocks to ensure we only read direct lap-level summary attributes,
      // preventing trackpoint-level child elements (like <Trackpoint><Cadence>) from corrupting lap averages.
      const lapHeaderXml = lapXml.replace(
        /<(?:[a-zA-Z0-9_-]+:)?Track\b[\s\S]*?<\/(?:[a-zA-Z0-9_-]+:)?Track>/gi,
        ''
      );

      const distVal = getXmlChildTagValue(lapHeaderXml, 'DistanceMeters');
      const timeVal = getXmlChildTagValue(lapHeaderXml, 'TotalTimeSeconds');
      const cadVal = getXmlChildTagValue(lapHeaderXml, 'Cadence');

      const d = distVal && Number.isFinite(parseFloat(distVal)) ? parseFloat(distVal) : 0;
      const t = timeVal && Number.isFinite(parseFloat(timeVal)) ? parseFloat(timeVal) : 0;
      const c = cadVal && Number.isFinite(parseInt(cadVal, 10)) ? parseInt(cadVal, 10) : null;

      if (distVal !== null || timeVal !== null) {
        hasLapMetrics = true;
        totalDist += d;
        totalTime += t;
        if (c !== null && t > 0) {
          cadWeightedSum += c * t;
          cadTimeSum += t;
        } else if (c !== null) {
          cadWeightedSum += c;
          cadTimeSum += 1;
        }
      }
    }

    if (hasLapMetrics) {
      lapSummary = {
        sport,
        distance: totalDist,
        duration: totalTime,
        avgCadence: cadTimeSum > 0 ? Math.round(cadWeightedSum / cadTimeSum) : undefined,
      };
    }
  }

  const trkptMatches = extractAllTags(xmlText, 'Trackpoint');
  const rawPoints: Trackpoint[] = [];

  for (const match of trkptMatches) {
    const inner = match.innerXml;

    const latVal = getXmlChildTagValue(inner, 'LatitudeDegrees');
    const lonVal = getXmlChildTagValue(inner, 'LongitudeDegrees');

    const lat = latVal !== null && Number.isFinite(parseFloat(latVal)) ? parseFloat(latVal) : null;
    const lon = lonVal !== null && Number.isFinite(parseFloat(lonVal)) ? parseFloat(lonVal) : null;

    const eleVal = getXmlChildTagValue(inner, 'AltitudeMeters');
    const ele = eleVal !== null && Number.isFinite(parseFloat(eleVal)) ? parseFloat(eleVal) : null;

    const distVal = getXmlChildTagValue(inner, 'DistanceMeters');
    const distance = distVal !== null && Number.isFinite(parseFloat(distVal)) ? parseFloat(distVal) : null;

    const timeVal = getXmlChildTagValue(inner, 'Time');
    let time: Date | null = null;
    if (timeVal) {
      const parsedDate = new Date(timeVal);
      if (!isNaN(parsedDate.getTime())) {
        time = parsedDate;
      }
    }

    // Heart rate is nested inside <HeartRateBpm><Value>...</Value></HeartRateBpm>
    let hr: number | null = null;
    const hrBlock = getXmlChildTagValue(inner, 'HeartRateBpm');
    if (hrBlock) {
      const val = getXmlChildTagValue(hrBlock, 'Value');
      if (val !== null && Number.isFinite(parseInt(val, 10))) {
        hr = parseInt(val, 10);
      }
    }
    if (hr === null) {
      // Fallback if directly expressed as <hr> or <Value>
      const directVal = getXmlChildTagValue(inner, 'hr') || getXmlChildTagValue(inner, 'Value');
      if (directVal !== null && Number.isFinite(parseInt(directVal, 10))) {
        hr = parseInt(directVal, 10);
      }
    }

    // Cadence
    const cadVal =
      getXmlChildTagValue(inner, 'Cadence') ||
      getXmlChildTagValue(inner, 'RunCadence');
    const cad = cadVal !== null && Number.isFinite(parseInt(cadVal, 10)) ? parseInt(cadVal, 10) : null;

    // Speed or Watts inside Extensions (TPX)
    const speedVal = getXmlChildTagValue(inner, 'Speed');
    const speed = speedVal !== null && Number.isFinite(parseFloat(speedVal)) ? parseFloat(speedVal) : null;

    const wattsVal = getXmlChildTagValue(inner, 'Watts');
    const power = wattsVal !== null && Number.isFinite(parseFloat(wattsVal)) ? parseFloat(wattsVal) : null;

    rawPoints.push({
      lat,
      lon,
      ele,
      time,
      hr,
      cad,
      distance,
      speed,
      power,
    });
  }

  const normalizedPoints = normalizeTrackDistances(rawPoints);
  const summary = calculateActivitySummary(normalizedPoints, lapSummary);

  return {
    name: defaultName,
    points: normalizedPoints,
    summary,
  };
}

/**
 * Serialize an Activity or array of Trackpoints into Garmin Training Center XML (TCX 2.0).
 *
 * @param activityOrPoints Activity object or array of Trackpoint objects
 * @param options TCX serialization options
 * @returns Garmin TCX 2.0 XML string
 */
export function serializeToTCX(
  activityOrPoints: Activity | Trackpoint[],
  options?: TCXExportOptions
): string {
  const points = Array.isArray(activityOrPoints) ? activityOrPoints : activityOrPoints.points;
  const activitySummary = !Array.isArray(activityOrPoints) ? activityOrPoints.summary : calculateActivitySummary(points);
  const sport = options?.sport || 'Running';

  const startTimeIso = safeIsoTimestamp(points[0]?.time);
  const totalTimeSecs = activitySummary.duration || 0;
  const totalDistMeters = activitySummary.distance || 0;
  // Use caller-provided calories if recorded, otherwise emit schema-compliant default 0 (unknown/unmeasured)
  const calories =
    options?.calories !== undefined && Number.isFinite(options.calories)
      ? Math.min(65535, Math.max(0, Math.round(options.calories)))
      : 0;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Activities>
    <Activity Sport="${escapeXml(sport)}">
      <Id>${startTimeIso}</Id>
      <Lap StartTime="${startTimeIso}">
        <TotalTimeSeconds>${totalTimeSecs.toFixed(1)}</TotalTimeSeconds>
        <DistanceMeters>${totalDistMeters.toFixed(1)}</DistanceMeters>
        <Calories>${calories}</Calories>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>`;

  for (const pt of points) {
    const timeIso =
      pt.time instanceof Date && !isNaN(pt.time.getTime())
        ? pt.time.toISOString()
        : startTimeIso;

    xml += `
          <Trackpoint>
            <Time>${timeIso}</Time>`;

    if (
      pt.lat !== null &&
      pt.lon !== null &&
      Number.isFinite(pt.lat) &&
      Number.isFinite(pt.lon)
    ) {
      xml += `
            <Position>
              <LatitudeDegrees>${pt.lat.toFixed(6)}</LatitudeDegrees>
              <LongitudeDegrees>${pt.lon.toFixed(6)}</LongitudeDegrees>
            </Position>`;
    }

    if (pt.ele !== null && Number.isFinite(pt.ele)) {
      xml += `
            <AltitudeMeters>${pt.ele.toFixed(2)}</AltitudeMeters>`;
    }

    if (pt.distance !== null && Number.isFinite(pt.distance)) {
      xml += `
            <DistanceMeters>${pt.distance.toFixed(1)}</DistanceMeters>`;
    }

    if (pt.hr !== null && Number.isFinite(pt.hr)) {
      xml += `
            <HeartRateBpm>
              <Value>${Math.round(pt.hr)}</Value>
            </HeartRateBpm>`;
    }

    if (pt.cad !== null && Number.isFinite(pt.cad)) {
      xml += `
            <Cadence>${Math.round(pt.cad)}</Cadence>`;
    }

    if (
      (pt.speed !== undefined && pt.speed !== null && Number.isFinite(pt.speed)) ||
      (pt.power !== undefined && pt.power !== null && Number.isFinite(pt.power))
    ) {
      xml += `
            <Extensions>
              <TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2">`;
      if (pt.speed !== undefined && pt.speed !== null && Number.isFinite(pt.speed)) {
        xml += `
                <Speed>${pt.speed.toFixed(2)}</Speed>`;
      }
      if (pt.power !== undefined && pt.power !== null && Number.isFinite(pt.power)) {
        xml += `
                <Watts>${Math.round(pt.power)}</Watts>`;
      }
      xml += `
              </TPX>
            </Extensions>`;
    }

    xml += `
          </Trackpoint>`;
  }

  xml += `
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

  return xml;
}
