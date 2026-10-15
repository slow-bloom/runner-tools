import { strengthTimerMessages } from './messages.js';
import type { StrengthLocale, StrengthStageType } from './messages.js';
import { validateStrengthWorkout } from './workout.js';

export interface StrengthStage {
  readonly type: StrengthStageType;
  readonly name: string;
  readonly tip: string;
  /** Zero for self-paced work; duration totals include only timed stages. */
  readonly duration: number;
  /** Target repetitions, or zero for a timed stage. */
  readonly reps: number;
  readonly set: number;
  readonly totalSets: number;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly exerciseIndex: number;
  readonly totalExercises: number;
  readonly round: number;
  readonly totalRounds: number;
  readonly upNextName: string;
  readonly upNextDuration: number;
  readonly upNextTip: string;
  readonly upNextReps: number;
}

/** Includes the final exercise's rest, plus a separate round rest between rounds, matching legacy workouts. */
export function buildStrengthTimeline(value: unknown, locale: StrengthLocale = 'en'): readonly StrengthStage[] {
  const workout = validateStrengthWorkout(value);
  const messages = strengthTimerMessages[locale];
  const stages: Omit<StrengthStage, 'upNextName' | 'upNextDuration' | 'upNextTip' | 'upNextReps'>[] = [];
  let time = 0;
  function append(type: StrengthStageType, name: string, tip: string, duration: number, exerciseIndex: number, round: number,
    set = 1, totalSets = 1, reps = 0) {
    stages.push({ type, name, tip, duration, startSeconds: time, endSeconds: time + duration,
      exerciseIndex, totalExercises: workout.exercises.length, round, totalRounds: workout.rounds, set, totalSets, reps });
    time += duration;
  }
  append('prep', messages.prepName, messages.prepTip, workout.prepTime, 0, 1);
  for (let round = 1; round <= workout.rounds; round++) {
    workout.exercises.forEach((exercise, index) => {
      const sets = exercise.mode === 'reps' ? exercise.sets : 1;
      for (let set = 1; set <= sets; set++) {
        append('work', exercise.name, exercise.tip, exercise.mode === 'reps' ? 0 : exercise.work,
          index + 1, round, set, sets, exercise.mode === 'reps' ? exercise.reps : 0);
        if (exercise.rest > 0) append('rest', messages.restName, '', exercise.rest, index + 1, round, set, sets);
      }
    });
    if (round < workout.rounds && workout.roundRest > 0) {
      append('round_rest', messages.roundRestName(round), messages.roundRestTip(round + 1),
        workout.roundRest, workout.exercises.length, round);
    }
  }
  append('done', messages.doneName, messages.doneTip, 0, workout.exercises.length, workout.rounds);
  return Object.freeze(stages.map((stage, index) => {
    const next = stages[index + 1];
    return Object.freeze({
      ...stage,
      tip: stage.type === 'rest' ? messages.restTip(next.name) : stage.tip,
      upNextName: next?.name ?? '',
      upNextDuration: next?.duration ?? 0,
      upNextTip: next?.tip ?? '',
      upNextReps: next?.reps ?? 0,
    });
  }));
}

export function getStrengthWorkoutStats(workout: unknown) {
  const timeline = buildStrengthTimeline(workout);
  const seconds = (type: StrengthStageType) => timeline.filter(stage => stage.type === type).reduce((sum, stage) => sum + stage.duration, 0);
  return {
    totalSeconds: timeline[timeline.length - 1].startSeconds,
    preparationSeconds: seconds('prep'),
    workSeconds: seconds('work'),
    restSeconds: seconds('rest'),
    roundRestSeconds: seconds('round_rest'),
    exerciseCount: timeline[0].totalExercises,
    rounds: timeline[0].totalRounds,
    workIntervals: timeline.filter(stage => stage.type === 'work').length,
    selfPacedSets: timeline.filter(stage => stage.reps > 0).length,
  };
}
