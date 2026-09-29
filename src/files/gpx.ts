import type { Activity, Trackpoint, GPXExportOptions } from './types.js';
import {
  extractAllTags,
  extractAttribute,
  getXmlChildTagValue,
  escapeXml,
} from './xml-utils.js';
import { normalizeTrackDistances, calculateActivitySummary } from './geo.js';

/**
 * Parse standard GPX 1.1 or 1.0 XML string into an Activity object.
 * Extracts GPS coordinates, altitude, timestamp, heart rate, cadence, and temperature.
 *
 * @param xmlText GPX XML string content
 * @returns Fully populated Activity data structure
 */
export function parseGPX(xmlText: string): Activity {
  if (!xmlText || typeof xmlText !== 'string') {
    return {
      name: 'Activity',
      points: [],
      summary: calculateActivitySummary([]),
    };
  }

  // Extract activity name
  const rawName = getXmlChildTagValue(xmlText, 'name');
  const name = rawName ? rawName.trim() : 'Activity';

  const trkptMatches = extractAllTags(xmlText, 'trkpt');
  const rawPoints: Trackpoint[] = [];

  for (const match of trkptMatches) {
    const latStr = extractAttribute(match.openTag, 'lat');
    const lonStr = extractAttribute(match.openTag, 'lon');

    const lat = latStr !== null ? parseFloat(latStr) : null;
    const lon = lonStr !== null ? parseFloat(lonStr) : null;

    // Reject non-numeric coordinates
    if (lat === null || lon === null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      continue;
    }

    const eleVal = getXmlChildTagValue(match.innerXml, 'ele');
    const ele = eleVal !== null && Number.isFinite(parseFloat(eleVal)) ? parseFloat(eleVal) : null;

    const timeVal = getXmlChildTagValue(match.innerXml, 'time');
    let time: Date | null = null;
    if (timeVal) {
      const parsedDate = new Date(timeVal);
      if (!isNaN(parsedDate.getTime())) {
        time = parsedDate;
      }
    }

    // Garmin TrackPointExtension or standard tag for Heart Rate
    const hrVal =
      getXmlChildTagValue(match.innerXml, 'hr') ||
      getXmlChildTagValue(match.innerXml, 'heartrate');
    const hr = hrVal !== null && Number.isFinite(parseInt(hrVal, 10)) ? parseInt(hrVal, 10) : null;

    // Cadence
    const cadVal =
      getXmlChildTagValue(match.innerXml, 'cad') ||
      getXmlChildTagValue(match.innerXml, 'cadence');
    const cad = cadVal !== null && Number.isFinite(parseInt(cadVal, 10)) ? parseInt(cadVal, 10) : null;

    // Speed
    const spdVal = getXmlChildTagValue(match.innerXml, 'speed');
    const speed = spdVal !== null && Number.isFinite(parseFloat(spdVal)) ? parseFloat(spdVal) : null;

    // Temperature
    const tempVal =
      getXmlChildTagValue(match.innerXml, 'atemp') ||
      getXmlChildTagValue(match.innerXml, 'temp');
    const temp = tempVal !== null && Number.isFinite(parseFloat(tempVal)) ? parseFloat(tempVal) : null;

    rawPoints.push({
      lat,
      lon,
      ele,
      time,
      hr,
      cad,
      distance: null,
      speed,
      temp,
    });
  }

  // Calculate cumulative distances
  const normalizedPoints = normalizeTrackDistances(rawPoints);
  const summary = calculateActivitySummary(normalizedPoints);

  return {
    name,
    points: normalizedPoints,
    summary,
  };
}

/**
 * Serialize an Activity or array of Trackpoints into standard GPX 1.1 XML format.
 * Includes Garmin TrackPointExtension for high-fidelity HR and Cadence preservation.
 *
 * @param activityOrPoints Activity object or array of Trackpoint objects
 * @param options GPX serialization options
 * @returns Standard GPX 1.1 XML document string
 */
export function serializeToGPX(
  activityOrPoints: Activity | Trackpoint[],
  options?: GPXExportOptions
): string {
  const points = Array.isArray(activityOrPoints) ? activityOrPoints : activityOrPoints.points;
  const activityName =
    options?.name ||
    (!Array.isArray(activityOrPoints) ? activityOrPoints.name : 'Activity') ||
    'Activity';
  const creator = options?.creator || 'ApexRun';
  const includeExtensions = options?.includeExtensions ?? true;

  const startTimeIso =
    points[0]?.time instanceof Date
      ? points[0].time.toISOString()
      : new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="${escapeXml(creator)}" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd http://www.garmin.com/xmlschemas/TrackPointExtension/v1 http://www.garmin.com/xmlschemas/TrackPointExtensionv1.xsd">
  <metadata>
    <name>${escapeXml(activityName)}</name>
    <time>${startTimeIso}</time>
  </metadata>
  <trk>
    <name>${escapeXml(activityName)}</name>
    <type>running</type>
    <trkseg>`;

  for (const pt of points) {
    if (
      pt.lat === null ||
      pt.lon === null ||
      !Number.isFinite(pt.lat) ||
      !Number.isFinite(pt.lon)
    ) {
      continue;
    }

    const latStr = pt.lat.toFixed(6);
    const lonStr = pt.lon.toFixed(6);

    xml += `
      <trkpt lat="${latStr}" lon="${lonStr}">`;

    if (pt.ele !== null && Number.isFinite(pt.ele)) {
      xml += `
        <ele>${pt.ele.toFixed(2)}</ele>`;
    }

    if (pt.time instanceof Date && !isNaN(pt.time.getTime())) {
      xml += `
        <time>${pt.time.toISOString()}</time>`;
    }

    if (pt.speed !== undefined && pt.speed !== null && Number.isFinite(pt.speed)) {
      xml += `
        <speed>${pt.speed.toFixed(2)}</speed>`;
    }

    if (includeExtensions && (pt.hr !== null || pt.cad !== null || (pt.temp !== undefined && pt.temp !== null))) {
      xml += `
        <extensions>
          <gpxtpx:TrackPointExtension>`;
      if (pt.hr !== null && Number.isFinite(pt.hr)) {
        xml += `
            <gpxtpx:hr>${Math.round(pt.hr)}</gpxtpx:hr>`;
      }
      if (pt.cad !== null && Number.isFinite(pt.cad)) {
        xml += `
            <gpxtpx:cad>${Math.round(pt.cad)}</gpxtpx:cad>`;
      }
      if (pt.temp !== undefined && pt.temp !== null && Number.isFinite(pt.temp)) {
        xml += `
            <gpxtpx:atemp>${Math.round(pt.temp)}</gpxtpx:atemp>`;
      }
      xml += `
          </gpxtpx:TrackPointExtension>
        </extensions>`;
    }

    xml += `
      </trkpt>`;
  }

  xml += `
    </trkseg>
  </trk>
</gpx>`;

  return xml;
}
