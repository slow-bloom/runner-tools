import type { Activity, Trackpoint, KMLExportOptions } from './types.js';
import { extractAllTags, getXmlChildTagValue, escapeXml } from './xml-utils.js';
import { normalizeTrackDistances, calculateActivitySummary } from './geo.js';

/**
 * Parse Google Earth KML format into an Activity object.
 * Parses <coordinates> blocks with lon,lat,elevation tuples.
 *
 * @param xmlText KML XML string
 * @returns Activity object
 */
export function parseKML(xmlText: string): Activity {
  if (!xmlText || typeof xmlText !== 'string') {
    return {
      name: 'Activity',
      points: [],
      summary: calculateActivitySummary([]),
    };
  }

  const nameVal = getXmlChildTagValue(xmlText, 'name');
  const name = nameVal ? nameVal.trim() : 'Activity';

  const coordMatches = extractAllTags(xmlText, 'coordinates');
  const rawPoints: Trackpoint[] = [];

  for (const match of coordMatches) {
    const rawCoords = match.innerXml.trim();
    if (!rawCoords) continue;

    const tuples = rawCoords.split(/\s+/);
    for (const tuple of tuples) {
      const parts = tuple.split(',');
      if (parts.length >= 2) {
        const lon = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        const ele = parts.length >= 3 && parts[2] ? parseFloat(parts[2]) : null;

        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          rawPoints.push({
            lat,
            lon,
            ele: ele !== null && Number.isFinite(ele) ? ele : null,
            time: null,
            hr: null,
            cad: null,
            distance: null,
          });
        }
      }
    }
  }

  const normalizedPoints = normalizeTrackDistances(rawPoints);
  const summary = calculateActivitySummary(normalizedPoints);

  return {
    name,
    points: normalizedPoints,
    summary,
  };
}

/**
 * Serialize an Activity or array of Trackpoints into Google Earth KML format.
 *
 * @param activityOrPoints Activity or array of Trackpoints
 * @param options KML serialization options
 * @returns Standard KML 2.2 XML string
 */
export function serializeToKML(
  activityOrPoints: Activity | Trackpoint[],
  options?: KMLExportOptions
): string {
  const points = Array.isArray(activityOrPoints) ? activityOrPoints : activityOrPoints.points;
  const name =
    options?.name ||
    (!Array.isArray(activityOrPoints) ? activityOrPoints.name : 'Activity') ||
    'ApexRun Route';
  const lineColor = options?.lineColor || 'ff045de8';
  const lineWidth = options?.lineWidth ?? 4;

  let coordsStr = '';
  for (const pt of points) {
    if (
      pt.lat !== null &&
      pt.lon !== null &&
      Number.isFinite(pt.lat) &&
      Number.isFinite(pt.lon)
    ) {
      const ele = pt.ele !== null && Number.isFinite(pt.ele) ? pt.ele.toFixed(2) : '0';
      coordsStr += `${pt.lon.toFixed(6)},${pt.lat.toFixed(6)},${ele} `;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(name)}</name>
    <Style id="routeStyle">
      <LineStyle>
        <color>${escapeXml(lineColor)}</color>
        <width>${lineWidth}</width>
      </LineStyle>
    </Style>
    <Placemark>
      <name>${escapeXml(name)}</name>
      <styleUrl>#routeStyle</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <altitudeMode>clampToGround</altitudeMode>
        <coordinates>
          ${coordsStr.trim()}
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;
}
