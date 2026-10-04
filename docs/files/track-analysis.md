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
- The overall distance prefers the file's recorded summary, while the API's
  point-based `splits` use the rebased per-point counter. These source fields can
  disagree. The lap-focused analyzer does not display point-based splits or
  rescale counters to fit the summary.
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

## Recorded lap comparisons

`Activity.recordedLaps` preserves source lap distances and boundaries.
FIT uses native lap start/end timestamps. TCX preserves the lap start and final
track sample with `endTimeBasis: 'last-sample'`; timer duration is not treated as
elapsed wall-clock time, and a last sample is not claimed to be a confirmed finish.

`analyzeTrack(activity).laps` compares each source lap against the GPS sequence
inside the same time window. Each result includes `recordedMeters`, `gpsMeters`,
`deltaMeters`, `cumulativeDeltaMeters`, `coveredGpsMeters`, `coveredSeconds`,
`durationSeconds`, `status`, continuous `paths`, and optional `startPoint`/`endPoint`.
Complete GPS intervals interpolate their boundary samples. Same-second GPS
samples are retained in source order, with boundary ties assigned to the next lap.
Missing coordinates/timestamps and gaps over 60 seconds are not bridged.

Partial coverage exposes only `coveredGpsMeters`; the full GPS comparison and
delta remain null. This includes a lap that ends one second after the final GPS
sample. Unknown TCX end boundaries, invalid times, unavailable distances and
overlapping/out-of-order laps are explicit statuses. Cumulative differences stay
null after the first unavailable comparison. Source lap order and distances are
not rescaled to fit the workout total. Cropping, privacy edits, GPS-distance
recalculation and merges discard source lap associations rather than retain stale ones.
Exporters keep their existing format-specific lap behavior.

## Point-distance counter API

A single activity contains one coordinate stream, not separate watch-corrected
and raw-satellite tracks. `createRecordedDistanceSampler(track)` locates where
the stored point counter reached a selected distance on that same route. This
counter may originate from an exporter, not the watch's original measurement.
This API remains available, but is not used by the lap-focused analyzer:

```ts
import { createRecordedDistanceSampler, sampleTrackDistance } from '@slow-bloom/runner-tools';

const watch = createRecordedDistanceSampler(first);
const watchPosition = watch.at(1000);
const gpsPosition = sampleTrackDistance(first, 1000);
console.log(watch.startDistance, watch.endDistance, watchPosition, gpsPosition);
```

Build the sampler once per analyzed track. It indexes measured, GPS-located
recorded distances and uses binary search for each lookup. Distances are rebased
at the first recorded reading using the analyzer's existing reset normalization.
`startDistance` and `endDistance` describe actual sample coverage, not the header
total; the start can be greater than zero when the first GPS fix is delayed.
Both are null, and `at` returns null, unless at least two mapped recorded samples
exist with `distanceBasis: 'recorded-points'`. Summary-proportional values never
produce a watch cursor.

Invalid or out-of-range distances return null. Exact samples remain available;
repeated counter values select the earliest occurrence. Interpolation does not
cross missing recorded samples, coordinate segments, or known time gaps over
60 seconds. A stationary counter can have a valid zero-width range.

At the same selected distance, the watch and GPS cursors can occupy different
positions. Their separation reflects different distance accumulation, not a
positional GPS error, a second geometry, or proof that either counter is accurate.

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

The single-file analyzer uses recorded lap comparisons only. Clickable lap rows
and accessible cumulative-difference chart columns select the same checkpoint
and highlighted GPS paths, without a separate selector or slider.
Its single map cursor marks the recorded lap end, or an explicitly labeled last
available GPS sample when that boundary is unavailable.

Checkpoint readouts sum recorded lap distances and GPS over exactly the same
laps, excluding time between laps and route portions outside them. They are not
claimed to be whole-workout totals. After the first unavailable cumulative
comparison, totals stay unavailable; chart dashes are not zero-valued bars.
Columns are discrete observations with no interpolated within-lap watch values.
The scrollable lap list and checkpoint details sit to the left of the map on
wide screens, with the chart below; narrow screens stack them. Selected cumulative
recorded distance, GPS distance and their difference appear above the list.
Its four columns are lap number, GPS, lap difference and cumulative difference.
Rows use numbers only, with meter units stated above the header and an asterisk
for partial GPS coverage. Full recorded values and statuses remain in row
tooltips and accessible labels.
Selecting a chart checkpoint reveals the matching list row. A map resize observer
refreshes Leaflet's dimensions without refitting the route.
Chart and lap selection still work if the basemap cannot load.
There is no advanced point-counter view, dual-counter scrubber or heatmap.
Line remains the default with bounded Raw points inspection; style changes
preserve the checkpoint selection and viewport.

The comparator map's current separation
uses these distance-aligned positions, independently of the `compareTracks`
time/progress alignment used by the metrics, split table and diagnostics.
Upload and comparison revisions prevent older worker responses
from replacing newer selections. Parsing and analysis do not upload files;
Leaflet's basemap tiles are still requested from external map providers.
