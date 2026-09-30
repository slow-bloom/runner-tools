import { CadenceAudioError } from './shared.js';

export interface CadenceTargetInput {
  paceMinutes: number;
  paceSeconds: number;
  height: number;
  paceUnit?: 'km' | 'mi';
  heightUnit?: 'cm' | 'in';
}

/** A practice starting point, not an individually optimal or injury-preventing cadence. */
export function calculateCadenceTarget(input: CadenceTargetInput) {
  const { paceMinutes, paceSeconds, height, paceUnit = 'km', heightUnit = 'cm' } = input;
  const heightMeters = heightUnit === 'in' ? height * 0.0254 : height / 100;
  if (!Number.isInteger(paceMinutes) || paceMinutes < 3 || paceMinutes > 15
    || !Number.isInteger(paceSeconds) || paceSeconds < 0 || paceSeconds > 59
    || !Number.isFinite(heightMeters) || heightMeters < 1.2 || heightMeters > 2.3
    || !['km', 'mi'].includes(paceUnit) || !['cm', 'in'].includes(heightUnit)) {
    throw new CadenceAudioError('invalidTarget');
  }
  const secondsPerKm = (paceMinutes * 60 + paceSeconds) / (paceUnit === 'mi' ? 1.60934 : 1);
  const speed = 1000 / secondsPerKm;
  const targetSPM = Math.max(150, Math.min(205, Math.round(162 + speed * 4.5 - (heightMeters - 1.75) * 12)));
  const stepLengthMeters = speed * 60 / targetSPM;
  return { targetSPM, stepLengthMeters, stepLengthFeet: stepLengthMeters * 3.28084, frequencyHz: targetSPM / 60 };
}

/** Uses at most six taps; gaps longer than 2.5 seconds start a new measurement. */
export function createTapTempo() {
  let taps: number[] = [];
  return {
    tap(timeMs: number): number | null {
      if (!Number.isFinite(timeMs) || timeMs < 0) throw new CadenceAudioError('invalidTapTime');
      const last = taps.at(-1);
      if (last !== undefined && (timeMs <= last || timeMs - last > 2500)) taps = [];
      taps.push(timeMs);
      if (taps.length > 6) taps.shift();
      if (taps.length < 2) return null;
      const spm = Math.round(60000 * (taps.length - 1) / (timeMs - taps[0]));
      return spm >= 100 && spm <= 230 ? Math.max(120, Math.min(210, spm)) : null;
    },
    reset() { taps = []; },
  };
}
