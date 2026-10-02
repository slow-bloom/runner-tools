# Track Comparison and GPS Difference Analysis

`analyzeTrack(activity)` and `compareTracks(trackA, trackB)` use the same parsed
`Activity` as the file converter. Both are exported from
`@slow-bloom/runner-tools`; the browser client exposes asynchronous `analyze`
and `compare` methods through the locally hosted file worker.

```ts
import { parseActivityFile, analyzeTrack, compareTracks } from '@slow-bloom/runner-tools';

const first = analyzeTrack(parseActivityFile(firstBytes, 'fit'));
const second = analyzeTrack(parseActivityFile(secondBytes, 'gpx'));
const comparison = compareTracks(first, second, { alignment: 'auto' });

console.log(comparison.alignment, comparison.maxSpatialGap);
console.log(first.splits, first.possibleStationaryDriftMeters);
```

## What the numbers mean

- Raw GPS distance is the sum of great-circle distances using the existing
  `EARTH_RADIUS_METERS` (6,371,000 m) and Haversine implementation.
- `recordedDistance` and `recordedDuration` preserve source totals separately
  from derived summaries. A point's `recordedDistance: null` means there is no
  independently measured device-distance field. GPX-derived distance must not
  be presented as independent confirmation of its own geometry.
- `distanceBasis` distinguishes recorded point distances, a proportional
  allocation of a recorded summary, and GPS-only data. Summary allocation is
  an estimate, not a local drift measurement. Missing measurements remain null.
- Splits interpolate at actual kilometer milestones instead of rounding up to
  the next sample. Elevation gain uses the existing smoothed elevation function.
- Default moving-time estimation excludes gaps over 15 seconds and speeds below
  0.22 m/s; a recorded timer total is preferred when available.

## Alignment

Automatic alignment uses the intersection of the timestamp ranges. The default
1,001 comparison samples share a common clock, so differences in device sampling
frequency do not cause point-index mismatches. Gaps exceeding 60 seconds are not
interpolated, nor are discontinuities caused by missing coordinates. Interpolated
Date values have millisecond precision.

When timestamps do not overlap, automatic mode explicitly reports
`alignment: 'progress'` and `alignmentReason: 'no-time-overlap'`. Progress mode
compares the same relative fraction of each GPS route, not the same clock time.
This is useful for repeated runs, but its separation can reflect pace or route
differences rather than GPS errors. Requesting `alignment: 'time'` without
overlap throws a localized `FileConversionError`.

`sampleTrackDistance` and `sampleTrackProgress` provide binary-search
interpolation for map scrubbers. Longitude interpolation follows the short arc
across the antimeridian. Inputs are not mutated.

## Diagnostics are indicators, not ground truth

The single-track heatmap compares measured distance increments over up to 15
adjacent GPS segments. It is unavailable when there is only a summary or GPS
geometry. The thresholds are preserved website visualization heuristics:
ratios below 0.98 or above 1.018 are highlighted, and 1.008 through 1.018 uses an
intermediate color. They do not identify a watch's firmware algorithm.

GPS movement while recorded speed is below 0.22 m/s is a *possible* stationary
drift candidate. GPS speed above 12 m/s is a configurable running-speed spike
indicator, not proof of an error or a suitable cycling threshold.

Neither recorded distance nor raw GPS is assumed to be true distance. A pair
of agreeing files does not establish positional accuracy. A pause, elevation
gain, or a distance difference alone cannot prove sensor fusion or ghost mileage.

## Browser integration

```ts
const client = createFileConverterClient('/js/runner-tools.worker.js');
const activity = await client.parse(await file.arrayBuffer(), 'fit');
const track = await client.analyze(activity);
const result = await client.compare(track, anotherTrack, { alignment: 'time' });
client.dispose();
```

The two websites retain their localized maps, layer selectors, tables, markers
and scrubbers. The comparator map samples both tracks with `sampleTrackDistance`
at the same cumulative raw GPS distance, from zero to the shorter track's total
(or the full total with one track). Cursor positions are interpolated; the
Raw points layer shows the recorded GPS samples. Line is the default renderer.
Raw points mode draws all samples within the current viewport, up to a combined
2,000-point budget across both tracks. Above that budget it displays only the
route outline and a zoom-in hint, rather than silently downsampling. The visible
points refresh on map movement completion; style switches preserve the viewport
and distance cursor.

The map's current separation
uses these distance-aligned positions, independently of the `compareTracks`
time/progress alignment used by the metrics, split table and diagnostics.
Upload and comparison revisions prevent older worker responses
from replacing newer selections. Parsing and analysis do not upload files;
Leaflet's basemap tiles are still requested from external map providers.
