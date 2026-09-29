# Running Efficiency & Biomechanics (`running-efficiency`)

Evaluates mechanical running economy and cardiovascular efficiency from wearable sensor data: **Vertical Ratio (VR)**, **Duty Factor (DF)**, and **Aerobic Efficiency Factor (EF)**.

---

## Biomechanical & Physiological Metrics

### 1. Vertical Ratio (VR) — Mechanical Cost of Forward Motion

Vertical ratio quantifies the proportion of vertical oscillation (wasteful bouncing) relative to horizontal stride length:

$$\text{Vertical Ratio (\%)} = \left(\frac{\text{Vertical Oscillation (cm)}}{\text{Stride Length (cm)}}\right) \times 100\%$$

Lower values indicate more economical kinetic forward propulsion:

| Vertical Ratio (%) | Rating | Biomechanical Assessment |
|:---|:---|:---|
| **$< 6.0\%$** | **Elite** | Exceptional horizontal forward conversion; minimal vertical bounce |
| **$6.0\% \sim 8.0\%$** | **Good / Advanced** | Solid running economy; efficient stride mechanics |
| **$8.1\% \sim 10.0\%$** | **Average** | Moderate excess vertical displacement |
| **$> 10.0\%$** | **Needs Improvement** | Excessive bounding or overstriding braking forces |

### 2. Duty Factor (DF) — Stride Phase & Elastic Recoil

Duty factor represents the percentage of total stride duration where the foot is in contact with the ground:

$$\text{Duty Factor (\%)} = \left(\frac{\text{Ground Contact Time (ms)} \times \text{Cadence (spm)}}{120000}\right) \times 100\%$$

*(Formula derivation: $\text{Step time} = \frac{60000}{\text{Cadence}}$. Ground Contact Fraction $= \frac{\text{GCT}}{\text{Step time}} = \frac{\text{GCT} \times \text{Cadence}}{60000}$. Total gait cycle contains 2 steps $= 120000\text{ ms}$.)*

| Duty Factor (%) | Gait Category | Biomechanical Interpretation |
|:---|:---|:---|
| **$< 30\%$** | **Elite Elastic Recoil** | Substantial flight phase; high spring-mass tendon stiffness |
| **$30\% \sim 39\%$** | **Advanced Flight Phase** | Efficient mid-foot strike with rapid toe-off |
| **$40\% \sim 49\%$** | **Recreational Level** | Moderate ground contact duration |
| **$\ge 50\%$** | **Walking Gait / Invalid** | Physically impossible for running; indicates walking or sensor error |

*Physical Boundary Requirement*: Running by biomechanical definition requires an airborne flight phase ($\text{Duty Factor} < 50\%$). If calculated $\text{Duty Factor} \ge 50\%$, the module marks it as non-running or invalid.

### 3. Aerobic Efficiency Factor (EF) — Distance Per Heartbeat

Derived from Joe Friel's aerobic decoupling methodology, EF measures the distance traveled per single heart cycle:

$$\text{EF (m/beat)} = \frac{\text{Velocity (m/s)} \times 60}{\text{Heart Rate (bpm)}}$$

| EF (m/beat) | Aerobic Base Level |
|:---|:---|
| **$< 1.10$** | Developing aerobic capacity |
| **$1.10 \sim 1.35$** | Solid aerobic foundation |
| **$1.36 \sim 1.60$** | Advanced endurance engine |
| **$> 1.60$** | Elite cardiovascular output |

---

## API Reference

### `calculateRunningEfficiency`

Comprehensive evaluation combining form economy and aerobic efficiency.

```typescript
function calculateRunningEfficiency(
  params: RunningEfficiencyParams,
  options?: RunningEfficiencyOptions
): RunningEfficiencyResult;
```

#### `RunningEfficiencyParams` & `RunningEfficiencyOptions`

```typescript
interface RunningEfficiencyParams {
  verticalOscillationCm?: number;
  strideLengthM?: number;
  cadenceSpm?: number;
  groundContactTimeMs?: number;
  paceSeconds?: number;
  paceUnit?: 'km' | 'mi';
  heartRateBpm?: number;
}

interface RunningEfficiencyOptions {
  locale?: string | DeepPartial<RunnerToolsLocale>;
}
```

#### Individual Pure Calculators

```typescript
function calculateVerticalRatio(verticalOscillationCm: number, strideLengthM: number): number | null;
function calculateDutyFactor(cadenceSpm: number, groundContactTimeMs: number): number | null;
function calculateEfficiencyFactor(speedMs: number, heartRateBpm: number): number | null;
```

---

## Code Example

```typescript
import {
  calculateRunningEfficiency,
  calculateDutyFactor,
} from '@slow-bloom/runner-tools';

// 1. Calculate combined efficiency report
const report = calculateRunningEfficiency(
  {
    verticalOscillationCm: 8.4,
    strideLengthM: 1.18,
    cadenceSpm: 178,
    groundContactTimeMs: 230,
    paceSeconds: 300, // 5:00 min/km
    paceUnit: 'km',
    heartRateBpm: 142,
  },
  { locale: 'en' }
);

if (report.formEconomy?.verticalRatio) {
  console.log(`Vertical Ratio: ${report.formEconomy.verticalRatioFormatted}`); // "7.1%"
}
if (report.formEconomy?.dutyFactor) {
  console.log(`Duty Factor: ${report.formEconomy.dutyFactorFormatted}`);       // "34.1%"
}
if (report.aerobicEfficiency?.efficiencyFactor) {
  console.log(`Aerobic EF: ${report.aerobicEfficiency.efficiencyFactorFormatted}`); // "1.41 m/beat"
}
```

---

## Primary References

1. **Cavanagh, P. R., & Kram, R.** (1989). "Stride length in distance running: velocity, body dimensions, and added mass effects". *Medicine & Science in Sports & Exercise*, 21(4), 467–479.
2. **Friel, J.** (2009). *The Triathlete's Training Bible* (3rd ed.). VeloPress.
3. **van Oeveren, J., de Ruiter, C. J., Beek, P. J., & van Dieën, J. H.** (2017). "Optimal stride frequencies in running at different speeds". *PLOS ONE*, 12(10), e0184273. DOI: 10.1371/journal.pone.0184273.
