# Race predictor

The generic API retains Riegel predictions. The website explicitly opts into a
weekly-mileage model for the marathon only. All distances and weekly volume passed
to the API are in **metres**, times in **seconds**.

## Generic API (unchanged)

`predictRaceTime(baseDistanceMeters, baseTimeSeconds, targetDistanceMeters, exponent = 1.06)`
returns `T1 * (D2 / D1) ** exponent`, or `null` for invalid inputs or an invalid
output. Distances and time must be finite and positive; the exponent must be finite,
greater than zero and at most 3. This is a numerical guard, not a physiological
recommendation or a personal calibration.

`calculateRacePredictions(options)` returns formatted times and paces for 5K, 10K,
half marathon and marathon by default. It accepts custom `targetDistances`,
`exponent`, display `unit` (`km` or `mi`) and `lang`. Invalid targets are skipped.
Invalid baselines or no calculable targets return `null`.

Without `marathonModel`, the existing calculation and result shape are unchanged,
including custom exponents and arbitrary target distances. Supplying mileage alone
does not opt in.

## Opt-in marathon model

```typescript
import { calculateRacePredictions, predictMarathonTime } from '@slow-bloom/runner-tools';

const result = calculateRacePredictions({
  baseDistanceMeters: 21097.5,
  baseTimeSeconds: 6000, // Full elapsed time, including pauses.
  marathonModel: 'weekly-mileage',
  weeklyDistanceMeters: 50000, // Six-week total / 6, not the most recent week.
  unit: 'km',
  lang: 'en',
});

// Independently usable, with an explicit status and nullable seconds:
const marathon = predictMarathonTime(21097.5, 6000, 50000);
// { status: 'predicted', seconds: approximately 13426.866554621 }
```

Only targets of **exactly 42195 metres** use the new model; a target's label or
key does not select it. All other targets retain the caller's Riegel exponent
(default 1.06). The returned `exponent` still describes those Riegel targets,
not the marathon model.

### Source-distance policy

Match a source within 2% of 5000, 8046.72, 10000, 16093.44, 21097.5 or 42195 metres
to that standard distance. This GPS tolerance is an app policy, not a fitted
scientific coefficient. Other distances from 5000 to below 42195 metres use the
actual distance. Distances below the eligibility threshold and unsupported ultras
cannot supply a marathon prediction.

A marathon-matched source returns its elapsed time directly, without requiring or
validating mileage. It is an observed result, not a projection.

### Calculation for eligible shorter sources

```text
projected_seconds = elapsed_seconds * (42195 / source_metres) ** 1.07
projected_speed   = 42195 / projected_seconds
weekly_miles      = weekly_metres / 1609.344
marathon_speed    = 0.16018617
                 + 0.83076202 * projected_speed
                 + 0.06423826 * (weekly_miles / 10)
marathon_seconds  = 42195 / marathon_speed
```

Inputs, intermediates and output must be finite and valid. In particular, an
overflowing `projected_seconds` is rejected before taking its reciprocal.
Mileage must be nonnegative; an omitted or `null` value is **missing**, not zero.
An explicitly supplied numeric zero is accepted.

`predictMarathonTime` returns `{ status, seconds }`. Successful statuses are
`predicted` and `direct`; failure statuses are `invalid-input`,
`unsupported-distance`, `missing-mileage` and `invalid-mileage`, with `seconds: null`.
The opted-in table result includes `marathonStatus` and omits an unavailable
marathon row while retaining other calculable predictions. If no target is
calculable it still returns `null`; callers needing a marathon-only reason can use
`predictMarathonTime`.

### Reference vectors

| Source | Elapsed seconds | Weekly metres | Marathon seconds |
|---|---:|---:|---:|
| Half marathon | 6000 | 35000 | 13687.649202307 |
| Half marathon | 6000 | 50000 | 13426.866554621 |
| Half marathon | 6000 | 65000 | 13175.835195118 |
| 22000 metres | 7200 | 50000 | 15150.372161576 |

## Interpretation and website/app boundary

Vickers & Vertosick studied **race results** from recreational runners. Accepting
ordinary training runs is our adaptation, not independently validated accuracy.
An easy run need not represent race capacity; weather, hills, fuelling and
distance-specific preparation remain outside this calculation.

The website receives one manually entered performance and a runner-provided
six-week weekly average. It neither scans history nor filters recovery runs,
intervals or outliers, and does not fit an exact personal fatigue exponent.
The app's automatic source selection and 42-day mileage aggregation are separate
from this library. A one-performance calculator has no history-based evidence dots.

## References

- Riegel, P. S. (1981). Athletic Records and Human Endurance. *American Scientist*,
  69(3), 285–290.
- Vickers & Vertosick (2016). [An empirical study of race times in recreational
  endurance runners](https://pmc.ncbi.nlm.nih.gov/articles/PMC5000509/).
  DOI: 10.1186/s13102-016-0052-y.
