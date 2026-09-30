import { describe, expect, it, vi } from 'vitest';
import {
  calculateCadenceTarget, createTapTempo, createCadenceMetronome, renderCadenceAudio,
  serializeMonoWav, CadenceAudioError, cadenceAudioMessages,
} from './index.js';
import type { CadenceAudioAdapters, CadenceClock, CadenceMetronomeOptions } from './index.js';

function fakeAudio() {
  const parameter = () => ({
    value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(),
  });
  const nodes: any[] = [];
  const node = () => {
    const result = {
      connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: undefined as undefined | (() => void),
      gain: parameter(), frequency: parameter(), type: '', buffer: null as any,
    };
    nodes.push(result);
    return result;
  };
  const context = {
    currentTime: 0, sampleRate: 16000, destination: {}, state: 'running',
    resume: vi.fn(async () => { context.state = 'running'; }),
    createGain: vi.fn(node), createOscillator: vi.fn(node), createBufferSource: vi.fn(node), createBiquadFilter: vi.fn(node),
    createBuffer: vi.fn((_channels: number, length: number) => {
      const samples = new Float32Array(length);
      return { getChannelData: () => samples };
    }),
  };
  return { context, nodes };
}

function liveHarness(onError = vi.fn()) {
  const { context, nodes } = fakeAudio();
  let time = 0, id = 0;
  const tasks = new Map<number, { callback: () => void; at: number }>();
  const clock: CadenceClock = {
    setTimeout(callback, delay) { tasks.set(++id, { callback, at: time + delay }); return id; },
    clearTimeout(handle) { tasks.delete(handle as number); },
  };
  const onBeat = vi.fn();
  const createAudioContext = vi.fn(() => context as unknown as ReturnType<CadenceMetronomeOptions['createAudioContext']>);
  const options = { createAudioContext, clock, onBeat, onError };
  const metronome = createCadenceMetronome(options);
  function advance(ms: number, delayed = false) {
    const target = time + ms;
    if (delayed) { time = target; context.currentTime = time / 1000; }
    for (;;) {
      const entry = [...tasks].sort((a, b) => a[1].at - b[1].at).find(([, task]) => task.at <= target);
      if (!entry) break;
      const [key, task] = entry;
      tasks.delete(key);
      if (!delayed) { time = task.at; context.currentTime = time / 1000; }
      task.callback();
    }
    time = target;
    context.currentTime = time / 1000;
  }
  return { metronome, options, context, nodes, onBeat, onError, tasks, advance };
}

function offlineHarness() {
  const { context, nodes } = fakeAudio();
  const rendered = vi.fn();
  const adapters: CadenceAudioAdapters = {
    createOfflineContext: vi.fn((_channels, frames, sampleRate) => {
      context.sampleRate = sampleRate;
      return {
        ...context, startRendering: async () => {
          rendered();
          for (const node of nodes) node.onended?.();
          return { sampleRate, getChannelData: () => new Float32Array(frames) };
        },
      } as unknown as ReturnType<CadenceAudioAdapters['createOfflineContext']>;
    }),
    yieldControl: vi.fn(async () => {}),
  };
  return { adapters, context, nodes, rendered };
}

