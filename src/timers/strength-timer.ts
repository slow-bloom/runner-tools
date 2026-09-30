import { buildStrengthTimeline } from './timeline.js';
import type { StrengthStage } from './timeline.js';
import type { StrengthLocale } from './messages.js';
import { StrengthTimerError } from './workout.js';

export type StrengthTimerAction = 'start' | 'tick' | 'pause' | 'resume' | 'skip' | 'back' | 'reset';
export type StrengthTimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface StrengthTimerSnapshot {
  readonly status: StrengthTimerStatus;
  readonly stage: StrengthStage;
  readonly stageIndex: number;
  /** Rounded up for countdown display. */
  readonly stageRemainingSeconds: number;
  readonly stageElapsedSeconds: number;
  /** Actual active time, excluding pauses; navigation never fabricates elapsed training. */
  readonly elapsedSeconds: number;
  /** Position on the planned timeline; can move forwards/backwards on navigation. */
  readonly positionSeconds: number;
  readonly remainingSeconds: number;
  readonly totalSeconds: number;
}

export type StrengthCue =
  | { readonly type: 'countdown'; readonly seconds: number }
  | { readonly type: 'stage' | 'navigate' | 'complete'; readonly stage: StrengthStage };

export interface StrengthTimerUpdate {
  readonly snapshot: StrengthTimerSnapshot;
  readonly cues: readonly StrengthCue[];
}

export interface StrengthTimer {
  readonly timeline: readonly StrengthStage[];
  readonly snapshot: StrengthTimerSnapshot;
  dispatch(action: StrengthTimerAction, nowMs: number): StrengthTimerUpdate;
}

/** A monotonic elapsed-time model. The caller controls when to observe it; no interval ticks are counted. */
export function createStrengthTimer(workout: unknown, locale: StrengthLocale = 'en'): StrengthTimer {
  const timeline = buildStrengthTimeline(workout, locale);
  const totalMs = timeline[timeline.length - 1].startSeconds * 1000;
  let status: StrengthTimerStatus = 'idle';
  let index = 0;
  let positionMs = 0;
  let elapsedMs = 0;
  let lastTime: number | undefined;

  function snapshot(): StrengthTimerSnapshot {
    const stage = timeline[index];
    return Object.freeze({
      status, stage, stageIndex: index,
      stageRemainingSeconds: Math.ceil((stage.endSeconds * 1000 - positionMs) / 1000),
      stageElapsedSeconds: (positionMs - stage.startSeconds * 1000) / 1000,
      elapsedSeconds: elapsedMs / 1000, positionSeconds: positionMs / 1000,
      remainingSeconds: Math.ceil((totalMs - positionMs) / 1000), totalSeconds: totalMs / 1000,
    });
  }

  function advance(nowMs: number) {
    if (status === 'running') {
      const delta = Math.min(nowMs - lastTime!, totalMs - positionMs);
      elapsedMs += delta;
      positionMs += delta;
      while (index < timeline.length - 1 && positionMs >= timeline[index].endSeconds * 1000) index++;
      if (index === timeline.length - 1) status = 'completed';
    }
    lastTime = nowMs;
  }

  return {
    timeline,
    get snapshot() { return snapshot(); },
    dispatch(action, nowMs) {
      if (!['start', 'tick', 'pause', 'resume', 'skip', 'back', 'reset'].includes(action)) throw new StrengthTimerError('invalidAction');
      if (!Number.isFinite(nowMs) || nowMs < 0 || (lastTime !== undefined && nowMs < lastTime)) {
        throw new StrengthTimerError('invalidClock');
      }
      const previous = snapshot();
      advance(nowMs);
      const cues: StrengthCue[] = [];
      if (action === 'start' || action === 'reset') {
        index = 0;
        positionMs = 0;
        elapsedMs = 0;
        status = action === 'start' ? 'running' : 'idle';
        if (action === 'start') cues.push({ type: 'stage', stage: timeline[0] });
      } else if (action === 'pause') {
        if (status === 'running') status = 'paused';
      } else if (action === 'resume') {
        if (status === 'paused') status = 'running';
      } else if (action === 'skip' || action === 'back') {
        const target = index + (action === 'skip' ? 1 : -1);
        if (target >= 0 && target < timeline.length) {
          index = target;
          positionMs = timeline[index].startSeconds * 1000;
          status = index === timeline.length - 1 ? 'completed' : status === 'running' ? 'running' : 'paused';
          cues.push({ type: status === 'completed' ? 'complete' : 'navigate', stage: timeline[index] });
        }
      } else if (previous.status === 'running') {
        const current = snapshot();
        if (status === 'completed') cues.push({ type: 'complete', stage: current.stage });
        else if (previous.stageIndex !== index) cues.push({ type: 'stage', stage: current.stage });
        else if (current.stageRemainingSeconds <= 3 && current.stageRemainingSeconds !== previous.stageRemainingSeconds) {
          cues.push({ type: 'countdown', seconds: current.stageRemainingSeconds });
        }
      }
      return { snapshot: snapshot(), cues: Object.freeze(cues) };
    },
  };
}
