import { accented, CadenceAudioError, cadenceSettings, scheduleClick } from './shared.js';
import type { CadenceSettings, ScheduledClick, SynthesisContext } from './shared.js';

export interface CadenceClock {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface CadenceBeat {
  step: number;
  time: number;
  accent: boolean;
}

export interface CadenceMetronomeOptions {
  createAudioContext(): SynthesisContext & Pick<AudioContext, 'resume' | 'state'>;
  clock: CadenceClock;
  settings?: Partial<CadenceSettings>;
  onBeat?(beat: CadenceBeat): void;
  onError(error: CadenceAudioError): void;
}

export interface CadenceMetronome {
  readonly state: 'stopped' | 'starting' | 'playing';
  configure(settings: Partial<CadenceSettings>): void;
  start(): Promise<boolean>;
  stop(): void;
}

/** Owns lookahead, pending nodes, and visual callbacks; stop also invalidates a pending resume. */
export function createCadenceMetronome(options: CadenceMetronomeOptions): CadenceMetronome {
  let settings = cadenceSettings(options.settings ?? {});
  let context: ReturnType<CadenceMetronomeOptions['createAudioContext']> | undefined;
  let state: CadenceMetronome['state'] = 'stopped';
  let generation = 0;
  let startRequest: Promise<boolean> | undefined;
  const timers = new Set<unknown>();
  const clicks = new Set<ScheduledClick>();

  function later(callback: () => void, delayMs: number) {
    const id = options.clock.setTimeout(() => { timers.delete(id); callback(); }, delayMs);
    timers.add(id);
  }

  function stop() {
    generation++;
    state = 'stopped';
    startRequest = undefined;
    for (const id of timers) options.clock.clearTimeout(id);
    timers.clear();
    for (const click of clicks) click.cancel();
    clicks.clear();
  }

  async function begin(token: number): Promise<boolean> {
    try {
      if (!context || context.state === 'closed') {
        try { context = options.createAudioContext(); }
        catch (cause) { throw new CadenceAudioError('audioUnavailable', { cause }); }
      }
      if (context.state !== 'running') {
        try { await context.resume(); }
        catch (cause) { throw new CadenceAudioError('audioResumeFailed', { cause }); }
      }
      if (token !== generation) return false;
      if (context.state !== 'running') throw new CadenceAudioError('audioResumeFailed');
      const audio = context;
      state = 'playing';
      let step = 0;
      let nextTime = audio.currentTime + 0.05;

      function schedule() {
        if (token !== generation) return;
        try {
          if (audio.state === 'closed') throw new CadenceAudioError('audioUnavailable');
          const interval = 60 / settings.spm;
          // Drop missed beats after throttling rather than playing a burst of old clicks.
          if (nextTime < audio.currentTime) {
            const missed = Math.ceil((audio.currentTime - nextTime) / interval);
            step += missed;
            nextTime += missed * interval;
          }
          while (nextTime < audio.currentTime + 0.1) {
            const beat = { step, time: nextTime, accent: accented(step, settings.accent) };
            clicks.add(scheduleClick(audio, nextTime, settings, beat.accent, click => clicks.delete(click)));
            later(() => {
              if (token === generation && audio.state === 'running' && audio.currentTime - beat.time < 0.1) options.onBeat?.(beat);
            }, Math.max(0, (nextTime - audio.currentTime) * 1000));
            nextTime += interval;
            step++;
          }
          later(schedule, 25);
        } catch (cause) {
          stop();
          options.onError(cause instanceof CadenceAudioError ? cause : new CadenceAudioError('audioUnavailable', { cause }));
        }
      }
      schedule();
      return state === 'playing';
    } catch (error) {
      if (token !== generation) return false;
      stop();
      throw error;
    }
  }

  return {
    get state() { return state; },
    configure(input) { settings = cadenceSettings({ ...settings, ...input }); },
    start() {
      if (state === 'playing') return Promise.resolve(true);
      if (state === 'starting' && startRequest) return startRequest;
      state = 'starting';
      startRequest = begin(++generation);
      return startRequest;
    },
    stop,
  };
}
