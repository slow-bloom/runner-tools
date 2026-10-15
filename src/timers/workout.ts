export const strengthWorkoutLimits = Object.freeze({
  maxJsonBytes: 1_048_576,
  maxExercises: 100,
  maxNameLength: 200,
  maxDescriptionLength: 2000,
  maxTipLength: 1000,
  minRounds: 1, maxRounds: 10,
  minPrepSeconds: 3, maxPrepSeconds: 30,
  minWorkSeconds: 5, maxWorkSeconds: 600,
  maxRestSeconds: 300,
  maxSets: 10,
  maxReps: 200,
});

export type StrengthTimerErrorCode =
  | 'invalidJson' | 'invalidWorkout' | 'invalidExercise' | 'invalidDuration'
  | 'invalidRounds' | 'invalidReps' | 'unsupportedVersion' | 'tooLarge' | 'invalidMetadata'
  | 'invalidClock' | 'invalidAction' | 'audioUnavailable' | 'audioResumeFailed' | 'cueFailed';

export class StrengthTimerError extends Error {
  constructor(public readonly code: StrengthTimerErrorCode, public readonly path = '', options?: ErrorOptions) {
    super(code, options);
    this.name = 'StrengthTimerError';
  }
}

interface StrengthExerciseBase {
  id: string;
  name: string;
  rest: number;
  tip: string;
}

export type StrengthExercise = StrengthExerciseBase & (
  | { mode?: 'timed'; work: number }
  | { mode: 'reps'; sets: number; reps: number }
);

/** Legacy timed workouts and mixed timed/self-paced workouts. */
export interface StrengthWorkout {
  name: string;
  description: string;
  rounds: number;
  roundRest: number;
  prepTime: number;
  exercises: StrengthExercise[];
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new StrengthTimerError('invalidWorkout', path);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, max: number, path: string, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) {
    throw new StrengthTimerError('invalidWorkout', path);
  }
  return value;
}

function duration(value: unknown, min: number, max: number, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new StrengthTimerError('invalidDuration', path);
  }
  return value;
}

function count(value: unknown, max: number, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max) {
    throw new StrengthTimerError('invalidReps', path);
  }
  return value;
}

/** Validates without coercion, drops unrecognized fields, and returns an independent editable copy. */
export function validateStrengthWorkout(value: unknown): StrengthWorkout {
  const data = object(value, 'workout');
  if (data.version !== undefined && data.version !== '1.0' && data.version !== '1.1') throw new StrengthTimerError('unsupportedVersion', 'version');
  if (!Array.isArray(data.exercises) || data.exercises.length === 0) throw new StrengthTimerError('invalidExercise', 'exercises');
  if (data.exercises.length > strengthWorkoutLimits.maxExercises) throw new StrengthTimerError('tooLarge', 'exercises');
  if (typeof data.rounds !== 'number' || !Number.isInteger(data.rounds) || data.rounds < 1 || data.rounds > 10) {
    throw new StrengthTimerError('invalidRounds', 'rounds');
  }
  if (data.source !== undefined) text(data.source, 200, 'source');
  if (data.exportTime !== undefined && (typeof data.exportTime !== 'string' || !Number.isFinite(Date.parse(data.exportTime)))) {
    throw new StrengthTimerError('invalidMetadata', 'exportTime');
  }
  return {
    name: text(data.name, strengthWorkoutLimits.maxNameLength, 'name'),
    description: data.description === undefined ? '' : text(data.description, strengthWorkoutLimits.maxDescriptionLength, 'description', true),
    rounds: data.rounds,
    roundRest: duration(data.roundRest, 0, strengthWorkoutLimits.maxRestSeconds, 'roundRest'),
    prepTime: duration(data.prepTime, strengthWorkoutLimits.minPrepSeconds, strengthWorkoutLimits.maxPrepSeconds, 'prepTime'),
    exercises: data.exercises.map((value, index) => {
      const path = `exercises[${index}]`;
      const exercise = object(value, path);
      if (exercise.mode !== undefined && exercise.mode !== 'timed' && exercise.mode !== 'reps') {
        throw new StrengthTimerError('invalidExercise', `${path}.mode`);
      }
      let prescription: Pick<Extract<StrengthExercise, { mode: 'reps' }>, 'mode' | 'sets' | 'reps'> | { work: number };
      if (exercise.mode === 'reps') {
        prescription = {
          mode: 'reps',
          sets: count(exercise.sets, strengthWorkoutLimits.maxSets, `${path}.sets`),
          reps: count(exercise.reps, strengthWorkoutLimits.maxReps, `${path}.reps`),
        };
      } else {
        prescription = { work: duration(exercise.work, strengthWorkoutLimits.minWorkSeconds, strengthWorkoutLimits.maxWorkSeconds, `${path}.work`) };
      }
      return {
        id: exercise.id === undefined ? `exercise-${index + 1}` : text(exercise.id, 200, `${path}.id`),
        name: text(exercise.name, strengthWorkoutLimits.maxNameLength, `${path}.name`),
        ...prescription,
        rest: duration(exercise.rest, 0, strengthWorkoutLimits.maxRestSeconds, `${path}.rest`),
        tip: exercise.tip === undefined ? '' : text(exercise.tip, strengthWorkoutLimits.maxTipLength, `${path}.tip`, true),
      };
    }),
  };
}

export function parseStrengthWorkout(json: string): StrengthWorkout {
  if (typeof json !== 'string') throw new StrengthTimerError('invalidJson');
  if (json.length > strengthWorkoutLimits.maxJsonBytes || new TextEncoder().encode(json).length > strengthWorkoutLimits.maxJsonBytes) {
    throw new StrengthTimerError('tooLarge');
  }
  let data: unknown;
  try { data = JSON.parse(json); }
  catch (cause) { throw new StrengthTimerError('invalidJson', '', { cause }); }
  return validateStrengthWorkout(data);
}

export interface StrengthExportMetadata {
  source: string;
  exportTime: string;
}

/** Deterministic export: the caller supplies its localized source and ISO export time. */
export function stringifyStrengthWorkout(workout: unknown, metadata: StrengthExportMetadata): string {
  const valid = validateStrengthWorkout(workout);
  if (typeof metadata.source !== 'string' || !metadata.source.trim() || metadata.source.length > 200
    || typeof metadata.exportTime !== 'string' || !Number.isFinite(Date.parse(metadata.exportTime))) {
    throw new StrengthTimerError('invalidMetadata');
  }
  return JSON.stringify({
    version: valid.exercises.some(exercise => exercise.mode === 'reps') ? '1.1' : '1.0',
    source: metadata.source, exportTime: metadata.exportTime,
    ...valid,
    exercises: valid.exercises.map(({ id: _id, ...exercise }) => exercise),
  }, null, 2);
}
