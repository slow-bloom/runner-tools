import { describe, expect, it, vi } from 'vitest';
import {
  buildStrengthTimeline, createStrengthCuePlayer, createStrengthTimer,
  getStrengthExerciseCatalog, getStrengthWorkoutPresets, getStrengthWorkoutStats,
  parseStrengthWorkout, stringifyStrengthWorkout, validateStrengthWorkout,
  StrengthTimerError, strengthWorkoutLimits,
} from './index.js';
import type { StrengthWorkout } from './workout.js';

const workout: StrengthWorkout = {
  name: 'Test workout', description: 'Exact timeline', rounds: 2, roundRest: 3, prepTime: 3,
  exercises: [
    { id: 'a', name: 'First', work: 5, rest: 2, tip: 'One' },
    { id: 'b', name: 'Second', work: 6, rest: 0, tip: 'Two' },
  ],
};

describe('strength workout validation and serialization', () => {
  it.each(['en', 'zh'] as const)('includes both clamshell sides in the %s catalog and glute preset', locale => {
    const catalog = getStrengthExerciseCatalog(locale);
    expect(catalog.clamshell_left).toMatchObject({ work: 35, rest: 15 });
    expect(catalog.clamshell_right).toMatchObject({ work: 35, rest: 15 });
    expect(catalog.clamshell_left.name).not.toBe(catalog.clamshell_right.name);
    const exercises = getStrengthWorkoutPresets(locale).glute_legs.exercises;
    expect(exercises.slice(-2).map(exercise => exercise.name)).toEqual([
      catalog.clamshell_left.name, catalog.clamshell_right.name,
    ]);
  });

  it.each(['en', 'zh'] as const)('defaults the last exercise rest to zero in every %s preset', locale => {
    for (const preset of Object.values(getStrengthWorkoutPresets(locale))) {
      expect(preset.exercises.at(-1)?.rest).toBe(0);
      const timeline = buildStrengthTimeline(preset, locale);
      for (const [index, stage] of timeline.entries()) {
        if (stage.type === 'work' && stage.exerciseIndex === preset.exercises.length) {
          expect(timeline[index + 1].type).toBe(stage.round < preset.rounds ? 'round_rest' : 'done');
        }
      }
    }
  });

  it('validates every localized preset and returns independent editable copies', () => {
    for (const locale of ['en', 'zh'] as const) {
      const presets = getStrengthWorkoutPresets(locale);
      expect(Object.keys(presets)).toEqual(['core', 'glute_legs', 'ankle_foot', 'tabata', 'stretch']);
      for (const value of Object.values(presets)) expect(validateStrengthWorkout(value)).toEqual(value);
      presets.core.name = 'Changed';
      presets.core.exercises[0].name = 'Changed exercise';
      expect(getStrengthWorkoutPresets(locale).core.name).not.toBe('Changed');
      expect(getStrengthWorkoutPresets(locale).core.exercises[0].name).not.toBe('Changed exercise');
      const catalog = getStrengthExerciseCatalog(locale);
      catalog.plank.name = 'Changed';
      expect(getStrengthExerciseCatalog(locale).plank.name).not.toBe('Changed');
    }
  });

  it('round-trips the existing version 1.0 schema and strips unknown fields', () => {
    const source = structuredClone(workout) as StrengthWorkout & { unknown?: string };
    source.unknown = 'drop me';
    source.exercises[0] = { ...source.exercises[0], extra: 'drop me' } as typeof source.exercises[0];
    const json = stringifyStrengthWorkout(source, {
      source: 'Apex Run', exportTime: '2026-09-30T00:00:00.000Z',
    });
    expect(JSON.parse(json)).toMatchObject({
      version: '1.0', source: 'Apex Run', exportTime: '2026-09-30T00:00:00.000Z',
      name: workout.name,
    });
    expect(json).not.toContain('unknown');
    expect(json).not.toContain('extra');
    const parsed = parseStrengthWorkout(json);
    expect(parsed).toEqual({
      ...workout,
      exercises: workout.exercises.map(({ id: _id, ...exercise }, index) => ({
        id: `exercise-${index + 1}`, ...exercise,
      })),
    });
    expect(parsed).not.toBe(workout);
    expect(parseStrengthWorkout(JSON.stringify(workout))).toEqual(workout);
  });

  it.each([
    ['{}', 'invalidExercise'],
    ['{"version":"2.0","name":"x","rounds":1,"roundRest":0,"prepTime":3,"exercises":[{"name":"x","work":5,"rest":0}]}', 'unsupportedVersion'],
    ['{"name":"x","rounds":0,"roundRest":0,"prepTime":3,"exercises":[{"name":"x","work":5,"rest":0}]}', 'invalidRounds'],
    ['{"name":"x","rounds":1,"roundRest":0,"prepTime":2,"exercises":[{"name":"x","work":5,"rest":0}]}', 'invalidDuration'],
    ['{"name":"x","rounds":1,"roundRest":0,"prepTime":3,"exercises":[{"name":"x","work":4,"rest":0}]}', 'invalidDuration'],
    ['{"name":"x","rounds":1,"roundRest":0,"prepTime":3,"exercises":[{"name":"","work":5,"rest":0}]}', 'invalidWorkout'],
    ['not json', 'invalidJson'],
  ])('rejects malformed imports without coercion: %s', (json, code) => {
    expect(() => parseStrengthWorkout(json)).toThrow(expect.objectContaining({ code }));
  });

  it('enforces import size, exercise count, text, metadata and duration boundaries', () => {
    expect(() => parseStrengthWorkout(' '.repeat(strengthWorkoutLimits.maxJsonBytes + 1))).toThrow(expect.objectContaining({ code: 'tooLarge' }));
    expect(() => validateStrengthWorkout({
      ...workout,
      exercises: Array.from({ length: 101 }, (_, index) => ({ name: String(index), work: 5, rest: 0 })),
    })).toThrow(expect.objectContaining({ code: 'tooLarge' }));
    expect(() => validateStrengthWorkout({ ...workout, name: 'x'.repeat(201) })).toThrow(expect.objectContaining({ code: 'invalidWorkout' }));
    expect(() => validateStrengthWorkout({ ...workout, roundRest: 301 })).toThrow(expect.objectContaining({ code: 'invalidDuration' }));
    expect(() => validateStrengthWorkout({ ...workout, exportTime: 'not-a-date' })).toThrow(expect.objectContaining({ code: 'invalidMetadata' }));
    expect(() => stringifyStrengthWorkout(workout, { source: '', exportTime: 'bad' })).toThrow(expect.objectContaining({ code: 'invalidMetadata' }));
    expect(() => validateStrengthWorkout(null)).toThrow(expect.objectContaining({ path: 'workout' }));
  });
});