describe('cadence target and tap measurement', () => {
  it('keeps the existing empirical model, metric and imperial equivalence, and zero pace seconds', () => {
    const result = calculateCadenceTarget({ paceMinutes: 5, paceSeconds: 30, height: 175 });
    expect(result.targetSPM).toBe(176);
    expect(result.stepLengthMeters).toBeCloseTo(1000 / 330 * 60 / 176);
    expect(result.stepLengthFeet).toBeCloseTo(result.stepLengthMeters * 3.28084);
    expect(result.frequencyHz).toBeCloseTo(176 / 60);
    expect(calculateCadenceTarget({ paceMinutes: 5, paceSeconds: 0, height: 175 }).targetSPM).toBe(177);
    const imperial = calculateCadenceTarget({ paceMinutes: 8, paceSeconds: 0, paceUnit: 'mi', height: 175 / 2.54, heightUnit: 'in' });
    expect(imperial.targetSPM).toBe(Math.round(162 + 1000 / (480 / 1.60934) * 4.5));
    expect(calculateCadenceTarget({ paceMinutes: 3, paceSeconds: 0, paceUnit: 'mi', height: 120 }).targetSPM).toBe(205);
    expect(calculateCadenceTarget({ paceMinutes: 15, paceSeconds: 59, height: 230 }).targetSPM).toBe(160);
  });

  it.each([
    { paceMinutes: 2 }, { paceMinutes: 16 }, { paceMinutes: 3.2 }, { paceMinutes: NaN },
    { paceSeconds: -1 }, { paceSeconds: 60 }, { paceSeconds: 0.1 },
    { height: 119 }, { height: 231 }, { height: Infinity }, { heightUnit: 'feet' }, { paceUnit: 'm' },
  ])('rejects invalid target fields rather than substituting guesses: %j', invalid => {
    expect(() => calculateCadenceTarget({ paceMinutes: 5, paceSeconds: 0, height: 175, ...invalid } as any))
      .toThrow(expect.objectContaining({ code: 'invalidTarget' }));
  });

  it('averages the last six taps, resets gaps and non-increasing clocks, and clamps only detectable tempo', () => {
    const taps = createTapTempo();
    expect(taps.tap(0)).toBeNull();
    expect(taps.tap(333)).toBe(180);
    for (let i = 2; i <= 8; i++) expect(taps.tap(i * 333)).toBe(180);
    expect(taps.tap(10000)).toBeNull();
    expect(taps.tap(10000)).toBeNull();
    expect(taps.tap(9999)).toBeNull();
    taps.reset();
    taps.tap(0);
    expect(taps.tap(600)).toBe(120);
    taps.reset();
    taps.tap(0);
    expect(taps.tap(270)).toBe(210);
    taps.reset();
    taps.tap(0);
    expect(taps.tap(100)).toBeNull();
    taps.reset();
    taps.tap(0);
    expect(taps.tap(2500)).toBeNull();
    expect(taps.tap(5001)).toBeNull();
    expect(() => taps.tap(-1)).toThrow(CadenceAudioError);
    expect(() => taps.tap(NaN)).toThrow(CadenceAudioError);
  });
});

