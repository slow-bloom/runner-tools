# Activity & Track File Processing

All interfaces below are exported from `@slow-bloom/runner-tools`. The `files`
directory is a source module, not a separately published package subpath.

Zero-dependency, high-fidelity GPS trackpoint parsing, normalization, transformation, and multi-format serialization for running activities. Compatible with browser environments (pure client-side execution, Web Workers) and Node.js (CLI, server-side data pipelines).

---

## Supported Formats

| Format | Parsing | Serialization | Supported Extensions & Metrics |
|---|---|---|---|
| **FIT activity** | `parseFIT` | `serializeToFIT` | CRC validation, compressed timestamps, little/big endian fields, indoor records, fractional cadence, power, running dynamics and typed native/developer metadata |
| **GPX 1.1** | `parseGPX` | `serializeToGPX` | Coordinates, Elevation, Time, Speed, Garmin TrackPointExtension (`gpxtpx:hr`, `gpxtpx:cad`, `gpxtpx:atemp`) |
| **Garmin TCX 2.0** | `parseTCX` | `serializeToTCX` | Laps, Trackpoints, Distance, Heart Rate (`<HeartRateBpm><Value>`), Cadence, Power (`<Watts>`), Speed |
| **Google Earth KML** | `parseKML` | `serializeToKML` | Coordinates tuples (`lon,lat,ele`), LineStyle color and width customization |
| **GeoJSON (RFC 7946)** | — | `toGeoJSON`, `serializeToGeoJSON` | FeatureCollection `LineString`, property arrays for timestamps, heart rates, cadences, elevations, distances |
| **CSV** | `parseCSV` | `serializeToCSV` | Columns: `Timestamp`, `Latitude`, `Longitude`, `Elevation(m)`, `Distance(m)`, `HeartRate(bpm)`, `Cadence(spm)`, `Speed(m/s)`, `Power(w)` |

Unmarked cadence summaries retain the existing single-leg normalization
heuristic: valid positive samples are averaged first, and means below 120 are
doubled before rounding to steps per minute. Explicit `cadenceUnit` or `sport`
markers bypass that heuristic and preserve canonical fractional cadence.

The high-level converter accepts the five input formats above; GeoJSON is
export-only. Individual formats have different capabilities: KML is a route
format, GPX requires coordinates, and FIT/TCX/CSV can retain GPS-free sensor
records. Arbitrary FIT metadata does not transfer to XML or CSV formats.

## Complete Conversion Pipeline

```ts
import {
  parseActivityFile,
  processActivities,
  serializeActivity,
} from '@slow-bloom/runner-tools';

const activity = parseActivityFile(fitBytes, 'fit', { locale: 'en' });
const processed = processActivities([activity], {
  cropStartMeters: 100,
  cropEndMeters: 200,
  stripGPS: true,
});

// Show these warnings before download: privacy edits discard opaque FIT fields.
console.log(processed.warnings);
console.log(processed.statistics); // Current dashboard values

const file = serializeActivity(processed.activity, 'fit', { stripLaps: true });
// file.data: Uint8Array for FIT, string for all other formats
// file.mimeType: e.g. "application/octet-stream"
// file.extension: "fit"
```

Pass the selected activity alone to edit it; pass several activities to merge
them chronologically. Inputs are not mutated. `forceGpsDistance: true` recomputes
distance from coordinates before cropping or GPS redaction, and rejects tracks
without consecutive GPS samples.

Unedited single activities retain recorded distance and timer totals. Merges
combine all selected summaries rather than using the first upload. Crops
recompute distance, duration and sensor summaries from the retained points;
unrecoverable totals such as original calories or cycle counts are not carried
over as if they described the cropped run. GPS-only distance recalculation
retains recorded duration and cycle counts. `statistics` supplies preview
metrics, while `activity.summary` preserves the values used for export.

`elevation.calculatedAscent` is point-derived elevation gain; the separate
`elevation.recordedAscent` is present when FIT source metadata supplies a recorded
value and the activity has not been cropped.

