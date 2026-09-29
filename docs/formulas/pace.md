# Pace, Speed & Split Projections (`pace`)

Comprehensive calculations for pace solving, speed conversions, and split projections across metric and imperial distance systems.

---

## Capabilities & Formulas

### 1. Fundamental Conversions

- **Pace ($P$, s/km) to Speed ($v$, km/h)**:
  $$v = \frac{3600}{P}$$

- **Kilometers to Miles Conversion**:
  $$1\text{ mi} = 1.609344\text{ km}$$
  $$P_{\text{mi}} = P_{\text{km}} \times 1.609344$$

### 2. Three-Way Solver (`solvePace`)

Given any two parameters of **Distance**, **Pace**, and **Time**, solves for the missing third:

- **Solve Pace**: $\text{Pace} = \frac{\text{Time}}{\text{Distance}}$
- **Solve Time**: $\text{Time} = \text{Distance} \times \text{Pace}$
- **Solve Distance**: $\text{Distance} = \frac{\text{Time}}{\text{Pace}}$

### 3. Finish Projection Tables (`finishTable`)

Generates standard-distance finish projections (5K, 10K, Half Marathon, Marathon) with localized pace variation offsets (`[-10, -5, 0, 5, 10]` seconds) for race pacing strategy.

---

## API Reference

### `solvePace`

Solves for the missing variable among distance, pace, and time.

```typescript
function solvePace(params: PaceSolverParams): PaceSolverResult | null;
```

#### `PaceSolverParams`

```typescript
interface PaceSolverParams {
  distance?: number;     // 0.01 to 10,000 units
  paceSeconds?: number;  // 60 to 3600 seconds/unit
  timeSeconds?: number;  // positive duration in seconds
  unit?: 'km' | 'mi';    // default: 'km'
  lang?: string;         // default: 'en'
}
```

*Validation Rule*: Exactly two of the three primary inputs must be provided. Supplying all three (even if zero or invalid) or fewer than two results in `null`.

#### `PaceSolverResult`

```typescript
interface PaceSolverResult {
  solvedField: 'distance' | 'pace' | 'time';
  distance: number;
  distanceFormatted: string; // Resolves unit via locale dictionary
  paceSeconds: number;
  paceFormatted: string;     // e.g. "4'30\""
  timeSeconds: number;
  timeFormatted: string;     // e.g. "45:00"
  speedKmh: number;
  speedMph: number;
  unit: PaceUnit;
  finishTable: PaceFinishTableItem[];
}
```

### `convertPace`

Converts pace across metric and imperial systems and outputs equivalent speed and benchmark finish times.

```typescript
function convertPace(
  params: PaceConversionParams,
  options?: { locale?: LocaleInput }
): PaceConversionResult | null;
```

### Pure Helpers

```typescript
function calculatePace(distance: number, timeSeconds: number): number | null;
function calculateTime(distance: number, paceSeconds: number): number | null;
function calculateDistance(timeSeconds: number, paceSeconds: number): number | null;
```

---

## Operating Boundaries & Non-Clamping Contract

- **Distance Range**: $0.01 \le \text{distance} \le 10{,}000$ (both supplied and computed).
- **Pace Range**: $60\text{ s} \le \text{pace} \le 3600\text{ s}$ per km/mi.
- **Pace Table Offsets**: In pace variation tables (`finishTable`), offsets ranging from −10 to +10 seconds (`[-10, -5, 0, 5, 10]`) resulting in paces $< 60\text{ s}$ or $> 3600\text{ s}$ are returned with `paceSecs: null`, `timeSeconds: null`, and `'—'` formatted strings rather than silently clamping to the boundary.

---

## Code Example

```typescript
import { solvePace, convertPace } from '@slow-bloom/runner-tools';

// 1. Solve pace from 10K in 45 minutes
const solved = solvePace({
  distance: 10,
  timeSeconds: 2700,
  unit: 'km',
});

if (solved) {
  console.log(`Solved Field: ${solved.solvedField}`);      // "pace"
  console.log(`Pace: ${solved.paceFormatted} /km`);        // "4'30\""
  console.log(`Speed: ${solved.speedKmh} km/h`);           // 13.33 km/h
}

// 2. Convert 5:00 min/km to Imperial & finish projections
const converted = convertPace({
  paceSeconds: 300,
  paceUnit: 'km',
});

if (converted) {
  console.log(`Mile Pace: ${converted.paceMiFormatted}`);  // "8'03\""
  console.log(`MPH: ${converted.speedMph}`);               // 7.46 mph
  console.log(`5K Finish: ${converted.splits[0].timeFormatted}`); // "25:00"
}
```