describe('live metronome lifecycle', () => {
  it('starts only on request, schedules lookahead and visuals, applies settings and cancels every pending node', async () => {
    const h = liveHarness();
    expect(h.context.createOscillator).not.toHaveBeenCalled();
    h.metronome.configure({ accent: '4:4' });
    expect(await h.metronome.start()).toBe(true);
    expect(await h.metronome.start()).toBe(true);
    expect(h.options.createAudioContext).toHaveBeenCalledTimes(1);
    expect(h.metronome.state).toBe('playing');
    expect(h.context.createOscillator).toHaveBeenCalledTimes(1);
    expect(h.onBeat).not.toHaveBeenCalled();
    h.advance(50);
    expect(h.onBeat).toHaveBeenCalledWith({ step: 0, time: 0.05, accent: true });
    h.metronome.configure({ spm: 120, sound: 'beep' });
    h.advance(300);
    expect(h.context.createOscillator).toHaveBeenCalledTimes(2);
    h.metronome.stop();
    expect(h.metronome.state).toBe('stopped');
    expect(h.tasks.size).toBe(0);
    for (const result of h.context.createOscillator.mock.results) {
      expect(result.value.stop).toHaveBeenLastCalledWith(0.35);
      expect(result.value.disconnect).toHaveBeenCalledOnce();
    }
    h.advance(1000);
    expect(h.onBeat).toHaveBeenCalledTimes(1);
    h.metronome.stop();
    expect(await h.metronome.start()).toBe(true);
    h.advance(50);
    expect(h.onBeat.mock.lastCall![0].step).toBe(0);
  });

  it('does not burst old audio or visuals after a delayed scheduler tick', async () => {
    const h = liveHarness();
    await h.metronome.start();
    h.advance(10000, true);
    expect(h.context.createOscillator).toHaveBeenCalledTimes(2);
    expect(h.onBeat).not.toHaveBeenCalled();
    const latest = h.context.createOscillator.mock.results.at(-1)!.value;
    expect(latest.start.mock.lastCall![0]).toBeGreaterThanOrEqual(10);
    h.advance(100);
    expect(h.onBeat).toHaveBeenCalledTimes(1);
  });

  it('ignores a callback already queued by the host when a stopped player starts again', async () => {
    const h = liveHarness();
    await h.metronome.start();
    const queued = [...h.tasks.values()];
    h.metronome.stop();
    await h.metronome.start();
    queued.forEach(task => task.callback());
    expect(h.onBeat).not.toHaveBeenCalled();
    expect(h.context.createOscillator).toHaveBeenCalledTimes(2);
  });

  it('coalesces starts, invalidates deferred resumes, and never autoplays after a rapid stop', async () => {
    const h = liveHarness();
    h.context.state = 'suspended';
    let resume!: () => void;
    h.context.resume.mockImplementation(() => new Promise<void>(resolve => { resume = resolve; }));
    const pending = h.metronome.start();
    expect(h.metronome.start()).toBe(pending);
    expect(h.metronome.state).toBe('starting');
    h.metronome.stop();
    h.context.state = 'running';
    resume();
    expect(await pending).toBe(false);
    expect(h.context.createOscillator).not.toHaveBeenCalled();
    expect(h.tasks.size).toBe(0);
    expect(await h.metronome.start()).toBe(true);
  });

  it('reports resume failures and supports retry, including resumed-but-still-suspended contexts', async () => {
    const h = liveHarness();
    h.context.state = 'suspended';
    h.context.resume.mockRejectedValueOnce(new Error('permission'));
    await expect(h.metronome.start()).rejects.toMatchObject({ code: 'audioResumeFailed' });
    expect(h.metronome.state).toBe('stopped');
    h.context.resume.mockResolvedValueOnce(undefined);
    await expect(h.metronome.start()).rejects.toMatchObject({ code: 'audioResumeFailed' });
    expect(await h.metronome.start()).toBe(true);
    expect(h.context.resume).toHaveBeenCalledTimes(3);
  });

  it('does not surface a stale rejected resume after cancellation', async () => {
    const h = liveHarness();
    h.context.state = 'suspended';
    let reject!: (reason: Error) => void;
    h.context.resume.mockImplementation(() => new Promise((_resolve, fail) => { reject = fail; }));
    const request = h.metronome.start();
    h.metronome.stop();
    reject(new Error('cancelled gesture'));
    expect(await request).toBe(false);
    expect(h.onError).not.toHaveBeenCalled();
  });

  it('reports unavailable audio, scheduler failures, and replaces a closed context on retry', async () => {
    const h = liveHarness();
    h.options.createAudioContext.mockImplementationOnce(() => { throw new Error('unsupported'); });
    await expect(h.metronome.start()).rejects.toMatchObject({ code: 'audioUnavailable' });
    await h.metronome.start();
    h.context.state = 'closed';
    h.advance(25);
    expect(h.onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'audioUnavailable' }));
    h.context.state = 'suspended';
    await h.metronome.start();
    h.context.createGain.mockImplementationOnce(() => { throw new Error('device failure'); });
    h.advance(400);
    expect(h.metronome.state).toBe('stopped');
    expect(h.onError).toHaveBeenCalledTimes(2);
    h.context.state = 'closed';
    await h.metronome.start();
    expect(h.options.createAudioContext).toHaveBeenCalledTimes(3);
  });

  it('cleans natural completions and snap nodes once, and suppresses visuals while suspended', async () => {
    const h = liveHarness();
    h.metronome.configure({ sound: 'snap' });
    await h.metronome.start();
    const source = h.context.createBufferSource.mock.results[0].value;
    source.onended!();
    source.onended!();
    h.context.state = 'suspended';
    h.advance(50);
    expect(h.onBeat).not.toHaveBeenCalled();
    h.metronome.stop();
    expect(source.disconnect).toHaveBeenCalledOnce();
    expect(h.context.createBiquadFilter.mock.results[0].value.disconnect).toHaveBeenCalledOnce();
    expect(source.stop).toHaveBeenCalledTimes(1);
    const noBeat = createCadenceMetronome({ ...h.options, onBeat: undefined });
    await noBeat.start();
    h.advance(50);
    noBeat.stop();
  });

  it.each([
    { spm: 119 }, { spm: 211 }, { spm: NaN }, { spm: 180.5 },
    { sound: 'piano' }, { accent: '3:4' }, { profile: 'unknown' },
  ])('rejects invalid configuration without starting: %j', settings => {
    const h = liveHarness();
    expect(() => h.metronome.configure(settings as any)).toThrow(expect.objectContaining({ code: 'invalidSettings' }));
    expect(() => createCadenceMetronome({ ...h.options, settings: settings as any })).toThrow(CadenceAudioError);
    expect(h.context.createGain).not.toHaveBeenCalled();
  });
});

