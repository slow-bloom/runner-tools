# Cadence metronome and audio export

`@slow-bloom/runner-tools` owns cadence estimation, tap measurement, Web Audio
synthesis, lookahead scheduling, cancellation, offline rendering, PCM conversion,
and MP3 encoder orchestration. Importing the module reads no browser globals and
loads no runtime dependencies.

## Live playback

```ts
import { createCadenceMetronome, createTapTempo } from '@slow-bloom/runner-tools';

const metronome = createCadenceMetronome({
  createAudioContext: () => new AudioContext(),
  clock: {
    setTimeout: (callback, delay) => window.setTimeout(callback, delay),
    clearTimeout: handle => window.clearTimeout(handle as number),
  },
  settings: { spm: 180, sound: 'wood', accent: '2:4' },
  onBeat: beat => animateBeat(beat.accent),
  onError: error => showError(error.code),
});
await metronome.start(); // Call from a user gesture; resume failures reject.
metronome.configure({ spm: 175 }); // Does not start playback.
metronome.stop(); // Cancels scheduled nodes, visual callbacks, and pending starts.

const taps = createTapTempo();
const spm = taps.tap(performance.now()); // null until a valid measurement exists
```

The interface accepts integer cadence from 120 to 210 spm. Sounds are `wood`,
`beep`, `snap`, and `kick`; patterns are `1:1` (equal beats), `2:4` (accent on
steps 0, 2, ...), and `4:4` (0, 4, ...). `profile: 'standard' | 'warm'`
preserves the original English and Chinese demo envelopes respectively; it is
independent of display language. Settings take effect on the next unscheduled
beat (up to 100 ms ahead).

Playback uses the audio clock, a 25 ms scheduler, and 100 ms lookahead. Delayed
ticks skip missed beats instead of producing a backlog. Stopping disconnects
every scheduled source, even sounds in the lookahead window. Concurrent starts
share one resume request. A stopped request cannot start after its promise
settles. `onError` handles later scheduler failures; the `start()` promise
reports activation failures. The injected context is caller-owned and is not
closed by `stop()`.

Tap measurement averages up to six increasing timestamps and resets after a gap
over 2.5 seconds. Detection outside 100–230 spm is ignored; detected values are
clamped to the player range. Tapping itself never opens or resumes audio.

## Cadence estimate

`calculateCadenceTarget({ paceMinutes, paceSeconds, height, paceUnit?, heightUnit? })`
accepts 3:00–15:59 per km or mile, height 120–230 cm (or equivalent inches).
Minutes and seconds must be integers; seconds equal to zero are preserved.
Defaults are `km` and `cm`; invalid data throws instead of silently substituting
5:30 or 175 cm.

The existing heuristic is retained: rounded `162 + speedInMetersPerSecond * 4.5
- (heightInMeters - 1.75) * 12`, bounded to 150–205 spm. The result includes
`targetSPM`, single-step length in meters and feet, and `frequencyHz`. This is a
practice starting point, not a validated individual optimum, a diagnosis, or an
injury-prevention prescription. The displayed length is one step, not a
two-step stride cycle.

## Offline export

```ts
import { renderCadenceAudio } from '@slow-bloom/runner-tools';

const result = await renderCadenceAudio({
  spm: 180, sound: 'wood', accent: '4:4',
  durationSeconds: 300, quality: 'wav-16k',
}, {
  createOfflineContext: (channels, frames, rate) =>
    new OfflineAudioContext(channels, frames, rate),
  yieldControl: () => new Promise(resolve => window.setTimeout(resolve, 0)),
  signal: abortController.signal,
  // Optional: createMp3Encoder: (rate, bitrate) => new lamejs.Mp3Encoder(1, rate, bitrate),
});
const blob = new Blob([result.data], { type: result.mimeType });
```

Qualities: `wav-16k`, `wav-44k`, `mp3-64`, `mp3-128`. Durations are integral
1–900 seconds; the demo offers 60, 300, 600, and 900. MP3 requires a caller-supplied
`MonoMp3Encoder` (`encodeBuffer(Int16Array)`, `flush()`); absence fails **before**
allocating an offline context. Each call snapshots settings and owns a separate
encoder, without touching live playback. The result carries those settings for
accurate filenames if UI inputs change during export.

Graph construction yields every 64 beats. WAV conversion yields every 32,768
samples, MP3 encoding every 16 blocks of at most 1,152 samples. Supply a real task
yield, not merely `Promise.resolve()`, to keep the browser responsive. MP3 chunks
are copied because encoders may reuse output buffers. Offline Web Audio renders
outside the synchronous JavaScript loop, but still allocates the full mono buffer
(about 159 MB for 15 minutes at 44.1 kHz). Mobile memory limits still apply.
Abort is checked at each yield and after offline rendering; Web Audio cannot
forcibly abort an already-running `startRendering()` call.

`serializeMonoWav(samples, sampleRate, control, bitDepth?)` separately supports
8-bit unsigned and 16-bit signed mono PCM. It clips finite samples to [-1, 1],
replaces non-finite samples with silence, and validates allocation limits.

`CadenceAudioError.code` selects a user-safe message from
`cadenceAudioMessages.en.errors` or `.zh.errors`. Browser permission and codec
exceptions are retained as `cause`, not exposed as untranslated UI copy.

Official demos retain their DOM controls/visuals and optional lamejs CDN adapter.
They load the local content-hashed `RunnerTools` bundle, prevent overlapping
exports, and cancel on `pagehide`. No website-local synthesis or encoding
fallback remains.
