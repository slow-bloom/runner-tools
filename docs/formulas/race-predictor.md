# Peter Riegel Race Predictor (`race-predictor`)

Predicts race finish times and target paces across arbitrary distances using Peter Riegel's endurance power law formula.

---

## Mathematical Foundation

In 1977, research engineer and marathoner Peter S. Riegel analyzed world, national, and age-group running records to formulate a mathematical model describing the relationship between distance and athletic performance:

$$T_2 = T_1 \times \left(\frac{D_2}{D_1}\right)^b$$

Where:
- $T_1$: Time recorded for base performance
- $D_1$: Distance of base performance
- $D_2$: Distance of target race
- $T_2$: Predicted time for target race
- $b$: Fatigue factor exponent

### The Fatigue Factor ($b$)

The exponent $b$ reflects an athlete's aerobic endurance retention as distance increases:

| Exponent $b$ | Runner Profile | Typical Weekly Mileage | Description |
|:---|:---|:---|:---|
| **1.06** | Well-Trained / Elite | 70+ km / 45+ mi | Standard Riegel constant; assumes exceptional aerobic base and fuel economy |
| **1.08** | Recreational / Regular | 35–65 km / 20–40 mi | Realistic fatigue drop-off for consistent amateur distance runners |
| **1.10** | Novice / Lower Mileage | < 30 km / < 20 mi | Noticeable aerobic decay over longer events (half and full marathon) |

---

## API Reference

### `predictRaceTime`

Calculates a pure predicted duration in seconds for a specific target distance.

```typescript
function predictRaceTime(
  baseDistanceMeters: number,
  baseTimeSeconds: number,
  targetDistanceMeters: number,
  exponent?: number // default: 1.06
): number | null;
```

- **Returns**: Predicted time in seconds, or `null` if any input is invalid or non-positive.

### `calculateRacePredictions`

Generates predictions across standard race distances (5K, 10K, Half Marathon, Marathon) with pace and split projections.

```typescript
function calculateRacePredictions(
  params: RacePredictorParams
): RacePredictorResult | null;
```

#### `RacePredictorParams`

```typescript
interface RacePredictorParams {
  baseDistanceMeters: number;
  baseTimeSeconds: number;
  exponent?: number;  // 1.00 to 1.30 (default: 1.06)
  unit?: 'km' | 'mi'; // default: 'km'
  lang?: string;      // default: 'en'
}
```

#### `RacePredictorResult`

```typescript
interface RacePredictorResult {
  baseDistanceMeters: number;
  baseTimeSeconds: number;
  exponent: number;
  predictions: RacePredictionItem[];
}
```

---

## Assumptions & Limitations

1. **Specific Preparation Assumption**: Riegel's formula presumes the runner has completed distance-appropriate training for the target event. A 20:00 5K runner who runs only 15 km/week cannot achieve a 3:10 marathon simply because the formula computes it.
2. **Fuel and Heat Limitations**: In events longer than 25 km, carbohydrate depletion and thermoregulation play a significant role not fully modeled by a single power exponent.
3. **Valid Exponent Range**: Enforced strictly between `1.00` and `1.30`. Out-of-range values return `null`.

---

## Code Example

```typescript
import { calculateRacePredictions, predictRaceTime } from '@slow-bloom/runner-tools';

// 1. Predict a single distance
const marathonTimeSecs = predictRaceTime(10000, 2700, 42195, 1.06);
console.log(`Marathon seconds: ${marathonTimeSecs}`); // ~12421s (3:27:01)

// 2. Multi-distance prediction table
const result = calculateRacePredictions({
  baseDistanceMeters: 10000,
  baseTimeSeconds: 2700, // 45:00 10K
  exponent: 1.08,        // Recreational runner profile
  unit: 'km',
  lang: 'en',
});

if (result) {
  for (const item of result.predictions) {
    console.log(`${item.distanceLabel}: ${item.timeFormatted} (${item.paceFormatted} /km)`);
  }
}
```

---

## Primary References

1. **Riegel, P. S.** (1977). "Athletic Records and Human Endurance". *American Scientist*, 65(3), 285–290.
2. **Riegel, P. S.** (1981). "Athletic Records and Human Endurance". *Runner's World*, May 1981.