describe('strength workout timeline', () => {
  it('builds exact preparation, work, rest and round-rest stages', () => {
    const timeline = buildStrengthTimeline(workout, 'en');
    expect(timeline.map(stage => [stage.type, stage.duration, stage.startSeconds, stage.endSeconds])).toEqual([
      ['prep', 3, 0, 3],
      ['work', 5, 3, 8],
      ['rest', 2, 8, 10],
      ['work', 6, 10, 16],
      ['round_rest', 3, 16, 19],
      ['work', 5, 19, 24],
      ['rest', 2, 24, 26],
      ['work', 6, 26, 32],
      ['done', 0, 32, 32],
    ]);
    expect(timeline[0]).toMatchObject({ upNextName: 'First', upNextDuration: 5 });
    expect(timeline[2].tip).toContain('Second');
    expect(timeline[4]).toMatchObject({ round: 1, upNextName: 'First' });
    expect(Object.isFrozen(timeline[0])).toBe(true);
    const stats = getStrengthWorkoutStats(workout);
    expect(stats).toEqual({
      totalSeconds: 32, preparationSeconds: 3, workSeconds: 22,
      restSeconds: 4, roundRestSeconds: 3, exerciseCount: 2, rounds: 2, workIntervals: 4,
    });
  });

  it('supports zero exercise rests and zero round rests without empty stages', () => {
    const noRest = {
      ...workout, rounds: 1, roundRest: 0,
      exercises: workout.exercises.map(exercise => ({ ...exercise, rest: 0 })),
    };
    expect(buildStrengthTimeline(noRest).map(stage => stage.type)).toEqual(['prep', 'work', 'work', 'done']);
    expect(getStrengthWorkoutStats(noRest).restSeconds).toBe(0);
  });

  it('preserves an explicitly configured final exercise rest for custom and imported workouts', () => {
    const custom = {
      ...workout,
      exercises: [{ ...workout.exercises[0], rest: 2 }],
    };
    const imported = parseStrengthWorkout(JSON.stringify(custom));
    expect(buildStrengthTimeline(imported).map(stage => stage.type)).toEqual([
      'prep', 'work', 'rest', 'round_rest', 'work', 'rest', 'done',
    ]);
  });

  it('localizes generated stage text', () => {
    const timeline = buildStrengthTimeline(workout, 'zh');
    expect(timeline[0].name).toBe('准备倒计时');
    expect(timeline[2].name).toBe('间歇休息');
    expect(timeline.at(-1)?.name).toContain('训练完成');
  });
});

