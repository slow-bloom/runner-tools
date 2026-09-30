import { StrengthTimerError } from './workout.js';
import type { StrengthCue } from './strength-timer.js';

export interface StrengthCuePlayerOptions {
  createAudioContext(): Pick<AudioContext, 'currentTime' | 'state' | 'resume' | 'destination' | 'createOscillator' | 'createGain'>;
  /** Optional host speech adapter. New stage announcements replace, rather than queue behind, old ones. */
  speech?: { speak(text: string): void; cancel(): void };
  onError(error: StrengthTimerError): void;
}

/** Owns tones and optional voice cancellation; it never controls the timer's clock or status. */
export function createStrengthCuePlayer(options: StrengthCuePlayerOptions) {
  let context: ReturnType<StrengthCuePlayerOptions['createAudioContext']> | undefined;
  let enabled = false;
  let generation = 0;
  let pending: Promise<boolean> | undefined;
  const nodes = new Set<{ stop(): void }>();

  function cancel() {
    for (const node of nodes) node.stop();
    nodes.clear();
    try { options.speech?.cancel(); }
    catch (cause) { options.onError(new StrengthTimerError('cueFailed', '', { cause })); }
  }

  function disable() {
    generation++;
    enabled = false;
    pending = undefined;
    cancel();
  }

  function tone(frequency: number, type: OscillatorType, duration: number, volume: number, delay = 0) {
    const audio = context!;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const time = audio.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    const cleanup = () => {
      oscillator.disconnect();
      gain.disconnect();
      nodes.delete(handle);
    };
    const handle = { stop() {
      oscillator.onended = null;
      gain.gain.cancelScheduledValues(0);
      gain.gain.setValueAtTime(0, audio.currentTime);
      oscillator.stop(audio.currentTime);
      cleanup();
    } };
    oscillator.onended = cleanup;
    oscillator.start(time);
    oscillator.stop(time + duration);
    nodes.add(handle);
  }

  return {
    get enabled() { return enabled; },
    enable(): Promise<boolean> {
      if (enabled && context?.state === 'running') return Promise.resolve(true);
      if (pending) return pending;
      const token = ++generation;
      const request = (async () => {
        try {
          if (!context || context.state === 'closed') {
            try { context = options.createAudioContext(); }
            catch (cause) { throw new StrengthTimerError('audioUnavailable', '', { cause }); }
          }
          if (context.state !== 'running') {
            try { await context.resume(); }
            catch (cause) { throw new StrengthTimerError('audioResumeFailed', '', { cause }); }
          }
          if (token !== generation) return false;
          if (context.state !== 'running') throw new StrengthTimerError('audioResumeFailed');
          enabled = true;
          return true;
        } catch (error) {
          if (token !== generation) return false;
          enabled = false;
          throw error;
        }
      })();
      pending = request;
      const settled = () => { if (pending === request) pending = undefined; };
      request.then(settled, settled);
      return request;
    },
    cancel,
    disable,
    play(cues: readonly StrengthCue[]) {
      if (!enabled || !cues.length) return;
      const cue = cues[cues.length - 1];
      cancel();
      try {
        if (context!.state !== 'running') throw new StrengthTimerError('audioResumeFailed');
        if (cue.type === 'countdown') tone(520, 'sine', 0.12, 0.25);
        else {
          options.speech?.speak(cue.stage.name);
          if (cue.type === 'complete') {
            [523.25, 659.25, 783.99, 1046.50].forEach((frequency, index) => tone(frequency, 'triangle', 0.3, 0.35, index * 0.14));
          } else if (cue.type === 'navigate') tone(660, 'sine', 0.1, 0.2);
          else if (cue.stage.type !== 'prep') tone(880, 'sine', 0.2, 0.4);
        }
      } catch (cause) {
        cancel();
        options.onError(cause instanceof StrengthTimerError ? cause : new StrengthTimerError('cueFailed', '', { cause }));
      }
    },
  };
}
