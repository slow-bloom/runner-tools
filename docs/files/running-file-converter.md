# Activity & Track File Processing (`@slow-bloom/runner-tools/files`)

Zero-dependency, high-fidelity GPS trackpoint parsing, normalization, transformation, and multi-format serialization for running activities. Compatible with browser environments (pure client-side execution, Web Workers) and Node.js (CLI, server-side data pipelines).

---

## Supported Formats

| Format | Parsing | Serialization | Supported Extensions & Metrics |
|---|---|---|---|
| **GPX 1.1** | `parseGPX` | `serializeToGPX` | Coordinates, Elevation, Time, Speed, Garmin TrackPointExtension (`gpxtpx:hr`, `gpxtpx:cad`, `gpxtpx:atemp`) |
| **Garmin TCX 2.0** | `parseTCX` | `serializeToTCX` | Laps, Trackpoints, Distance, Heart Rate (`<HeartRateBpm><Value>`), Cadence, Power (`<Watts>`), Speed |
| **Google Earth KML** | `parseKML` | `serializeToKML` | Coordinates tuples (`lon,lat,ele`), LineStyle color and width customization |
| **GeoJSON (RFC 7946)** | — | `toGeoJSON`, `serializeToGeoJSON` | FeatureCollection `LineString`, property arrays for timestamps, heart rates, cadences, elevations, distances |
| **CSV** | `parseCSV` | `serializeToCSV` | Columns: `Timestamp`, `Latitude`, `Longitude`, `Elevation(m)`, `Distance(m)`, `HeartRate(bpm)`, `Cadence(spm)`, `Speed(m/s)`, `Power(w)` |

Cadence summaries retain the existing single-leg normalization heuristic: valid positive samples are averaged first, and means below 120 are doubled before rounding to steps per minute. Individual samples are not doubled before averaging.

---

## Quickstart

### 1. Parse GPX or TCX files

```ts
import { parseGPX, parseTCX } from '@slow-bloom/runner-tools';

const gpxXml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ApexRun">
  <trk>
    <name>Morning 10K</name>
    <trkseg>
      <trkpt lat="39.908700" lon="116.397500">
        <ele>45.20</ele>
        <time>2026-03-01T06:30:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

const activity = parseGPX(gpxXml);
console.log(activity.name); // "Morning 10K"
console.log(activity.points.length); // 1
console.log(activity.summary.distance); // 0 (meters)
```

### 2. Crop, Smooth, and Strip Coordinates

```ts
import {
  cropTrack,
  stripTrackGPS,
  calculateActivitySummary,
} from '@slow-bloom/runner-tools';

// Trim first 100 meters and last 200 meters
const trimmedPoints = cropTrack(activity.points, {
  cropStartMeters: 100,
  cropEndMeters: 200,
});

// Strip GPS coordinates for privacy before public sharing
const anonymizedPoints = stripTrackGPS(trimmedPoints);

// Recompute summary metrics
const updatedSummary = calculateActivitySummary(anonymizedPoints);
console.log(updatedSummary.distance, updatedSummary.duration);
```

### 3. Convert and Export to Multiple Formats

```ts
import {
  serializeToGPX,
  serializeToTCX,
  serializeToGeoJSON,
  serializeToCSV,
} from '@slow-bloom/runner-tools';

// Export as GPX with Garmin heart rate and cadence extensions
const newGpx = serializeToGPX(activity, { name: 'Morning 10K' });

// Export as TCX
const newTcx = serializeToTCX(activity, { sport: 'Running' });

// Export as RFC 7946 GeoJSON string for web maps (Leaflet / Mapbox)
const geojsonString = serializeToGeoJSON(activity);

// Export as CSV
const csvString = serializeToCSV(activity);
```

### 4. Merge Split Activities

```ts
import { mergeActivities } from '@slow-bloom/runner-tools';

const merged = mergeActivities([part1Activity, part2Activity], {
  name: 'Sunday Long Run',
  sortChronologically: true,
});
console.log(merged.summary.distance); // Seamless continuous cumulative distance
```

When chronological sorting is enabled, each activity's points are ordered before its distance counter is normalized. Source distances are accumulated independently: nonzero initial counters are preserved, and GPS gaps between activities do not add exercise distance. Sorting overlapping recordings preserves each source's contribution; it does not deduplicate recordings. Input activities and their points are not modified.

### 5. Localization & Custom Titles

All parsers, exporters, and merge utilities accept an optional `locale` parameter (`string` tag or custom dictionary override). Generated fallback titles (e.g. `'Activity'`, `'Empty Activity'`, `' (Merged)'`) dynamically resolve via your configured locale:

```ts
import { parseGPX, mergeActivities } from '@slow-bloom/runner-tools';

// Parse with Chinese localization: defaults to "运动记录" if <name> is missing
const activityZh = parseGPX(gpxXmlWithoutName, { locale: 'zh' });
console.log(activityZh.name); // "运动记录"

// Merge with Chinese suffix
const mergedZh = mergeActivities([part1, part2], { locale: 'zh' });
console.log(mergedZh.name); // "晨跑 (合并)"
```


---

## Core Types

```ts
export interface Trackpoint {
  lat: number | null;
  lon: number | null;
  ele: number | null;
  time: Date | null;
  hr: number | null;
  cad: number | null;
  distance: number | null; // meters
  speed?: number | null; // m/s
  power?: number | null; // watts
  temp?: number | null; // °C
}

export interface ActivitySummary {
  distance: number;
  duration: number; // moving time (sec)
  totalElapsedTime: number; // clock time (sec)
  avgPaceSecs: number; // sec/km
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  avgCadence: number | null;
  maxCadence: number | null;
  totalAscent: number | null;
  totalDescent: number | null;
  avgPower: number | null;
  maxPower: number | null;
  sport: string;
  subSport?: string | null;
}

export interface Activity {
  name: string;
  points: Trackpoint[];
  summary: ActivitySummary;
}
```
