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

`StrengthWorkout` preserves the existing timed exercise fields:

```ts
{
  name, description, rounds, roundRest, prepTime,
  exercises: [{ id, name, work, rest, tip }]
}
```

An exercise may instead use `{ id, name, mode: 'reps', sets, reps, rest, tip }`.
Sets must be integers from 1–10 and reps from 1–200. Timed exercises can omit
`mode` or use `'timed'`. Each rep exercise completes its sets consecutively,
with `rest` seconds after every set, including the last; zero rest moves directly
on. Workout rounds repeat the entire exercise list, including every set.

`validateStrengthWorkout` returns an independent sanitized copy and never
coerces malformed input. `parseStrengthWorkout` accepts old saved workouts
without a version and version `1.0` or `1.1` exports. Timed-only workouts still
export as `1.0`; mixed/rep workouts export as `1.1` so older readers reject them
rather than silently treating reps as timed work. Unknown fields are discarded.
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

Self-paced work stages have `duration: 0`, a positive `reps` target, and `set` /
`totalSets` progress. They are manual barriers, not instant timed stages.
Statistics expose `selfPacedSets`; all duration totals are **timed subtotals**,
not predictions of how long rep-based training takes.

Localized preset functions return editable copies; modifying one result never
changes later presets. The glute routine includes separate left- and right-side
clamshells, with cues identifying the working leg. The original `clamshell`
catalog key remains available for existing callers. Presets are templates, not
personalized medical advice.

Core, glute/leg and ankle presets remain two-round circuits: each rep-based
movement uses **one set per round**, not multiple consecutive sets multiplied
by two rounds. Dead bugs and bird dogs default to 12 total reps, twists to 20
total, split squats to 10 per leg, bridges to 12 per leg, walking lunges to 16
total, clamshells to 15 per side, double-leg calf raises to 12, and single-leg
calf raises to 10 per leg. Alternating movements count each side as one rep
toward the total. Holds, balance, hops, Tabata and stretches remain timed.
The catalog supplies the same prescriptions for website quick-add controls.
Mixed routine names use round counts rather than a fixed-minute promise.
Saved/imported workouts are never migrated automatically; selecting or resetting
a preset picks up the new defaults.

## Timer state

`createStrengthTimer` is driven by an injected monotonic timestamp supplied to
`dispatch`. It does not count `setInterval` callbacks. A delayed browser frame
advances by real active elapsed time and can cross multiple stages without
drift. Paused time is excluded.

Actions are `start`, `tick`, `pause`, `resume`, `skip`, `back`, `reset`, and
`finishSet`. The latter only accepts running self-paced work and transitions to
the next stage, beginning rest automatically. A delayed tick never skips an
unconfirmed set. Self-paced stages accumulate actual elapsed time but do not
advance planned timed position; their `stageRemainingSeconds` is `null`.
`remainingSelfPacedSets` counts manual stages still ahead, including the current
one. Pausing excludes elapsed time in either mode.
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
