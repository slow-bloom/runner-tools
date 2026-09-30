# Race-week Plan and Calendar

`createRaceWeekPlan` extracts the websites' race-week template into a pure
localized module. It covers 5 km, 10 km, half marathon and marathon schedules,
Saturday/Sunday races, morning countdowns, pacing suggestions, fueling text and
calendar export. This is an illustrative planning template, **not** a personalized
training, nutrition or medical prescription.

```ts
import { createRaceWeekPlan, createRaceWeekCalendar } from '@slow-bloom/runner-tools';

const plan = createRaceWeekPlan({
  distanceKm: 21.0975,
  raceDay: 'sun',
  weeklyDistance: 50,
  frequency: 5,
  goalTimeSeconds: 6600,
  gunTime: '07:30',
  unit: 'km',
  locale: 'en',
});
if (plan) {
  console.log(plan.schedule, plan.timeline, plan.phases);
  const calendar = createRaceWeekCalendar(plan, { now: new Date() });
}
```

## Contract

Weekly distance must be 1–500 in the chosen unit, frequency an integer from 2
through 7, and start time a valid 24-hour `HH:mm`. The goal pace must be within
the shared pace converter's domain. Invalid parameters return `null`, matching
the existing formula modules; the website displays an input error rather than
silently using another formula.

All distance and pace calculations use kilometers internally. Miles change only
the display and input conversion; the same physical inputs produce the same
physical schedule. Early/late pacing offsets are seconds per kilometer, converted
together with the target pace.

The template starts from the former recovery/easy/tune-up/shakeout schedule.
Optional sessions are removed for lower-frequency runners. Pre-race volume
does not exceed 45% of baseline for half/full marathons or 55% for shorter races.
Fixed session minima are scaled down when they would increase a low-volume
runner's load. The volume badge describes the actual generated pre-race schedule,
excluding the race, instead of displaying an unrelated target percentage.

The schedule is a starting point: no promise of recovery, injury prevention,
or race outcome is made. English and Chinese dictionaries are part of the
shared locale registry. Only the existing English website has a race-week page;
this migration does not create an otherwise missing Chinese page.

## Calendar

`createRaceWeekCalendar(plan, { now })` creates four events: race, breakfast,
pre-race shakeout and the tune-up. It selects the **next** requested weekday;
when invoked on that weekday it selects the following week, preserving the
previous website behavior.

Local date arithmetic retains the selected local clock across daylight-saving
changes. The race event lasts the entered goal time, not a hardcoded three hours.
The output includes deterministic UIDs, DTSTAMP, escaped text, CRLF separators
and UTF-8-aware 75-octet line folding. An invalid `now` throws `RangeError`.

Compared with the original template, countdown times also handle midnight and
afternoon starts explicitly rather than appending “AM” to every time.
