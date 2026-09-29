# Masters Age-Grading (`age-grading`)

Evaluates running performances across age and gender against the official **World Masters Athletics (WMA) 2020 Road Standards**.

---

## Overview & Mathematical Foundation

As athletes age, maximum oxygen uptake ($VO_2\text{max}$), muscle mass, and tendon elasticity decline. Age-grading allows runners of all ages and genders to compare performances against an absolute standard or against an open (prime) world record.

### 1. Age-Graded Score (%)

$$\text{Age-Graded Score (\%)} = \left(\frac{\text{WMA Age Standard Time}}{\text{Actual Finish Time}}\right) \times 100\%$$

A score of 100% indicates a performance equivalent to the theoretical world record for that exact age and gender.

### 2. Age-Graded Equivalent Time

Calculates what the performance would correspond to at the open (prime age, typically 25–30 years old) standard:

$$\text{Open Equivalent Time} = \text{Actual Finish Time} \times \left(\frac{\text{WMA Open Standard Time}}{\text{WMA Age Standard Time}}\right)$$

---

## Master Athlete Performance Tiers

| Score Range | Performance Tier | Description |
|:---|:---|:---|
| **$\ge 90\%$** | **World Class** | Competitive at World Championship masters level |
| **$80.0\% \sim 89.9\%$** | **National Class** | High-level national championship contender |
| **$70.0\% \sim 79.9\%$** | **Regional Class** | Strong regional podium contender / club runner |
| **$60.0\% \sim 69.9\%$** | **Local Class** | Well above average local road racer |
| **$50.0\% \sim 59.9\%$** | **Active Runner** | Dedicated, consistent recreational runner |
| **$< 50\%$** | **Recreational Runner** | Casual, novice, or fitness participant |

---

## API Reference

### `calculateAgeGrading`

```typescript
function calculateAgeGrading(
  params: AgeGradingParams,
  options?: CalculateAgeGradingOptions
): AgeGradingResult | null;
```

#### `AgeGradingParams` & `CalculateAgeGradingOptions`

```typescript
interface AgeGradingParams {
  gender: 'M' | 'F' | 'male' | 'female';
  age: number; // 5 to 100
  distance: 5000 | 10000 | 21097 | 42195 | '5k' | '10k' | 'halfMarathon' | 'marathon';
  timeSeconds: number;
}

interface CalculateAgeGradingOptions {
  locale?: string | DeepPartial<RunnerToolsLocale>;
}
```

#### `AgeGradingResult`

```typescript
interface AgeGradingResult {
  score: number;                         // e.g. 74.2
  scoreFormatted: string;                // "74.2%"
  level: FormattedAgeGradingLevel;       // { key, label, color, bgColor, minScore }
  ageEquivalentSeconds: number;          // Open equivalent time in seconds
  ageEquivalentTimeFormatted: string;    // e.g. "41:35"
  ageStandardSeconds: number;            // WMA standard for age
  ageStandardFormatted: string;          // Formatted age standard
  openStandardSeconds: number;           // WMA standard for open
  openStandardFormatted: string;         // Formatted open standard
  raw: RawAgeGradingResult;
}
```

### `calculateAgeGradingRaw`

Low-level pure calculation helper returning numeric scores and standards without localized string wrappers.

```typescript
function calculateAgeGradingRaw(params: AgeGradingParams): RawAgeGradingResult | null;
```

---

## Operating Boundaries

- **Age Domain**: $5 \le \text{age} \le 100$.
- **Standard Events Supported**: 5K (5,000 m), 10K (10,000 m), Half Marathon (21,097.5 m), Marathon (42,195 m).
- **Time**: Positive, non-zero finish times. If input parameters fall outside the WMA standard tables, functions return `null`.

---

## Code Example

```typescript
import { calculateAgeGrading } from '@slow-bloom/runner-tools';

// 45-year-old female running a 44:30 10K
const result = calculateAgeGrading(
  {
    gender: 'F',
    age: 45,
    distance: 10000,
    timeSeconds: 2670, // 44m 30s
  },
  { locale: 'en' }
);

if (result) {
  console.log(`Age-Graded Score: ${result.scoreFormatted}`); // ~75.4%
  console.log(`Tier: ${result.level.label}`);               // "Regional Class"
  console.log(`Open Prime Equivalent: ${result.ageEquivalentTimeFormatted}`);
}
```

---

## Primary References

1. **World Masters Athletics (WMA)**. (2020). *Age-Grading Tables for Road Running Events*.
2. **Alan Jones**. (2020). *Age-Grading Calculation Engine Documentation*. Runners World / USATF.
