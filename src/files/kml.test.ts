import { describe, it, expect } from 'vitest';
import { parseKML, serializeToKML } from './kml.js';

describe('KML Parser & Serializer', () => {
  const SAMPLE_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Park Loop</name>
    <Placemark>
      <name>Park Loop Route</name>
      <LineString>
        <coordinates>
          121.473700,31.230400,10.50 121.474500,31.231000,11.20
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;

  it('parses KML coordinate tuples accurately', () => {
    const activity = parseKML(SAMPLE_KML);
    expect(activity.name).toBe('Park Loop');
    expect(activity.points).toHaveLength(2);
    expect(activity.points[0].lon).toBeCloseTo(121.4737, 4);
    expect(activity.points[0].lat).toBeCloseTo(31.2304, 4);
    expect(activity.points[0].ele).toBe(10.5);
    expect(activity.points[1].ele).toBe(11.2);
    expect(activity.summary.distance).toBeGreaterThan(50);
  });

  it('serializes activity points into valid KML XML', () => {
    const act = parseKML(SAMPLE_KML);
    const kml = serializeToKML(act, { name: 'Park Loop', lineColor: 'ff0000ff' });

    expect(kml).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">');
    expect(kml).toContain('<name>Park Loop</name>');
    expect(kml).toContain('121.473700,31.230400,10.50');
    expect(kml).toContain('<color>ff0000ff</color>');

    const parsedBack = parseKML(kml);
    expect(parsedBack.points).toHaveLength(2);
    expect(parsedBack.points[0].lat).toBeCloseTo(31.2304, 4);
  });
});