### Local Web Worker

Build with `npm run build` and host both browser artifacts on the same origin.
The worker is a standalone classic script with no external imports.

```html
<script src="/js/runner-tools.global.js"></script>
<script>
  const converter = RunnerTools.createFileConverterClient('/js/runner-tools.worker.js');

  async function convert(file) {
    try {
      const activity = await converter.parse(await file.arrayBuffer(), 'fit');
      const result = await converter.process([activity], { stripGPS: true });
      const output = await converter.serialize(result.activity, 'tcx');
      return new Blob([output.data], { type: output.mimeType });
    } catch (error) {
      // Present error.code using getLocale(locale).files.converter.errors;
      // log error.message for technical details.
      console.error(error);
      throw error;
    }
  }

  // Call converter.dispose() when the page or tool is permanently closed.
</script>
```

The client correlates overlapping requests and rejects worker startup, cloning
and processing errors. A view that submits multiple edits should also track a
revision number and display only the latest result. The website adapters do this
and disable downloads while edits are pending. There is no silent main-thread
fallback when workers are unavailable.

### FIT Metadata, Units and Privacy

`parseFIT` accepts an `ArrayBuffer` or `Uint8Array` and throws on malformed,
truncated or checksum-invalid files. Chained/concatenated FIT containers are not
supported; upload each activity file separately. Standard measurements use meters, meters
per second, watts, Celsius, millimeters for step length/vertical oscillation, and
milliseconds for ground contact time. Running cadence is steps per minute;
cycling cadence is revolutions per minute. Missing data remains missing.
FIT points carry an explicit `cadenceUnit`; retain that marker when editing
records so low and fractional cadence is not mistaken for legacy stride counts.

The high-level text-file importer preserves the websites' legacy cadence
convention: unlabelled running cadence below 120 is treated as stride cycles and
converted to steps per minute once. An explicit CSV `Cadence(spm)` header bypasses
that inference, including low or fractional cadence. FIT units are determined
from the sport profile instead of this heuristic. Text files with ambiguous
cadence conventions cannot convey the same unit certainty as FIT.

`Activity.fit` contains source non-record messages and `Trackpoint.fit` contains
source native/developer fields with their owned raw bytes. Unedited FIT
conversions can retain these fields. This is not a promise that arbitrary
developer data is meaningful after an edit:

- Cropping or GPS redaction removes opaque metadata at both scopes because it
  can retain locations or values outside the retained activity. Standard
  normalized sensor fields remain available. The result reports
  `opaque-fit-data-removed`.
- Merging or GPS-distance recalculation retains per-record fields and developer
  descriptors, remapping developer identifiers across files to avoid collisions.
  Original session/lap/event/device metadata is replaced rather than attached
  to an activity it no longer describes. The result reports
  `fit-summary-metadata-removed`.
- `stripTrackGPS(points)` removes point-level opaque metadata, but cannot
  remove `Activity.fit` on its own. Use `processActivities(..., { stripGPS: true })`
  for complete activity-level redaction.

For a route without recorded timestamps, pass an explicit `startTime: Date` to
FIT export if there is no source session start. It identifies the activity;
missing point timestamps are **not** synthesized. A route is not turned into a
measured workout with an invented pace or duration.

### Error Contract

`parseActivityFile`, `processActivities` and `serializeActivity` throw, rather
than returning a successful empty conversion. `FileConversionError.code` is one
of `unsupported-format`, `invalid-file`, `no-trackpoints`, `invalid-options`,
`empty-result`, `coordinates-required` or `timestamps-required`. The lower-level
FIT codec throws `FITError` with `invalid-file` or `timestamps-required`;
the converter retains the technical message and localization code across the worker seam.
English and Chinese strings are available in `getLocale(locale).files.converter`.
Coordinate-only export formats are rejected after full GPS redaction; FIT, TCX
and CSV remain available.

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
