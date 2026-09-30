import { accented, CadenceAudioError, cadenceSettings, checkAbort, scheduleClick } from './shared.js';
import type { CadenceSettings, SynthesisContext } from './shared.js';

export type CadenceAudioQuality = 'mp3-64' | 'mp3-128' | 'wav-16k' | 'wav-44k';

export interface CadenceAudioRequest extends Partial<CadenceSettings> {
  durationSeconds: number;
  quality: CadenceAudioQuality;
}

export interface MonoMp3Encoder {
  encodeBuffer(samples: Int16Array): Int8Array | Uint8Array;
  flush(): Int8Array | Uint8Array;
}

export interface AudioEncodingControl {
  /** Yield to a browser task (not just a resolved microtask) to keep controls responsive. */
  yieldControl(): Promise<void>;
  signal?: AbortSignal;
}

export interface CadenceAudioAdapters extends AudioEncodingControl {
  createOfflineContext(channels: number, frames: number, sampleRate: number): SynthesisContext & {
    startRendering(): Promise<Pick<AudioBuffer, 'getChannelData' | 'sampleRate'>>;
  };
  createMp3Encoder?(sampleRate: number, bitrate: number): MonoMp3Encoder;
}

export interface RenderedCadenceAudio {
  data: Uint8Array<ArrayBuffer>;
  mimeType: 'audio/wav' | 'audio/mpeg';
  extension: 'wav' | 'mp3';
  sampleRate: number;
  durationSeconds: number;
  settings: CadenceSettings;
}

function pcm16(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, Number.isFinite(sample) ? sample : 0));
  return clamped < 0 ? clamped * 32768 : clamped * 32767;
}

/** Mono PCM RIFF/WAVE, little-endian, with bounded cooperative conversion. */
export async function serializeMonoWav(
  samples: Float32Array,
  sampleRate: number,
  control: AudioEncodingControl,
  bitDepth: 8 | 16 = 16,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000
    || ![8, 16].includes(bitDepth) || samples.length > 44100 * 900 || samples.length === 0) {
    throw new CadenceAudioError('invalidPcm');
  }
  checkAbort(control.signal);
  const bytesPerSample = bitDepth / 8;
  const dataLength = samples.length * bytesPerSample;
  const data = new Uint8Array(44 + dataLength + dataLength % 2);
  const view = new DataView(data.buffer);
  for (const [offset, text] of [[0, 'RIFF'], [8, 'WAVE'], [12, 'fmt '], [36, 'data']] as const) {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  }
  view.setUint32(4, data.length - 8, true);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, bitDepth, true);
  view.setUint32(40, dataLength, true);
  for (let start = 0; start < samples.length; start += 32768) {
    const end = Math.min(samples.length, start + 32768);
    for (let i = start; i < end; i++) {
      const offset = 44 + i * bytesPerSample;
      if (bitDepth === 16) view.setInt16(offset, pcm16(samples[i]), true);
      else {
        const sample = Math.max(-1, Math.min(1, Number.isFinite(samples[i]) ? samples[i] : 0));
        view.setUint8(offset, Math.floor((sample + 1) * 127.5));
      }
    }
    await control.yieldControl();
    checkAbort(control.signal);
  }
  return data;
}

async function encodeMp3(samples: Float32Array, encoder: MonoMp3Encoder, control: AudioEncodingControl) {
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let length = 0;
  const append = (chunk: Int8Array | Uint8Array) => {
    if (chunk.length) {
      const copy = new Uint8Array(chunk);
      parts.push(copy);
      length += copy.length;
    }
  };
  for (let start = 0, block = 0; start < samples.length; start += 1152, block++) {
    checkAbort(control.signal);
    const pcm = new Int16Array(Math.min(1152, samples.length - start));
    for (let i = 0; i < pcm.length; i++) pcm[i] = pcm16(samples[start + i]);
    append(encoder.encodeBuffer(pcm));
    if (block % 16 === 15) await control.yieldControl();
  }
  checkAbort(control.signal);
  append(encoder.flush());
  if (!length) throw new CadenceAudioError('renderFailed');
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

/** Snapshots settings. Rendering never creates or resumes the live playback context. */
export async function renderCadenceAudio(
  request: CadenceAudioRequest,
  adapters: CadenceAudioAdapters,
): Promise<RenderedCadenceAudio> {
  const { durationSeconds, quality } = request;
  const settings = cadenceSettings({
    spm: request.spm ?? 180, sound: request.sound ?? 'wood',
    accent: request.accent ?? '1:1', profile: request.profile ?? 'standard',
  });
  if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 900) {
    throw new CadenceAudioError('invalidDuration');
  }
  if (!['mp3-64', 'mp3-128', 'wav-16k', 'wav-44k'].includes(quality)) throw new CadenceAudioError('invalidQuality');
  const mp3 = quality.startsWith('mp3');
  if (mp3 && !adapters.createMp3Encoder) throw new CadenceAudioError('mp3Unavailable');
  checkAbort(adapters.signal);
  const sampleRate = quality === 'wav-16k' ? 16000 : 44100;
  try {
    const context = adapters.createOfflineContext(1, sampleRate * durationSeconds, sampleRate);
    for (let step = 0; ; step++) {
      const time = 0.05 + step * 60 / settings.spm;
      if (time >= durationSeconds) break;
      scheduleClick(context, time, settings, accented(step, settings.accent), () => {});
      if (step % 64 === 63) { await adapters.yieldControl(); checkAbort(adapters.signal); }
    }
    await adapters.yieldControl();
    checkAbort(adapters.signal);
    const buffer = await context.startRendering();
    checkAbort(adapters.signal);
    const samples = buffer.getChannelData(0);
    if (samples.length !== sampleRate * durationSeconds || buffer.sampleRate !== sampleRate) {
      throw new CadenceAudioError('invalidPcm');
    }
    const data = mp3
      ? await encodeMp3(samples, adapters.createMp3Encoder!(sampleRate, quality === 'mp3-128' ? 128 : 64), adapters)
      : await serializeMonoWav(samples, sampleRate, adapters);
    checkAbort(adapters.signal);
    return { data, mimeType: mp3 ? 'audio/mpeg' : 'audio/wav', extension: mp3 ? 'mp3' : 'wav',
      sampleRate, durationSeconds, settings };
  } catch (cause) {
    if (cause instanceof CadenceAudioError) throw cause;
    throw new CadenceAudioError('renderFailed', { cause });
  }
}
