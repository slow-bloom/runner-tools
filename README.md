# 🏃 Runner Tools

> Pure client-side exercise science algorithms, running pace formulas, and track utilities. Built for runners, coaches, and sports data hackers.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178c6.svg)](https://www.typescriptlang.org/)
[![CI](https://github.com/slow-bloom/runner-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/slow-bloom/runner-tools/actions/workflows/ci.yml)

---

## Live Demo

Experience these algorithms live in action on the web:
- **[VDOT & Training Pace Calculator (Live Web Demo)](https://apexrun.fit/tools/vdot-calculator/)**
- **[Race Predictor (Live Web Demo)](https://apexrun.fit/tools/race-predictor/)**
- **[Heart Rate Zones Calculator (Live Web Demo)](https://apexrun.fit/tools/heart-rate-zones-calculator/)**
- **[Age-Grading Calculator (Live Web Demo)](https://apexrun.fit/tools/age-grading-calculator/)**
- **[Running Efficiency Calculator (Live Web Demo)](https://apexrun.fit/tools/running-efficiency-calculator/)**
- **[Pace & Split Calculator (Live Web Demo)](https://apexrun.fit/tools/pace-calculator/)**
- **[Pace & Speed Converter (Live Web Demo)](https://apexrun.fit/tools/pace-converter/)**
- **[Weekly Mileage Ramp-Up Calculator (Live Web Demo)](https://apexrun.fit/tools/weekly-mileage-calculator/)**

---

## Highlights

- **Pure & Zero Dependencies**: 100% pure TypeScript formulas with zero runtime dependencies. Runs anywhere: Node.js (both ESM and CommonJS with full type declarations), browsers, Bun, Deno, Cloudflare Workers.
- **Scientifically Grounded**: Implements Daniels & Gilbert's oxygen consumption models, Riegel's endurance power laws, Karvonen heart rate reserve equations, and World Masters Athletics (WMA) road standards.
- **Built-in i18n & Extensible**: Multilingual support with hierarchical locale fallback (exact tag -> base language -> English default) and deep custom dictionary merging.
- **Strict Null Safety**: Clear contracts where invalid, unphysiological, or unsolvable inputs return `null` instead of throwing or generating `NaN`.
- **Rigorously Tested**: Thorough unit test coverage benchmarking against published athletic standards and physiological boundary conditions.

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
    console.log('VDOT:', result.vdotFormatted);
  }
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

if (res) {
  console.log('VDOT:', res.vdotFormatted); // "49.8"
  console.log('Easy Pace:', `${res.zones.E.lowPaceFormatted} - ${res.zones.E.highPaceFormatted} /km`);
  // "5'03\" - 5'59\" /km"
}
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

if (result) {
  console.log('Half Marathon:', result.predictions.find(p => p.key === 'halfMarathon')?.timeFormatted);
  // "1:39:17"
  console.log('Marathon:', result.predictions.find(p => p.key === 'marathon')?.timeFormatted);
  // "3:27:01"
}
```

---

### 3. Heart Rate Zones (`heart-rate-zones`)

Calculates 5 targeted training zones based on three physiological reference models:
- **Max HR %**: 50–60%, 60–70%, 70–80%, 80–90%, 90–100% of maximum heart rate.
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

if (karvonenResult) {
  console.log(karvonenResult.zones[1]);
  // Zone 2 Easy / Aerobic: { low: 139, high: 151, bpmFormatted: "139 - 151 bpm", pctFormatted: "60 - 70%" }
}

// 2. Lactate Threshold Method
const lthrResult = calculateHeartRateZones({
  method: 'lthr',
  lthr: 165,
});

if (lthrResult) {
  console.log(lthrResult.zones[4]);
  // Zone 5 Maximum: { low: 165, bpmFormatted: "≥ 165 bpm", pctFormatted: ">= 100%" }
}
```

---

### 4. Age-Graded Calculator (`age-grading`)

Evaluates performance against official **World Masters Athletics (WMA) 2020 Road Standards** across standard distances (5K, 10K, Half Marathon, Marathon) for athletes aged 5 to 100:

$$\text{Age-Graded Score (\%)} = \left(\frac{\text{WMA Age Standard Time}}{\text{Finish Time}}\right) \times 100\%$$

$$\text{Age-Graded Equivalent Time} = \text{Finish Time} \times \left(\frac{\text{WMA Open Standard Time}}{\text{WMA Age Standard Time}}\right)$$

#### Master Athlete Performance Tiers

- **≥ 90%**: World Class
- **80% – 89.9%**: National Class
- **70% – 79.9%**: Regional Class
- **60% – 69.9%**: Local Class
- **50% – 59.9%**: Active Runner
- **< 50%**: Recreational Runner

#### Usage

```typescript
import { calculateAgeGrading, calculateAgeGradingRaw } from '@slow-bloom/runner-tools';

// Calculate age grading
const result = calculateAgeGrading({
  gender: 'M',
  age: 40,
  distance: '21097', // 5000, 10000, 21097, 42195 or 'halfMarathon'
  timeSeconds: 6540, // 1h 49m 0s
});

if (result) {
  console.log('Score:', result.scoreFormatted); // e.g. "55.5%"
  console.log('Level:', result.level.label); // "Active Runner"
  console.log('Open Equivalent:', result.ageEquivalentTimeFormatted); // e.g. "1:45:08"
}
```

---

### 5. Running Efficiency & Biomechanics (`running-efficiency`)

Evaluates mechanical form economy and cardiovascular aerobic energy delivery across key efficiency metrics:

1. **Vertical Ratio (VR)**:
   $$\text{Vertical Ratio (\%)} = \left(\frac{\text{Vertical Oscillation (cm)}}{\text{Stride Length (cm)}}\right) \times 100\%$$
   - Elite: `< 6.0%`
   - Good / Advanced: `6.0% – 8.0%`
   - Average: `8.1% – 10.0%`
   - Needs Improvement: `> 10.0%`

2. **Duty Factor (DF)**: Percentage of total gait cycle spent in ground contact:
   $$\text{Duty Factor (\%)} = \left(\frac{\text{Ground Contact Time (ms)} \times \text{Cadence (spm)}}{120000}\right) \times 100\%$$
   - Elite Elastic Recoil: `< 30%`
   - Advanced Flight Phase: `30% – 39%`
   - Recreational Level: `40% – 50%`

3. **Aerobic Efficiency Factor (EF)**: Joe Friel's distance-per-heartbeat index:
   $$\text{EF (m/beat)} = \frac{\text{Speed (m/s)} \times 60}{\text{Heart Rate (bpm)}}$$
   - Developing: `< 1.10`
   - Solid Aerobic Base: `1.10 – 1.35`
   - Advanced Aerobic Engine: `1.36 – 1.60`
   - Elite Aerobic Capacity: `> 1.60`

#### Usage

```typescript
import {
  calculateRunningEfficiency,
  calculateVerticalRatio,
  calculateDutyFactor,
  calculateEfficiencyFactor,
} from '@slow-bloom/runner-tools';

const result = calculateRunningEfficiency({
  verticalOscillationCm: 8.2,
  strideLengthM: 1.15,
  cadenceSpm: 175,
  groundContactTimeMs: 235,
  paceSeconds: 300, // 5:00 min/km
  paceUnit: 'km',
  heartRateBpm: 145,
});

console.log('Vertical Ratio:', result.formEconomy?.verticalRatioFormatted); // "7.1%"
console.log('Duty Factor:', result.formEconomy?.dutyFactorFormatted); // "34.3%"
console.log('Efficiency Factor:', result.aerobicEfficiency?.efficiencyFactorFormatted); // "1.38 m/beat"
```

---

### 6. Pace & Speed Calculations (`pace`)

Comprehensive calculations for pace solving, speed conversions, and split projections across metric and imperial systems.

#### Usage

```typescript
import {
  calculatePace,
  calculateTime,
  calculateDistance,
  convertPace,
  solvePace,
} from '@slow-bloom/runner-tools';

// 1. Pure calculations
const paceSecs = calculatePace(10, 2700); // 270 s/km (4'30" /km)
const totalTime = calculateTime(10, 270); // 2700 seconds

// 2. Pace & Speed Conversion across units
const converted = convertPace({ paceSeconds: 300, paceUnit: 'km' });
if (converted) {
  console.log('min/km:', converted.paceKmFormatted); // "5'00\""
  console.log('min/mi:', converted.paceMiFormatted); // "8'03\""
  console.log('km/h:', converted.speedKmh); // 12.0
  console.log('mph:', converted.speedMph); // 7.46
  console.log('5K finish:', converted.splits[0].timeFormatted); // "25:00"
}

// 3. Three-way Solver (provide any 2 of distance, pace, time)
const solved = solvePace({ distance: 10, timeSeconds: 2700, unit: 'km' });
if (solved) {
  console.log('Solved Field:', solved.solvedField); // "pace"
  console.log('Calculated Pace:', solved.paceFormatted); // "4'30\""
}
```

---

### 7. Weekly Mileage Ramp-Up Planner (`weekly-mileage`)

Generates structured, progressive running volume plans based on the classical 10% rule and structured deload recovery cycles.

> **Scientific Basis & Provenance**: The 10% weekly volume progression rule is an empirical training heuristic (Henderson, 1979; Daniels, 2014). Clinical and epidemiological research (Nielsen et al., 2014) indicates that volume progression guidelines do not guarantee individual immunity against running-related injuries (RRI). Structured deload weeks (reducing volume by 20–30% every 3–4 weeks) follow foundational periodization principles (Bompa & Haff, 2009; Gabbett, 2016) to attenuate acute fatigue while consolidating tissue adaptation. This model provides mathematical planning guidance, not a medical or injury-prevention guarantee.

#### Usage

```typescript
import { calculateWeeklyMileagePlan } from '@slow-bloom/runner-tools';

const plan = calculateWeeklyMileagePlan({
  currentDistance: 25,
  targetDistance: 50,
  unit: 'km',
  maxWeeklyIncreasePct: 10, // 10% weekly build
  includeDeload: true,      // Deload every 4th week
  deloadFrequency: 4,
  deloadReductionPct: 20,   // -20% recovery volume
});

if (plan) {
  console.log('Total Weeks:', plan.totalWeeks); // e.g. 8
  for (const week of plan.weeks) {
    console.log(`Week ${week.weekNumber}: ${week.distanceFormatted} (${week.statusLabel})`);
  }
}
```

---

## Scientific Foundations & Operational Boundaries

### Operating Ranges and Assumptions

| Algorithm | Primary Input Ranges | Valid Domain | Edge-Case Behavior |
|:---|:---|:---|:---|
| **VDOT** | Distance: 400 m – 200 km<br>Duration: 30 s – 100 h | VDOT: 15 – 85 | Returns `null` if unphysiological or unbracketed in solver; no silent clamping |
| **Race Predictor** | Base Distance: > 0 m<br>Target Distance: > 0 m<br>Exponent: 1.00 – 1.30 | Times: 5 s – 100 h | Returns `null` for non-positive or infinite values; sanitizes prototype keys |
| **Heart Rate Zones** | Max HR: 80 – 240 bpm<br>Resting HR: 30 – 120 bpm | Max HR > Resting HR | Throws descriptive error if Resting HR ≥ Max HR |
| **Age Grading** | Ages: 5 – 100 years | 5K, 10K, Half, Full | Returns `null` for unsupported ages or non-standard distances |
| **Running Efficiency** | Cadence: 100 – 260 spm<br>GCT: 100 – 500 ms | Duty Factor: [15%, 50%)<br>(Flight phase required) | Evaluates metrics independently; rejects impossible contact fractions without flight phase |
| **Pace Solver** | Distance: 0.01 – 10,000<br>Pace: 60 – 3600 s/unit | Exactly 2 of 3 inputs | Returns `null` if inputs ambiguous or out of physiological running bounds |
| **Weekly Mileage** | Volume: 1 – 500 distance units<br>Increase: 1% – 50% | Target ≥ Current | Generates progressive overload cycles up to 52 weeks |

### Primary References

1. **Daniels, J., & Gilbert, J.** (1979). *Oxygen Power: Performance Tables for Distance Runners*. Privately published.
2. **Daniels, J.** (2013). *Daniels' Running Formula* (3rd ed.). Human Kinetics.
3. **Riegel, P. S.** (1977). "Athletic Records and Human Endurance". *American Scientist*, 65(3), 285–290.
4. **Riegel, P. S.** (1981). "Athletic Records and Human Endurance". *Runner's World*, May 1981.
5. **Karvonen, M. J., Kentala, E., & Mustala, O.** (1957). "The effects of training on heart rate: a longitudinal study". *Annales Medicinae Experimentalis et Biologiae Fenniae*, 35(3), 307–315.
6. **Tanaka, H., Monahan, K. D., & Seals, D. R.** (2001). "Age-predicted maximal heart rate revisited". *Journal of the American College of Cardiology*, 37(1), 153–156.
7. **Gellish, R. L., et al.** (2007). "Longitudinal Modeling of the Relationship between Age and Maximal Heart Rate". *Medicine & Science in Sports & Exercise*, 39(5), 822–829.
8. **World Masters Athletics (WMA)**. (2020). *Age-Grading Tables for Road Running Events*.
9. **Friel, J.** (2009). *The Triathlete's Training Bible* (3rd ed.). VeloPress.
10. **Nielsen, R. O., et al.** (2014). "The 10% increase rule for preventing running-related injuries: a secondary analysis of a 1-year PRISMO cohort study". *Journal of Orthopaedic & Sports Physical Therapy*, 44(10), 739–747.
11. **Gabbett, T. J.** (2016). "The training—injury prevention paradox: should athletes be training smarter and harder?". *British Journal of Sports Medicine*, 50(5), 273–280.
12. **Bompa, T. O., & Haff, G. G.** (2009). *Periodization: Theory and Methodology of Training* (5th ed.). Human Kinetics.

---

## Contributing

We welcome community contributions, bug reports, and discussions regarding endurance sports algorithms! Please review [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, test execution, and guidelines.

---

## License

[MIT License](./LICENSE) © 2026 Slowbloom Studio
