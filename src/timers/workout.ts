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
});

export type StrengthTimerErrorCode =
  | 'invalidJson' | 'invalidWorkout' | 'invalidExercise' | 'invalidDuration'
  | 'invalidRounds' | 'unsupportedVersion' | 'tooLarge' | 'invalidMetadata'
  | 'invalidClock' | 'invalidAction' | 'audioUnavailable' | 'audioResumeFailed' | 'cueFailed';

export class StrengthTimerError extends Error {
  constructor(public readonly code: StrengthTimerErrorCode, public readonly path = '', options?: ErrorOptions) {
    super(code, options);
    this.name = 'StrengthTimerError';
  }
}

export interface StrengthExercise {
  id: string;
  name: string;
  work: number;
  rest: number;
  tip: string;
}

/** The existing Apex Run local-storage and version 1.0 export fields. */
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

/** Validates without coercion, drops unrecognized fields, and returns an independent editable copy. */
export function validateStrengthWorkout(value: unknown): StrengthWorkout {
  const data = object(value, 'workout');
  if (data.version !== undefined && data.version !== '1.0') throw new StrengthTimerError('unsupportedVersion', 'version');
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
      return {
        id: exercise.id === undefined ? `exercise-${index + 1}` : text(exercise.id, 200, `${path}.id`),
        name: text(exercise.name, strengthWorkoutLimits.maxNameLength, `${path}.name`),
        work: duration(exercise.work, strengthWorkoutLimits.minWorkSeconds, strengthWorkoutLimits.maxWorkSeconds, `${path}.work`),
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
    version: '1.0', source: metadata.source, exportTime: metadata.exportTime,
    ...valid,
    exercises: valid.exercises.map(({ name, work, rest, tip }) => ({ name, work, rest, tip })),
  }, null, 2);
}
