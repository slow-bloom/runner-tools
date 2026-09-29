# VDOT & Training Paces (`vdot`)

Implements the classic **Jack Daniels' Running Formula** via the Daniels-Gilbert nonlinear oxygen power equations.

---

## Mathematical Foundation

The VDOT methodology establishes an empirical link between running velocity, oxygen cost ($VO_2$), and the fraction of maximal oxygen uptake ($VO_2\text{max}$) sustainable over a race duration.

### 1. Oxygen Cost ($VO_2$) as a Function of Velocity

Given running velocity $v$ in meters per minute:

$$VO_2(v) = -4.60 + 0.182258 \cdot v + 0.000104 \cdot v^2$$

This quadratic relationship accounts for both the linear metabolic cost of forward movement and aerodynamic drag increases at higher velocities.

### 2. Fractional Utilization ($p$) Sustainable Over Duration

Given duration $t$ in minutes ($t = \frac{\text{time in seconds}}{60}$):

$$p(t) = 0.80 + 0.1894393 \cdot e^{-0.012778 \cdot t} + 0.2989558 \cdot e^{-0.1932605 \cdot t}$$

The fractional utilization curve models human aerobic stamina decay, reflecting an athlete's ability to operate near 100% $VO_2\text{max}$ for short efforts (~10 minutes) down to ~75–80% for marathon durations.

### 3. VDOT Score

$$VDOT = \frac{VO_2(v)}{p(t)}$$

### 4. Training Zones

Daniels defines five training intensities anchored to percentage thresholds of VDOT:

| Zone | Name | % of VDOT | Primary Physiological Purpose |
|:---|:---|:---|:---|
| **E** | Easy / Recovery | $57.76\% \sim 71.42\%$ | Capillary density, mitochondrial biogenesis, cardiac stroke volume |
| **M** | Marathon Pace | $78.64\% \sim 82.68\%$ | Race-pace neuromuscular groove, glycogen sparing efficiency |
| **T** | Threshold | $85.03\% \sim 89.30\%$ | Lactate clearance capacity, endurance endurance at threshold |
| **I** | Interval | $95.71\% \sim 100.51\%$ | $VO_2\text{max}$ expansion, aerobic power |
| **R** | Repetition | $101.45\% \sim 104.32\%$ | Anaerobic alactic power, running economy, biomechanical recoil |

To invert target $VO_2$ back to running velocity $v$, the solver utilizes the quadratic root:

$$0.000104 \cdot v^2 + 0.182258 \cdot v - (4.60 + VO_2) = 0$$

$$v = \frac{-0.182258 + \sqrt{0.182258^2 - 4 \cdot 0.000104 \cdot (-4.60 - VO_2)}}{2 \cdot 0.000104}$$

---

## API Reference

### `calculateVDOTScore`

Calculates a pure numeric VDOT value from a known race performance.

```typescript
function calculateVDOTScore(
  distanceMeters: number,
  timeSeconds: number
): number | null;
```

- **Returns**: A number between `15` and `85` (inclusive), or `null` if the input is unphysiological or out of range.

### `calculateVDOT`

Calculates the complete VDOT analysis including all five training pace zones and equivalent race times.

```typescript
function calculateVDOT(params: VDOTParams): VDOTResult | null;
```

#### `VDOTParams`

```typescript
interface VDOTParams {
  distanceMeters: number;
  timeSeconds: number;
  unit?: 'km' | 'mi'; // default: 'km'
  lang?: string;      // default: 'en'
}
```

#### `VDOTResult`

```typescript
interface VDOTResult {
  vdot: number;
  vdotFormatted: string;
  zones: {
    E: TrainingZoneItem;
    M: TrainingZoneItem;
    T: TrainingZoneItem;
    I: TrainingZoneItem;
    R: TrainingZoneItem;
  };
  equivalentTimes: EquivalentRaceTimeItem[];
}
```

### `calculateEquivalentTimesRaw`

Low-level helper returning equivalent finish times (in seconds) for standard distances without string formatting.

```typescript
function calculateEquivalentTimesRaw(
  vdot: number,
  distances?: number[]
): Record<number, number>;
```

---

## Operating Boundaries & Error Handling

- **Distance Range**: $400\text{ m} \le \text{distance} \le 200{,}000\text{ m}$ (200 km).
- **Time Range**: $30\text{ s} \le \text{time} \le 360{,}000\text{ s}$ (100 hours).
- **VDOT Domain**: $[15.0, 85.0]$.
- **Strict Null Policy**: If inputs fall outside these boundaries or produce non-convergent equations, functions return `null`. There is **no silent clamping**.

---

## Code Example

```typescript
import { calculateVDOT, calculateVDOTScore } from '@slow-bloom/runner-tools';

// 1. Calculate pure score
const score = calculateVDOTScore(5000, 1200); // 20:00 5K -> ~49.8

// 2. Full calculation with custom units and locale
const result = calculateVDOT({
  distanceMeters: 5000,
  timeSeconds: 1200,
  unit: 'km',
  lang: 'en',
});

if (result) {
  console.log(`VDOT: ${result.vdotFormatted}`);
  console.log(`Easy Pace: ${result.zones.E.lowPaceFormatted} - ${result.zones.E.highPaceFormatted} /km`);
  console.log(`Threshold Pace: ${result.zones.T.lowPaceFormatted} - ${result.zones.T.highPaceFormatted} /km`);
  
  for (const eq of result.equivalentPerformances) {
    console.log(`${eq.distanceLabel}: ${eq.timeFormatted}`);
  }
}
```

---

## Primary References

1. **Daniels, J., & Gilbert, J.** (1979). *Oxygen Power: Performance Tables for Distance Runners*. Privately published.
2. **Daniels, J.** (2013). *Daniels' Running Formula* (3rd ed.). Human Kinetics.
