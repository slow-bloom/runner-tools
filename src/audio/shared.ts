export type CadenceSound = 'wood' | 'beep' | 'snap' | 'kick';
export type CadenceAccent = '1:1' | '2:4' | '4:4';
export type CadenceSoundProfile = 'standard' | 'warm';

export interface CadenceSettings {
  spm: number;
  sound: CadenceSound;
  accent: CadenceAccent;
  profile: CadenceSoundProfile;
}

export type CadenceAudioErrorCode =
  | 'invalidSettings' | 'invalidTarget' | 'invalidTapTime' | 'invalidDuration'
  | 'invalidQuality' | 'invalidPcm' | 'audioUnavailable' | 'audioResumeFailed'
  | 'mp3Unavailable' | 'renderFailed' | 'aborted';

export class CadenceAudioError extends Error {
  constructor(public readonly code: CadenceAudioErrorCode, options?: ErrorOptions) {
    super(code, options);
    this.name = 'CadenceAudioError';
  }
}

export function cadenceSettings(input: Partial<CadenceSettings>): CadenceSettings {
  const settings = { spm: 180, sound: 'wood', accent: '1:1', profile: 'standard', ...input };
  if (!Number.isInteger(settings.spm) || settings.spm < 120 || settings.spm > 210
    || !['wood', 'beep', 'snap', 'kick'].includes(settings.sound)
    || !['1:1', '2:4', '4:4'].includes(settings.accent)
    || !['standard', 'warm'].includes(settings.profile)) {
    throw new CadenceAudioError('invalidSettings');
  }
  return settings as CadenceSettings;
}

export function accented(step: number, pattern: CadenceAccent): boolean {
  return pattern === '2:4' ? step % 2 === 0 : pattern === '4:4' && step % 4 === 0;
}

export function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new CadenceAudioError('aborted');
}

export type SynthesisContext = Pick<BaseAudioContext,
  'currentTime' | 'sampleRate' | 'destination' | 'createGain' | 'createOscillator'
  | 'createBuffer' | 'createBufferSource' | 'createBiquadFilter'>;

export interface ScheduledClick { cancel(): void }

export function scheduleClick(
  context: SynthesisContext,
  time: number,
  settings: CadenceSettings,
  accent: boolean,
  onEnded: (click: ScheduledClick) => void,
): ScheduledClick {
  const gain = context.createGain();
  const warm = settings.profile === 'warm';
  let source: AudioScheduledSourceNode;
  let filter: BiquadFilterNode | undefined;
  let duration: number;

  if (settings.sound === 'snap') {
    const length = Math.floor(context.sampleRate * (warm ? 0.03 : 0.025));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      samples[i] = (Math.random() * 2 - 1) * (warm ? Math.exp(-i / (length * 0.2)) : 1);
    }
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    filter = context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(warm ? (accent ? 3500 : 2500) : (accent ? 6000 : 8000), time);
    noise.connect(filter);
    filter.connect(gain);
    gain.gain.setValueAtTime(warm ? (accent ? 0.85 : 0.6) : (accent ? 0.8 : 0.5), time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
    source = noise;
    duration = 0.03;
  } else {
    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    if (settings.sound === 'wood') {
      const frequency = accent ? 1000 : 750;
      oscillator.frequency.setValueAtTime(frequency, time);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.5, time + 0.03);
      gain.gain.setValueAtTime(accent ? 0.9 : 0.7, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
      duration = 0.045;
    } else if (settings.sound === 'beep') {
      oscillator.frequency.setValueAtTime(accent ? 1600 : 1200, time);
      gain.gain.setValueAtTime(accent ? 0.8 : (warm ? 0.6 : 0.5), time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
      duration = 0.035;
    } else {
      oscillator.frequency.setValueAtTime(warm ? (accent ? 180 : 130) : (accent ? 240 : 180), time);
      oscillator.frequency.exponentialRampToValueAtTime(warm ? 35 : 50, time + 0.05);
      gain.gain.setValueAtTime(accent ? 1 : (warm ? 0.8 : 0.7), time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + (warm ? 0.06 : 0.05));
      duration = warm ? 0.065 : 0.055;
    }
    oscillator.connect(gain);
    source = oscillator;
  }

  let ended = false;
  const disconnect = () => {
    if (ended) return;
    ended = true;
    source.disconnect();
    filter?.disconnect();
    gain.disconnect();
    onEnded(click);
  };
  const click = {
    cancel() {
      gain.gain.cancelScheduledValues(0);
      gain.gain.setValueAtTime(0, context.currentTime);
      source.stop(context.currentTime);
      disconnect();
    },
  };
  gain.connect(context.destination);
  source.onended = disconnect;
  source.start(time);
  source.stop(time + duration);
  return click;
}
