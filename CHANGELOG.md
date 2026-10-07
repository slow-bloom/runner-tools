# Changelog

All notable changes to `@slow-bloom/runner-tools` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Zero-runtime-dependency FIT activity decoding and encoding, including CRC validation, compressed timestamps, endian-aware fields, running dynamics and typed native/developer metadata.
- `parseActivityFile`, `processActivities` and `serializeActivity` as a common file-converter interface.
- A standalone `runner-tools.worker.js` and `createFileConverterClient` for local asynchronous parsing, editing and downloads, with explicit worker failures and request correlation.
- English and Chinese converter status, validation and metadata-loss messages.
- Regression coverage for edited summaries, GPS-free exports, developer-index collisions, missing timestamps and actual worker message/binary transfers.
- Track analysis with recorded-distance provenance, exact split interpolation, timestamp/progress alignment, sampling diagnostics and worker operations.
- `createRecordedDistanceSampler` for indexed point-counter positions on one GPS route, with recorded coverage and explicit missing-data handling.
- Source FIT/TCX lap provenance and recorded-lap GPS comparisons, with explicit partial coverage, continuous map paths, and no extrapolated lap finishes.
- Cadence metronome modules for target/tap calculation, cancellable Web Audio scheduling, cooperative WAV serialization and optional caller-supplied MP3 encoding.
- Strength workout validation, localized presets, deterministic import/export, timeline statistics, monotonic elapsed-time state and optional audio cues.
- Localized race-week templates and deterministic RFC 5545 calendar export with daylight-saving-aware local date arithmetic.

### Changed
- Strength presets include left/right clamshells and default the final exercise's rest to zero, without changing saved or imported rest values. Failed audio cues disable playback until an explicit retry.
- Privacy edits remove opaque FIT metadata from both activities and points, in addition to visible coordinates, with explicit warnings. Merges and GPS recalculation preserve record-level developer data while rebuilding source summaries.
- Edited file summaries retain canonical FIT cadence and recompute running dynamics from retained samples.
- Website synchronization now includes the worker and source maps alongside the existing browser bundle and license.
- Comparator, drift analyzer, cadence metronome, strength timer and race-week planner websites now consume the shared modules instead of duplicating their algorithms.
- The GPS drift analyzer focuses on recorded laps, with a linked lap-end map cursor and accessible cumulative-difference chart. Readouts compare recorded and GPS totals over the same laps without estimating within-lap watch values.
- The analyzer removes its advanced point-counter view, dual cursors and heatmap; shared point-counter APIs remain available. Line and bounded opt-in raw points preserve the selected checkpoint and viewport.
- Incomplete lap coverage, unavailable cumulative comparisons and lap-versus-workout total mismatches remain explicit rather than being rescaled or extrapolated.
- Existing pace, pace-converter, weekly-mileage and heart-rate consumers now use the current shared interfaces without silent formula fallbacks.

## [0.2.0] - 2026-09-29

### Added
- **Track & Activity File Processing (`files`)**:
  - Zero-dependency universal XML and CSV parsers for **GPX 1.1**, **Garmin TCX 2.0**, **Google Earth KML**, and **CSV**.
  - Multi-format exporters: `serializeToGPX`, `serializeToTCX`, `serializeToKML`, `toGeoJSON`, `serializeToGeoJSON`, and `serializeToCSV`.
  - Comprehensive trackpoint extraction preserving heart rate, cadence, temperature, speed, power, altitude, and cumulative distance.
  - Geographic & sensor data manipulation:
    - Great-Circle Haversine distance calculator.
    - Moving time estimation filtering pauses and standstills.
    - Moving-average elevation gain & descent filter eliminating GPS altitude jitter.
    - Start & end distance cropping with zero-offset distance rebasing (`cropTrack`).
    - Privacy-protecting GPS coordinate stripping (`stripTrackGPS`).
    - Multi-file chronological activity merging (`mergeActivities`).

## [0.1.0] - 2026-09-28


### Added
- **VDOT & Training Paces Engine (`vdot`)**: Full implementation of Jack Daniels & Gilbert equations for oxygen consumption ($VO_2$) and fractional utilization ($p(t)$), solving VDOT scores, physiological training zones (E, M, T, I, R), and race equivalent times.
- **Race Predictor (`race-predictor`)**: Peter Riegel power law formula ($T_2 = T_1 \times (D_2 / D_1)^b$) with custom fatigue exponents and sanitized target keys.
- **Heart Rate Zones (`heart-rate-zones`)**: Max HR percentage, Karvonen Heart Rate Reserve (HRR), and Joe Friel Lactate Threshold (LTHR) 5-zone models, with Fox, Tanaka, and Gellish max HR age formulas.
- **Age-Graded Scoring (`age-grading`)**: Official World Masters Athletics (WMA) 2020 Road Running standards for ages 5–100 across 5K, 10K, Half Marathon, and Marathon distances.
- **Running Efficiency & Biomechanics (`running-efficiency`)**: Vertical Ratio (VR), Ground Contact Duty Factor (DF), and Joe Friel Aerobic Efficiency Factor (EF).
- **Pace & Speed Calculator / Converter (`pace`)**: Three-way distance/pace/time solving, cross-unit speed conversions, and split projections for standard road distances.
- **Weekly Mileage Ramp-Up Planner (`weekly-mileage`)**: Safe volume progression implementing the 10% rule and structured deload recovery cycles.
- **Internationalization (`i18n`)**: Hierarchical locale resolution with deep partial merging over `enLocale`.
- **Packaging & Dual Module Output**: ESM (`.js` + `.d.ts`) and CommonJS (`.cjs` + `.d.cts`) for full TypeScript `node16` / `nodenext` compatibility, plus standalone browser bundle (`runner-tools.global.js`) preserving MIT legal banner.