describe('elapsed-time strength state machine', () => {
  it('uses monotonic elapsed time and catches up after delayed ticks without interval drift', () => {
    const timer = createStrengthTimer(workout, 'en');
    expect(timer.snapshot).toMatchObject({ status: 'idle', stageIndex: 0, totalSeconds: 32, remainingSeconds: 32 });
    expect(timer.dispatch('start', 1000)).toMatchObject({
      snapshot: { status: 'running', stageIndex: 0, stageRemainingSeconds: 3 },
      cues: [{ type: 'stage' }],
    });
    const delayed = timer.dispatch('tick', 6200);
    expect(delayed.snapshot).toMatchObject({
      status: 'running', stageIndex: 1, stageRemainingSeconds: 3,
      elapsedSeconds: 5.2, positionSeconds: 5.2,
    });
    expect(delayed.cues).toMatchObject([{ type: 'stage', stage: { name: 'First' } }]);
    const completed = timer.dispatch('tick', 100000);
    expect(completed.snapshot).toMatchObject({
      status: 'completed', stageIndex: 8, stageRemainingSeconds: 0,
      elapsedSeconds: 32, remainingSeconds: 0,
    });
    expect(completed.cues).toMatchObject([{ type: 'complete' }]);
  });

  it('excludes pauses and preserves active elapsed time across resume', () => {
    const timer = createStrengthTimer(workout);
    timer.dispatch('start', 0);
    timer.dispatch('pause', 2000);
    expect(timer.snapshot).toMatchObject({ status: 'paused', elapsedSeconds: 2, positionSeconds: 2 });
    timer.dispatch('tick', 5000);
    expect(timer.snapshot.elapsedSeconds).toBe(2);
    timer.dispatch('resume', 5000);
    timer.dispatch('tick', 6500);
    expect(timer.snapshot).toMatchObject({ status: 'running', elapsedSeconds: 3.5, positionSeconds: 3.5, stageIndex: 1 });
  });

  it('navigates without fabricating elapsed training, supports completion and reset', () => {
    const timer = createStrengthTimer(workout);
    timer.dispatch('start', 0);
    const skipped = timer.dispatch('skip', 100);
    expect(skipped.snapshot).toMatchObject({ stageIndex: 1, positionSeconds: 3, elapsedSeconds: 0.1, status: 'running' });
    expect(skipped.cues[0].type).toBe('navigate');
    const backed = timer.dispatch('back', 200);
    expect(backed.snapshot).toMatchObject({ stageIndex: 0, positionSeconds: 0, elapsedSeconds: 0.2 });
    expect(timer.dispatch('back', 300).snapshot.stageIndex).toBe(0);
    for (let index = 0; index < timer.timeline.length; index++) timer.dispatch('skip', 400 + index);
    expect(timer.snapshot.status).toBe('completed');
    expect(timer.dispatch('reset', 1000).snapshot).toMatchObject({
      status: 'idle', stageIndex: 0, positionSeconds: 0, elapsedSeconds: 0,
    });
  });

  it('emits countdown cues only when displayed seconds change', () => {
    const timer = createStrengthTimer(workout);
    timer.dispatch('start', 0);
    expect(timer.dispatch('tick', 100).cues).toEqual([]);
    expect(timer.dispatch('tick', 1000).cues).toEqual([{ type: 'countdown', seconds: 2 }]);
    expect(timer.dispatch('tick', 1500).cues).toEqual([]);
    expect(timer.dispatch('tick', 2000).cues).toEqual([{ type: 'countdown', seconds: 1 }]);
  });

  it('rejects invalid clocks and actions', () => {
    const timer = createStrengthTimer(workout);
    expect(() => timer.dispatch('start', NaN)).toThrow(expect.objectContaining({ code: 'invalidClock' }));
    timer.dispatch('start', 100);
    expect(() => timer.dispatch('tick', 99)).toThrow(expect.objectContaining({ code: 'invalidClock' }));
    expect(() => timer.dispatch('unknown' as never, 101)).toThrow(expect.objectContaining({ code: 'invalidAction' }));
  });
});

