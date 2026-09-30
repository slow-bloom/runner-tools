# Strength workout timer

The strength-timer module owns the existing workout JSON schema, localized
presets, strict validation, exact timeline generation, elapsed-time state
machine and optional cue player. DOM rendering, local storage, file downloads,
wake lock and fullscreen remain website adapters.

```ts
import {
  createStrengthTimer,
  getStrengthWorkoutPresets,
  stringifyStrengthWorkout,
} from '@slow-bloom/runner-tools';

const workout = getStrengthWorkoutPresets('zh').core;
const timer = createStrengthTimer(workout, 'zh');
timer.dispatch('start', performance.now());

function frame(now: number) {
  const { snapshot, cues } = timer.dispatch('tick', now);
  render(snapshot);
  play(cues);
  if (snapshot.status === 'running') requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

## Workout format and validation

`StrengthWorkout` preserves the existing fields:

```ts
{
  name, description, rounds, roundRest, prepTime,
  exercises: [{ id, name, work, rest, tip }]
}
```

`validateStrengthWorkout` returns an independent sanitized copy and never
coerces malformed input. `parseStrengthWorkout` accepts old saved workouts
without a version and version `1.0` exports. Unknown fields are discarded.
Imports are limited to 1 MiB and 100 exercises; names, tips, rounds and integer
durations use the documented `strengthWorkoutLimits`.

`stringifyStrengthWorkout` requires caller-supplied source and ISO export time,
so tests and callers control nondeterminism. Errors are `StrengthTimerError`
instances with codes translated by `strengthTimerMessages.en` and `.zh`.

## Timeline and totals

`buildStrengthTimeline` emits preparation, work, optional exercise rest,
optional round rest, and a zero-duration completion stage. It intentionally
retains the former website behavior: a final exercise's configured rest still
occurs before round rest or completion. Set that exercise's rest to zero to omit
it. `getStrengthWorkoutStats` derives every displayed total from the same
timeline, eliminating separate website arithmetic.

Localized preset functions return editable copies; modifying one result never
changes later presets. They are templates, not personalized medical advice.

## Timer state

`createStrengthTimer` is driven by an injected monotonic timestamp supplied to
`dispatch`. It does not count `setInterval` callbacks. A delayed browser frame
advances by real active elapsed time and can cross multiple stages without
drift. Paused time is excluded.

Actions are `start`, `tick`, `pause`, `resume`, `skip`, `back`, and `reset`.
Navigation changes planned position but does not fabricate elapsed training
time. Snapshots distinguish active elapsed time, planned position, stage
elapsed/remaining, workout remaining, and total duration. Countdown and
transition cues are returned as data; the state module never plays audio.

Invalid or backwards clocks throw `invalidClock`. The caller should stop its
animation frame, present the localized error, and reset the visual timer.

## Optional cue player

`createStrengthCuePlayer` accepts a Web Audio context factory and optional
speech adapter. It must be explicitly enabled from a user gesture. Visual timing
continues if audio is unavailable or blocked. New cues cancel scheduled tones
and speech before playing, and disabling cancels all pending audio.

The website adapter uses `requestAnimationFrame`, retains wake-lock/fullscreen
controls, and disables audio when permission fails. Storage, import, export,
wake-lock, fullscreen and cue failures are visible instead of silently ignored.
