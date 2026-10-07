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
optional round rest, and a zero-duration completion stage. Every preset now
defaults its final exercise's rest to zero, so the last movement leads directly
into round recovery or completion. Explicit rest values in custom and imported
workouts are preserved, including a nonzero final rest. `getStrengthWorkoutStats`
derives every displayed total from the same timeline.

Localized preset functions return editable copies; modifying one result never
changes later presets. The glute routine includes separate left- and right-side
clamshells, with cues identifying the working leg. The original `clamshell`
catalog key remains available for existing callers. Presets are templates, not
personalized medical advice.

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

An interrupted or failed cue disables playback until the next explicit
`enable()` call, rather than reporting the same failure at every countdown.

The website adapter uses `requestAnimationFrame` and starts visual timing without
waiting for audio activation. A labeled sound-test button resumes audio from a
user gesture and plays a short tone. A blocked or stalled activation leaves a
persistent retry control and phone-specific help. Web Audio does not have a
standard permission-request dialog; iPhone Silent Mode, media volume, and output
device settings must be changed by the user. Storage, import, export, wake-lock,
fullscreen and cue failures remain visible.
