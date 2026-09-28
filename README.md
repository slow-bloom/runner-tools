# 🏃 Runner Tools

> Pure client-side exercise science algorithms, running pace formulas, and track utilities. Built for runners, coaches, and sports data hackers.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178c6.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)]()

---

## Live Demo

Experience these algorithms live in action on the web:
- **[VDOT & Training Pace Calculator (Live Web Demo)](https://apexrun.fit/tools/vdot-calculator/)**
- **[Race Predictor (Live Web Demo)](https://apexrun.fit/tools/race-predictor/)**
- **[Heart Rate Zones Calculator (Live Web Demo)](https://apexrun.fit/tools/heart-rate-zones-calculator/)**

---

## Highlights

- **Pure & Zero Dependencies**: 100% pure TypeScript formulas with zero runtime dependencies. Runs anywhere: Node.js, browsers, Bun, Deno, Cloudflare Workers.
- **Scientifically Grounded**: Implements Daniels & Gilbert's oxygen consumption models, Riegel's endurance power laws, and Karvonen heart rate reserve equations.
- **Built-in i18n & Extensible**: Multilingual support with hierarchical locale fallback (exact tag -> base language -> English default) and custom dictionary registration.
- **Unit Tested**: Rigorously benchmarked against standard racing records and numerical boundary conditions.

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
<script src="https://cdn.jsdelivr.net/npm/@slow-bloom/runner-tools/dist/runner-tools.global.js"></script>
<script>
  const result = RunnerTools.calculateVDOT({ distanceMeters: 5000, timeSeconds: 1200 });
  console.log('VDOT:', result.vdotFormatted);
</script>
```

---

## Modules

### 1. VDOT & Training Paces (`vdot`)

Implements the classic **Jack Daniels' Running Formula** via the Daniels-Gilbert nonlinear equations.

#### Mathematical Foundation

1. **Oxygen Cost ($VO_2$) as a function of velocity ($v$, in meters/min):**
   $$VO_2 = -4.60 + 0.182258 \cdot v + 0.000104 \cdot v^2$$

2. **Fractional Utilization ($p$) sustainable over duration ($t$, in minutes):**
   $$p(t) = 0.80 + 0.1894393 \cdot e^{-0.012778 \cdot t} + 0.2989558 \cdot e^{-0.1932605 \cdot t}$$

3. **VDOT Score:**
   $$VDOT = \frac{VO_2(v)}{p(t)}$$

4. **Training Zones:**
   - **E (Easy)**: $57.76\% \sim 71.42\%$ VDOT
   - **M (Marathon)**: $78.64\% \sim 82.68\%$ VDOT
   - **T (Threshold)**: $85.03\% \sim 89.30\%$ VDOT
   - **I (Interval)**: $95.71\% \sim 100.51\%$ VDOT
   - **R (Repetition)**: $101.45\% \sim 104.32\%$ VDOT

#### Usage

```typescript
import { calculateVDOT, calculateVDOTScore } from '@slow-bloom/runner-tools';

// 1. Pure numeric score
const vdot = calculateVDOTScore(5000, 1200); // ~49.8

// 2. Full calculation with training zones
const res = calculateVDOT({
  distanceMeters: 5000,
  timeSeconds: 1200,
  unit: 'km', // 'km' or 'mi'
  lang: 'en',
});

console.log('VDOT:', res.vdotFormatted); // "49.8"
console.log('Easy Pace:', `${res.zones.E.lowPaceFormatted} - ${res.zones.E.highPaceFormatted} /km`);
// e.g. "5'05" - 5'41" /km"
```

---

### 2. Peter Riegel Race Predictor (`race-predictor`)

Predicts race finish times and target paces across arbitrary distances using Peter Riegel's power law formula:

$$T_2 = T_1 \times \left(\frac{D_2}{D_1}\right)^b$$

Where $b$ represents the endurance fatigue exponent:
- `1.06`: Standard Riegel factor (high aerobic base, well-trained runners)
- `1.08`: Recreational runners (moderate weekly mileage)
- `1.10`: Novice runners / low weekly mileage

#### Usage

```typescript
import { calculateRacePredictions, predictRaceTime } from '@slow-bloom/runner-tools';

// 1. Pure numeric prediction (seconds)
const marathonSecs = predictRaceTime(10000, 2700, 42195, 1.06);

// 2. Multi-distance prediction table
const result = calculateRacePredictions({
  baseDistanceMeters: 10000,
  baseTimeSeconds: 2700,
  exponent: 1.06,
  unit: 'km',
});

console.log('Half Marathon:', result.predictions.find(p => p.key === 'halfMarathon')?.timeFormatted);
// "1:39:17"
console.log('Marathon:', result.predictions.find(p => p.key === 'marathon')?.timeFormatted);
// "3:27:01"
```

---

### 3. Heart Rate Zones (`heart-rate-zones`)

Calculates 5 targeted training zones based on three physiological reference models:
- **Max HR %**: 50-60%, 60-70%, 70-80%, 80-90%, 90-100% of maximum heart rate.
- **Karvonen (HRR)**: Incorporates resting heart rate to compute Heart Rate Reserve: $\text{Target HR} = \text{Resting HR} + (\text{Max HR} - \text{Resting HR}) \times \text{Intensity}$.
- **Lactate Threshold (LTHR)**: Joe Friel's 5-zone model referenced from functional threshold heart rate.

Includes age estimation models:
- Fox: $220 - \text{age}$
- Tanaka: $208 - 0.7 \times \text{age}$
- Gellish: $207 - 0.7 \times \text{age}$

#### Usage

```typescript
import {
  calculateHeartRateZones,
  calculateHeartRateZonesRaw,
  estimateMaxHR,
} from '@slow-bloom/runner-tools';

// Estimate Max HR
const estMax = estimateMaxHR(30, 'fox'); // 190

// 1. Karvonen Method
const karvonenResult = calculateHeartRateZones({
  method: 'karvonen',
  maxHR: 190,
  restingHR: 60,
});

console.log(karvonenResult.zones[1]);
// Zone 2 Easy / Aerobic: { low: 139, high: 151, bpmFormatted: "139 - 151 bpm", pctFormatted: "60 - 70%" }

// 2. Lactate Threshold Method
const lthrResult = calculateHeartRateZones({
  method: 'lthr',
  lthr: 165,
});

console.log(lthrResult.zones[4]);
// Zone 5 Maximum: { low: 165, bpmFormatted: "≥ 165 bpm", pctFormatted: ">= 100%" }
```

---

## Roadmap

- [x] Jack Daniels VDOT & Training Paces Engine
- [x] Peter Riegel Race Performance Predictor
- [x] Heart Rate Zones (Max HR, Karvonen HRR, LTHR)
- [ ] Age-Graded Scoring (WMA Tables)
- [ ] Running Efficiency & Heart Rate Decoupling (EF / Pw:Hr)
- [ ] Browser-based FIT / GPX / TCX Parser & Converter (Zero Server Uploads)
- [ ] GPS Drift & Ghost Mileage Analyzer

---

## Contributing

Contributions, bug reports, and discussions regarding endurance sports algorithms are warmly welcomed! Please feel free to submit a pull request or open an issue.

---

## License

[MIT License](./LICENSE) © 2026 Slowbloom Studio
