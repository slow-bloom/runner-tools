# 🏃 Runner Tools

> Pure client-side exercise science algorithms, running pace formulas, and track utilities with zero dependencies. Built for runners, coaches, and sports data hackers.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178c6.svg)](https://www.typescriptlang.org/)
[![CI](https://github.com/slow-bloom/runner-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/slow-bloom/runner-tools/actions/workflows/ci.yml)

---

## Live Demo

Experience these algorithms live in action on the web:
- **[VDOT & Training Pace Calculator](https://apexrun.fit/tools/vdot-calculator/)**
- **[Race Predictor](https://apexrun.fit/tools/race-predictor/)**
- **[Heart Rate Zones Calculator](https://apexrun.fit/tools/heart-rate-zones-calculator/)**
- **[Age-Grading Calculator](https://apexrun.fit/tools/age-grading-calculator/)**
- **[Running Efficiency Calculator](https://apexrun.fit/tools/running-efficiency-calculator/)**
- **[Pace & Split Calculator](https://apexrun.fit/tools/pace-calculator/)**
- **[Pace & Speed Converter](https://apexrun.fit/tools/pace-converter/)**
- **[Weekly Mileage Ramp-Up Calculator](https://apexrun.fit/tools/weekly-mileage-calculator/)**

---

## Highlights

- **Pure & Zero Dependencies**: 100% pure TypeScript formulas with zero runtime dependencies. Runs anywhere: Node.js (dual ESM and CommonJS with full `.d.ts` / `.d.cts`), browsers, Bun, Deno, and Cloudflare Workers.
- **Scientifically Grounded**: Implements Daniels & Gilbert's oxygen consumption models, Riegel's endurance power laws, Karvonen heart rate reserve equations, and World Masters Athletics (WMA) road standards.
- **Built-in i18n & Extensible**: Multilingual support with hierarchical locale fallback (`exact tag` $\to$ `base language` $\to$ `English default`) and deep custom dictionary merging.
- **Strict Null Safety**: Clear contracts where invalid, unphysiological, or unsolvable inputs return `null` instead of throwing or generating `NaN`.
- **No Silent Clamping**: Discontinuous boundary cases and out-of-domain offsets are explicitly exposed rather than clamped silently.

---

## Installation

```bash
# npm
npm install @slow-bloom/runner-tools

# pnpm
pnpm add @slow-bloom/runner-tools

# yarn
yarn add @slow-bloom/runner-tools
```

Or directly via CDN in HTML:

```html
<script src="https://cdn.jsdelivr.net/npm/@slow-bloom/runner-tools@0.1.0/dist/runner-tools.global.js"></script>
<script>
  const result = RunnerTools.calculateVDOT({ distanceMeters: 5000, timeSeconds: 1200 });
  if (result) {
    console.log('VDOT:', result.vdotFormatted); // "49.8"
  }
</script>
```

---

## Quickstart

```typescript
import {
  calculateVDOT,
  predictRaceTime,
  calculateHeartRateZones,
  solvePace,
} from '@slow-bloom/runner-tools';

// 1. Calculate Daniels VDOT & training paces
const vdot = calculateVDOT({ distanceMeters: 5000, timeSeconds: 1200 });
console.log('Easy Pace:', vdot?.zones.E.lowPaceFormatted); // "5'03\""

// 2. Predict marathon finish time from a 10K
const marathonSecs = predictRaceTime(10000, 2700, 42195, 1.06); // ~12421s (3:27:01)

// 3. Calculate Karvonen Heart Rate Reserve (HRR) zones
const hr = calculateHeartRateZones({ method: 'karvonen', maxHR: 190, restingHR: 55 });
console.log('Zone 2:', hr?.zones[1].bpmFormatted); // "136 - 150 bpm"

// 4. Solve pace from distance and duration
const pace = solvePace({ distance: 10, timeSeconds: 2700, unit: 'km' });
console.log('Pace:', pace?.paceFormatted); // "4'30\" /km"
```

---

## Modules & Documentation

Detailed mathematical derivations, physiological domains, and complete API specifications are documented in dedicated guides:

| Module | Category | Scientific Model / Basis | Documentation |
|:---|:---|:---|:---|
| **`vdot`** | Formula | Daniels-Gilbert oxygen power equation & E/M/T/I/R training paces | [docs/formulas/vdot.md](./docs/formulas/vdot.md) |
| **`race-predictor`** | Formula | Peter Riegel's endurance power law ($T_2 = T_1 \cdot (D_2/D_1)^b$) | [docs/formulas/race-predictor.md](./docs/formulas/race-predictor.md) |
| **`heart-rate-zones`** | Formula | Karvonen (HRR), %MaxHR, and Joe Friel 5-zone LTHR models | [docs/formulas/heart-rate-zones.md](./docs/formulas/heart-rate-zones.md) |
| **`age-grading`** | Formula | World Masters Athletics (WMA) 2020 road standards & scoring tiers | [docs/formulas/age-grading.md](./docs/formulas/age-grading.md) |
| **`running-efficiency`** | Formula | Vertical Ratio (VR), Duty Factor (DF), and Aerobic Efficiency Factor (EF) | [docs/formulas/running-efficiency.md](./docs/formulas/running-efficiency.md) |
| **`pace`** | Formula | 3-way pace/time/distance solver, unit conversions & split tables | [docs/formulas/pace.md](./docs/formulas/pace.md) |
| **`weekly-mileage`** | Formula | 10% progression rule, ACWR recovery periodization & deload cycles | [docs/formulas/weekly-mileage.md](./docs/formulas/weekly-mileage.md) |
| **`i18n`** | Guide | Custom dictionaries, locale registration, and fallback resolution | [docs/guides/i18n-and-customization.md](./docs/guides/i18n-and-customization.md) |

---

## Operating Ranges & Principles

All algorithms conform to strict physiological domains:

| Module | Input Boundaries | Return Contract on Out-of-Domain |
|:---|:---|:---|
| **VDOT** | Distance: 400 m – 200 km; Time: 30 s – 100 h; VDOT: 15 – 85 | Returns `null` |
| **Race Predictor** | Base/Target Distance > 0 m; Exponent: 1.00 – 1.30 | Returns `null` |
| **Heart Rate Zones** | Max HR: 80 – 240 bpm; Resting HR: 30 – 120 bpm (Max > Rest) | Returns `null` |
| **Age Grading** | Age: 5 – 100 years; Standard road distances (5K, 10K, Half, Full) | Returns `null` |
| **Running Efficiency** | Cadence: 100 – 260 spm; GCT: 100 – 500 ms; Duty Factor < 50% | Returns `null` for invalid components |
| **Pace Solver** | Distance: 0.01 – 10,000; Pace: 60 – 3600 s/unit; Exactly 2 defined fields | Returns `null` |
| **Weekly Mileage** | Volume: 1 – 500 units; Max Weekly Increase: 1% – 50% | Returns `null` |

---

## Contributing

We welcome community contributions, sports science peer reviews, and bug reports! Please review [CONTRIBUTING.md](./CONTRIBUTING.md) for local development workflows and test guidelines.

```bash
# Run unit tests
npm test

# Verify type definitions
npm run typecheck

# Build dual bundle & browser distribution
npm run build
```

---

## License

[MIT License](./LICENSE) © 2026 Slowbloom Studio