describe('audio export and WAV serialization', () => {
  it.each(['standard', 'warm'] as const)('retains all four existing sound envelopes for the %s profile', async profile => {
    vi.spyOn(Math, 'random').mockReturnValue(1);
    try {
      for (const sound of ['wood', 'beep', 'snap', 'kick'] as const) {
        const h = offlineHarness();
        const result = await renderCadenceAudio({ durationSeconds: 1, quality: 'wav-16k', spm: 120, sound, accent: '2:4', profile }, h.adapters);
        expect(result.settings).toEqual({ spm: 120, sound, accent: '2:4', profile });
        expect(result.data.byteLength).toBe(44 + 32000);
        expect(h.context.createGain).toHaveBeenCalledTimes(2);
        const gains = h.context.createGain.mock.results.map(r => r.value.gain.setValueAtTime.mock.calls[0][0]);
        const expected = {
          wood: [0.9, 0.7], beep: [0.8, profile === 'warm' ? 0.6 : 0.5],
          snap: profile === 'warm' ? [0.85, 0.6] : [0.8, 0.5],
          kick: [1, profile === 'warm' ? 0.8 : 0.7],
        };
        expect(gains).toEqual(expected[sound]);
        if (sound === 'snap') {
          expect(h.context.createOscillator).not.toHaveBeenCalled();
          const samples = h.context.createBufferSource.mock.results[0].value.buffer.getChannelData(0);
          expect(samples[0]).toBe(1);
          expect(samples.at(-1)).toBeCloseTo(profile === 'warm' ? Math.exp(-(samples.length - 1) / (samples.length * 0.2)) : 1);
        } else {
          expect(h.context.createOscillator).toHaveBeenCalledTimes(2);
          expect(h.context.createOscillator.mock.results[0].value.start).toHaveBeenCalledWith(0.05);
        }
      }
    } finally { vi.restoreAllMocks(); }
  });

  it('serializes exact 16-bit PCM headers, clipping, signed samples, and non-finite samples', async () => {
    const bytes = await serializeMonoWav(new Float32Array([-2, -1, -0.5, 0, 0.5, 1, 2, NaN, Infinity]), 44100, { yieldControl: async () => {} });
    const view = new DataView(bytes.buffer);
    expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe('RIFF');
    expect(new TextDecoder().decode(bytes.subarray(8, 12))).toBe('WAVE');
    expect(new TextDecoder().decode(bytes.subarray(12, 16))).toBe('fmt ');
    expect(new TextDecoder().decode(bytes.subarray(36, 40))).toBe('data');
    expect([view.getUint32(4, true), view.getUint32(16, true), view.getUint16(20, true), view.getUint16(22, true)])
      .toEqual([54, 16, 1, 1]);
    expect([view.getUint32(24, true), view.getUint32(28, true), view.getUint16(32, true), view.getUint16(34, true), view.getUint32(40, true)])
      .toEqual([44100, 88200, 2, 16, 18]);
    expect(Array.from({ length: 9 }, (_, i) => view.getInt16(44 + i * 2, true)))
      .toEqual([-32768, -32768, -16384, 0, 16383, 32767, 32767, 0, 0]);
  });

  it('retains unsigned 8-bit support and yields between large PCM chunks', async () => {
    const control = { yieldControl: vi.fn(async () => {}) };
    const bytes = await serializeMonoWav(new Float32Array([-2, -1, 0, 1, 2, NaN]), 16000, control, 8);
    expect([...bytes.subarray(44)]).toEqual([0, 0, 127, 255, 255, 127]);
    expect(new DataView(bytes.buffer).getUint32(28, true)).toBe(16000);
    const odd = await serializeMonoWav(new Float32Array([0, 1, -1]), 8000, control, 8);
    expect(odd.length).toBe(48);
    expect(new DataView(odd.buffer).getUint32(4, true)).toBe(40);
    expect(new DataView(odd.buffer).getUint32(40, true)).toBe(3);
    expect(odd.at(-1)).toBe(0);
    await serializeMonoWav(new Float32Array(65537), 16000, control);
    expect(control.yieldControl).toHaveBeenCalledTimes(5);
  });

  it('snapshots settings, yields during graph creation, and never mutates the caller request', async () => {
    const h = offlineHarness();
    const request = { durationSeconds: 60, quality: 'wav-44k' as const, spm: 210, accent: '4:4' as const };
    h.adapters.yieldControl = vi.fn(async () => { request.spm = 120; });
    const result = await renderCadenceAudio(request, h.adapters);
    expect(result.settings.spm).toBe(210);
    expect(h.context.createOscillator).toHaveBeenCalledTimes(210);
    expect(result.sampleRate).toBe(44100);
    expect(result.extension).toBe('wav');
    expect(result.mimeType).toBe('audio/wav');
    expect(h.adapters.yieldControl).toHaveBeenCalled();
  });

  it.each([64, 128])('encodes MP3 in bounded PCM blocks at %i kbps and copies mutable encoder buffers', async bitrate => {
    const h = offlineHarness();
    let calls = 0;
    const shared = new Int8Array([1, -1]);
    const encoder = {
      encodeBuffer: vi.fn((pcm: Int16Array) => {
        expect(pcm.length).toBeLessThanOrEqual(1152);
        calls++;
        shared[0] = calls;
        return calls === 1 ? new Uint8Array(0) : shared;
      }),
      flush: vi.fn(() => new Uint8Array([42])),
    };
    h.adapters.createMp3Encoder = vi.fn(() => encoder);
    const result = await renderCadenceAudio({ durationSeconds: 1, quality: `mp3-${bitrate}` as any }, h.adapters);
    expect(h.adapters.createMp3Encoder).toHaveBeenCalledWith(44100, bitrate);
    expect(encoder.encodeBuffer).toHaveBeenCalledTimes(39);
    expect(encoder.encodeBuffer.mock.lastCall![0].length).toBe(324);
    expect([...result.data.subarray(0, 4)]).toEqual([2, 255, 3, 255]);
    expect(result.data.at(-1)).toBe(42);
    expect(result.mimeType).toBe('audio/mpeg');
    expect(result.extension).toBe('mp3');
    expect(h.adapters.yieldControl).toHaveBeenCalledTimes(3);
  });

  it('rejects absent or empty MP3 encoders and surfaces encoder failures', async () => {
    const h = offlineHarness();
    await expect(renderCadenceAudio({ durationSeconds: 900, quality: 'mp3-64' }, h.adapters)).rejects.toMatchObject({ code: 'mp3Unavailable' });
    expect(h.adapters.createOfflineContext).not.toHaveBeenCalled();
    h.adapters.createMp3Encoder = () => ({ encodeBuffer: () => new Int8Array(0), flush: () => new Int8Array(0) });
    await expect(renderCadenceAudio({ durationSeconds: 1, quality: 'mp3-64' }, h.adapters)).rejects.toMatchObject({ code: 'renderFailed' });
    h.adapters.createMp3Encoder = () => { throw new Error('broken codec'); };
    await expect(renderCadenceAudio({ durationSeconds: 1, quality: 'mp3-64' }, h.adapters)).rejects.toMatchObject({ code: 'renderFailed', cause: expect.any(Error) });
  });

  it.each([0, -1, 901, 1.5, NaN, Infinity])('rejects invalid duration %s before allocating resources', async durationSeconds => {
    const h = offlineHarness();
    await expect(renderCadenceAudio({ durationSeconds, quality: 'wav-16k' }, h.adapters)).rejects.toMatchObject({ code: 'invalidDuration' });
    expect(h.adapters.createOfflineContext).not.toHaveBeenCalled();
  });

  it('rejects unsupported quality and malformed rendering output', async () => {
    const h = offlineHarness();
    await expect(renderCadenceAudio({ durationSeconds: 1, quality: 'wav-8k' as any }, h.adapters)).rejects.toMatchObject({ code: 'invalidQuality' });
    const factory = h.adapters.createOfflineContext;
    h.adapters.createOfflineContext = (...args) => ({
      ...factory(...args),
      startRendering: async () => ({ sampleRate: 16000, getChannelData: () => new Float32Array(1) }),
    });
    await expect(renderCadenceAudio({ durationSeconds: 1, quality: 'wav-16k' }, h.adapters)).rejects.toMatchObject({ code: 'invalidPcm' });
    h.adapters.createOfflineContext = (...args) => ({
      ...factory(...args),
      startRendering: async () => ({ sampleRate: 44100, getChannelData: () => new Float32Array(16000) }),
    });
    await expect(renderCadenceAudio({ durationSeconds: 1, quality: 'wav-16k' }, h.adapters)).rejects.toMatchObject({ code: 'invalidPcm' });
  });

  it('cancels before allocation, graph rendering, WAV conversion, and MP3 flush', async () => {
    for (const quality of ['wav-16k', 'mp3-64'] as const) {
      for (const abortAt of [0, 1, 2]) {
        const h = offlineHarness();
        const controller = new AbortController();
        h.adapters.signal = controller.signal;
        h.adapters.createMp3Encoder = () => ({ encodeBuffer: () => new Uint8Array([1]), flush: vi.fn(() => new Uint8Array([1])) });
        let yields = 0;
        h.adapters.yieldControl = async () => { if (++yields === abortAt) controller.abort(); };
        if (abortAt === 0) controller.abort();
        await expect(renderCadenceAudio({ durationSeconds: 1, quality }, h.adapters)).rejects.toMatchObject({ code: 'aborted' });
      }
    }
    const h = offlineHarness();
    const controller = new AbortController();
    h.adapters.signal = controller.signal;
    h.adapters.yieldControl = async () => { controller.abort(); };
    await expect(renderCadenceAudio({ durationSeconds: 60, quality: 'wav-16k' }, h.adapters)).rejects.toMatchObject({ code: 'aborted' });
    expect(h.rendered).not.toHaveBeenCalled();
  });

  it.each([
    [0, 16], [7999, 16], [192001, 16], [16000.5, 16], [NaN, 16], [16000, 24],
  ])('rejects malformed PCM sample rate/depth %s/%s', async (rate, depth) => {
    await expect(serializeMonoWav(new Float32Array([0]), rate, { yieldControl: async () => {} }, depth as any))
      .rejects.toMatchObject({ code: 'invalidPcm' });
  });

  it('rejects empty and oversized PCM and provides every error in both locales', async () => {
    for (const samples of [new Float32Array(0), { length: 44100 * 900 + 1 } as Float32Array]) {
      await expect(serializeMonoWav(samples, 16000, { yieldControl: async () => {} })).rejects.toMatchObject({ code: 'invalidPcm' });
    }
    expect(Object.keys(cadenceAudioMessages.en.errors)).toEqual(Object.keys(cadenceAudioMessages.zh.errors));
    expect(JSON.stringify(cadenceAudioMessages.en)).not.toMatch(/[\u3400-\u9fff]/u);
    expect(new CadenceAudioError('aborted').name).toBe('CadenceAudioError');
  });
});
