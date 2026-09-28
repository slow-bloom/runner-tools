# Changelog

All notable changes to `@slow-bloom/runner-tools` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-09-28

### Added
- **VDOT & Training Paces Engine (`vdot`)**: Full implementation of Jack Daniels & Gilbert equations for oxygen consumption ($VO_2$) and fractional utilization ($p(t)$), solving VDOT scores, physiological training zones (E, M, T, I, R), and race equivalent times.
- **Race Predictor (`race-predictor`)**: Peter Riegel power law formula ($T_2 = T_1 \times (D_2 / D_1)^b$) with custom fatigue exponents and sanitized target keys.
- **Heart Rate Zones (`heart-rate-zones`)**: Max HR percentage, Karvonen Heart Rate Reserve (HRR), and Joe Friel Lactate Threshold (LTHR) 5-zone models, with Fox, Tanaka, and Gellish max HR age formulas.
- **Age-Graded Scoring (`age-grading`)**: Official World Masters Athletics (WMA) 2020 Road Running standards for ages 5–100 across 5K, 10K, Half Marathon, and Marathon distances.
- **Running Efficiency & Biomechanics (`running-efficiency`)**: Vertical Ratio (VR), Ground Contact Duty Factor (DF), and Joe Friel Aerobic Efficiency Factor (EF).
- **Internationalization (`i18n`)**: Hierarchical locale resolution with deep partial merging over `enLocale`.
- **Packaging & Dual Module Output**: ESM (`.js` + `.d.ts`) and CommonJS (`.cjs` + `.d.cts`) for full TypeScript `node16` / `nodenext` compatibility, plus standalone browser bundle (`runner-tools.global.js`) preserving MIT legal banner.
