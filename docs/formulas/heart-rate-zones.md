# Heart Rate Training Zones (`heart-rate-zones`)

Calculates personalized, five-zone training distributions based on three established physiological reference models: **Percentage of Maximum Heart Rate (%MaxHR)**, **Karvonen Heart Rate Reserve (HRR)**, and **Lactate Threshold Heart Rate (LTHR)**.

---

## Physiological Models

### 1. Percentage of Maximum HR (%MaxHR)

A classic intensity scale categorizing heart rate as a direct fraction of maximum heart rate ($HR_{\text{max}}$):

| Zone | Label | Range (%MaxHR) | Typical Metabolic Pathway |
|:---|:---|:---|:---|
| **Z1** | Warm Up / Recovery | 50% – 60% | Active recovery, basic capillary blood flow |
| **Z2** | Easy / Aerobic | 60% – 70% | Fatty acid oxidation, mitochondrial development |
| **Z3** | Aerobic / Tempo | 70% – 80% | Mixed fat and glycogen combustion, aerobic stamina |
| **Z4** | Threshold | 80% – 90% | Lactate threshold, rapid glycogen depletion |
| **Z5** | Maximum / Anaerobic | 90% – 100% | High-intensity anaerobic glycolysis, neuromuscular power |

### 2. Karvonen Method (Heart Rate Reserve, HRR)

Introduced by Dr. Martti Karvonen in 1957, this model incorporates the athlete's resting heart rate ($HR_{\text{rest}}$) to determine **Heart Rate Reserve**:

$$HRR = HR_{\text{max}} - HR_{\text{rest}}$$

$$\text{Target HR} = HR_{\text{rest}} + HRR \times \text{Intensity}$$

Because fitter individuals generally possess lower resting heart rates (elevated stroke volume), HRR tailors the zones more accurately than simple %MaxHR.

### 3. Lactate Threshold Method (LTHR)

Based on Joe Friel's functional threshold heart rate framework, anchoring zones to the 1-hour time-trial threshold heart rate ($HR_{\text{lthr}}$):

| Zone | Label | Range (% of LTHR) | Description |
|:---|:---|:---|:---|
| **Z1** | Recovery | $< 85\%$ | Below aerobic threshold, active flushing |
| **Z2** | Aerobic | $85\% \sim 89\%$ | Extensive endurance base |
| **Z3** | Tempo | $90\% \sim 94\%$ | Intensive endurance, cruise intervals |
| **Z4** | Sub-Threshold | $95\% \sim 99\%$ | Lactate inflection boundary |
| **Z5** | Anaerobic | $\ge 100\%$ | Above anaerobic threshold, race finish sprint |

*Boundary Note: Zones are formatted with strictly non-overlapping integer bounds to prevent gap or overlap ambiguities.*

---

## Max Heart Rate Age Estimation Models

If laboratory or field-tested $HR_{\text{max}}$ is unavailable, three peer-reviewed age estimation formulas are provided:

- **Fox Formula**: $HR_{\text{max}} = 220 - \text{age}$ (Fox et al., 1971)
- **Tanaka Formula**: $HR_{\text{max}} = 208 - 0.7 \times \text{age}$ (Tanaka et al., 2001)
- **Gellish Formula**: $HR_{\text{max}} = 207 - 0.7 \times \text{age}$ (Gellish et al., 2007)

---

## API Reference

### `estimateMaxHR`

```typescript
function estimateMaxHR(
  age: number,
  formula?: 'fox' | 'tanaka' | 'gellish' // default: 'tanaka'
): number | null;
```

### `calculateHeartRateZones`

```typescript
function calculateHeartRateZones(
  params: HeartRateZonesParams,
  options?: CalculateHeartRateZonesOptions
): HeartRateZonesResult | null;
```

#### `HeartRateZonesParams` & `CalculateHeartRateZonesOptions`

```typescript
type HeartRateZonesParams =
  | { method: 'maxhr'; maxHR: number }
  | { method: 'karvonen'; maxHR: number; restingHR: number }
  | { method: 'lthr'; lthr: number };

interface CalculateHeartRateZonesOptions {
  locale?: string | DeepPartial<RunnerToolsLocale>;
  colors?: Partial<Record<HeartRateZoneKey, ZoneColorDefinition>>;
}
```

#### `HeartRateZonesResult`

```typescript
interface HeartRateZonesResult {
  method: 'maxhr' | 'karvonen' | 'lthr';
  zones: FormattedHeartRateZone[]; // Array of 5 zones
}

interface FormattedHeartRateZone {
  zone: 'z1' | 'z2' | 'z3' | 'z4' | 'z5';
  name: string;
  categoryName: string;
  description: string;
  low: number;
  high: number | null;
  bpmFormatted: string;
  pctFormatted: string;
  basisFormatted: string;
  color: ZoneColorDefinition;
}
```

---

## Operating Boundaries & Validation

- **Max HR**: 80 – 240 bpm.
- **Resting HR**: 30 – 120 bpm.
- **LTHR**: 80 – 220 bpm.
- **Constraint**: For the Karvonen method, `maxHR` must be strictly greater than `restingHR`. If invalid or out of range, functions return `null`.

---

## Code Example

```typescript
import {
  calculateHeartRateZones,
  estimateMaxHR,
} from '@slow-bloom/runner-tools';

// 1. Estimate Max HR for a 35-year-old using Tanaka formula
const maxHR = estimateMaxHR(35, 'tanaka'); // ~184 bpm

// 2. Compute Karvonen HRR Zones
const karvonenResult = calculateHeartRateZones({
  method: 'karvonen',
  maxHR: 184,
  restingHR: 52,
});

if (karvonenResult) {
  for (const z of karvonenResult.zones) {
    console.log(`${z.name} (${z.categoryName}): ${z.bpmFormatted}`);
  }
}

// 3. Compute LTHR Zones
const lthrResult = calculateHeartRateZones({
  method: 'lthr',
  lthr: 168,
});

if (lthrResult) {
  console.log('Zone 2 Range:', lthrResult.zones[1].bpmFormatted); // e.g. "143 - 149 bpm"
}
```

---

## Primary References

1. **Karvonen, M. J., Kentala, E., & Mustala, O.** (1957). "The effects of training on heart rate: a longitudinal study". *Annales Medicinae Experimentalis et Biologiae Fenniae*, 35(3), 307–315.
2. **Tanaka, H., Monahan, K. D., & Seals, D. R.** (2001). "Age-predicted maximal heart rate revisited". *Journal of the American College of Cardiology*, 37(1), 153–156.
3. **Gellish, R. L., et al.** (2007). "Longitudinal Modeling of the Relationship between Age and Maximal Heart Rate". *Medicine & Science in Sports & Exercise*, 39(5), 822–829.
4. **Friel, J.** (2009). *The Triathlete's Training Bible* (3rd ed.). VeloPress.