function audioHarness() {
  const parameter = () => ({
    setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(),
  });
  const oscillators: any[] = [];
  const gains: any[] = [];
  const context = {
    currentTime: 0, state: 'running', destination: {},
    resume: vi.fn(async () => { context.state = 'running'; }),
    createOscillator: vi.fn(() => {
      const value = { type: '', frequency: parameter(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null as any };
      oscillators.push(value);
      return value;
    }),
    createGain: vi.fn(() => {
      const value = { gain: parameter(), connect: vi.fn(), disconnect: vi.fn() };
      gains.push(value);
      return value;
    }),
  };
  const speech = { speak: vi.fn(), cancel: vi.fn() };
  const onError = vi.fn();
  const player = createStrengthCuePlayer({ createAudioContext: () => context as never, speech, onError });
  return { context, oscillators, gains, speech, onError, player };
}

describe('strength cue adapter', () => {
  it('coalesces pending activation and does not re-enable after cancellation', async () => {
    const harness = audioHarness();
    harness.context.state = 'suspended';
    let resolveResume!: () => void;
    harness.context.resume.mockImplementation(() => new Promise<void>(resolve => { resolveResume = resolve; }));
    const enabling = harness.player.enable();
    expect(harness.player.enable()).toBe(enabling);
    expect(harness.context.resume).toHaveBeenCalledOnce();
    harness.player.disable();
    harness.context.state = 'running';
    resolveResume();
    expect(await enabling).toBe(false);
    expect(harness.player.enabled).toBe(false);
    expect(await harness.player.enable()).toBe(true);
  });

  it('resumes an interrupted mobile context immediately from the enable gesture', async () => {
    const harness = audioHarness();
    harness.context.state = 'interrupted';
    const enabling = harness.player.enable();
    expect(harness.context.resume).toHaveBeenCalledOnce();
    expect(await enabling).toBe(true);
  });

  it('stops repeated failed cues after a mobile interruption and supports an explicit retry', async () => {
    const harness = audioHarness();
    await harness.player.enable();
    harness.context.state = 'interrupted';
    harness.player.play([{ type: 'countdown', seconds: 2 }]);
    expect(harness.onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'audioResumeFailed' }));
    expect(harness.player.enabled).toBe(false);
    harness.player.play([{ type: 'countdown', seconds: 1 }]);
    expect(harness.onError).toHaveBeenCalledOnce();
    expect(await harness.player.enable()).toBe(true);
    harness.player.play([{ type: 'countdown', seconds: 1 }]);
    expect(harness.context.createOscillator).toHaveBeenCalledOnce();
  });

  it('requires explicit enablement, coalesces enable calls and plays latest cues', async () => {
    const harness = audioHarness();
    const stage = buildStrengthTimeline(workout)[1];
    harness.player.play([{ type: 'stage', stage }]);
    expect(harness.context.createOscillator).not.toHaveBeenCalled();
    expect(await harness.player.enable()).toBe(true);
    expect(await harness.player.enable()).toBe(true);
    harness.player.play([{ type: 'countdown', seconds: 2 }, { type: 'stage', stage }]);
    expect(harness.speech.speak).toHaveBeenCalledWith(stage.name);
    expect(harness.context.createOscillator).toHaveBeenCalledOnce();
    harness.player.cancel();
    expect(harness.speech.cancel).toHaveBeenCalled();
    harness.player.disable();
    expect(harness.player.enabled).toBe(false);
  });

  it('plays completion and navigation patterns and cancels superseded nodes', async () => {
    const harness = audioHarness();
    await harness.player.enable();
    const done = buildStrengthTimeline(workout).at(-1)!;
    harness.player.play([{ type: 'complete', stage: done }]);
    expect(harness.context.createOscillator).toHaveBeenCalledTimes(4);
    harness.player.play([{ type: 'navigate', stage: buildStrengthTimeline(workout)[1] }]);
    expect(harness.context.createOscillator).toHaveBeenCalledTimes(5);
    expect(harness.oscillators.slice(0, 4).every(node => node.stop.mock.calls.length > 0)).toBe(true);
  });

  it('reports unavailable, resume, speech and node failures without stopping visual timing', async () => {
    const unavailable = createStrengthCuePlayer({
      createAudioContext: () => { throw new Error('no audio'); },
      onError: vi.fn(),
    });
    await expect(unavailable.enable()).rejects.toMatchObject({ code: 'audioUnavailable' });
    const harness = audioHarness();
    harness.context.state = 'suspended';
    harness.context.resume.mockRejectedValueOnce(new Error('blocked'));
    await expect(harness.player.enable()).rejects.toMatchObject({ code: 'audioResumeFailed' });
    harness.context.resume.mockImplementation(async () => { harness.context.state = 'running'; });
    expect(await harness.player.enable()).toBe(true);
    harness.speech.speak.mockImplementationOnce(() => { throw new Error('speech'); });
    harness.player.play([{ type: 'stage', stage: buildStrengthTimeline(workout)[1] }]);
    expect(harness.onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'cueFailed' }));
    harness.player.disable();
    harness.speech.cancel.mockImplementationOnce(() => { throw new Error('cancel'); });
    harness.player.cancel();
    expect(harness.onError).toHaveBeenCalledTimes(2);
  });
});
