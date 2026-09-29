import { beforeAll, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { once } from 'node:events';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import type { FileWorkerRequest, FileWorkerResponse } from './worker-protocol.js';

let workerCode: string;

beforeAll(async () => {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL('./worker.ts', import.meta.url))],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    write: false,
  });
  workerCode = `
    const { parentPort } = require('node:worker_threads');
    globalThis.addEventListener = (name, listener) => {
      if (name !== 'message') throw new Error('Unexpected worker event');
      parentPort.on('message', data => listener({ data }));
    };
    globalThis.postMessage = (data, options) => parentPort.postMessage(data, options.transfer);
    globalThis.fetch = () => { throw new Error('File conversion must not access the network'); };
    ${bundle.outputFiles[0].text}
  `;
});

async function request(worker: Worker, command: FileWorkerRequest): Promise<FileWorkerResponse> {
  const response = once(worker, 'message');
  worker.postMessage(command);
  const messages: FileWorkerResponse[] = await response;
  return messages[0];
}

describe('standalone file worker bundle', () => {
  it('parses, processes and exports every supported download in an isolated worker', async () => {
    const worker = new Worker(workerCode, { eval: true });
    const csv = 'Timestamp,Latitude,Longitude,Elevation(m),Distance(m),HeartRate(bpm),Cadence(spm),Speed(m/s),Power(w)\n' +
      '2026-09-29T00:00:00Z,0,0,10,0,140,170,3,200\n' +
      '2026-09-29T00:00:10Z,0,0.0003,11,30,145,171,3,210\n' +
      '2026-09-29T00:00:20Z,0,0.0006,12,60,150,172,3,220\n';
    try {
      const parsed = await request(worker, {
        id: 1, operation: 'parse', format: 'csv', data: new TextEncoder().encode(csv),
      });
      expect(parsed.ok).toBe(true);
      if (!parsed.ok || parsed.result.operation !== 'parse') throw new Error('Parse failed');
      expect(parsed.result.activity.points[0].time).toBeInstanceOf(Date);
      const processed = await request(worker, {
        id: 2,
        operation: 'process',
        activities: [parsed.result.activity],
        options: { cropStartMeters: 30 },
      });
      if (!processed.ok || processed.result.operation !== 'process') throw new Error('Processing failed');
      expect(processed.result.result.activity.summary.distance).toBe(30);
      for (const format of ['fit', 'gpx', 'tcx', 'kml', 'csv', 'geojson'] as const) {
        const serialized = await request(worker, {
          id: 3, operation: 'serialize', format, activity: processed.result.result.activity,
        });
        if (!serialized.ok || serialized.result.operation !== 'serialize') {
          throw new Error(JSON.stringify(serialized));
        }
        expect(serialized.result.file.extension).toBe(format);
        expect(serialized.result.file.data.length).toBeGreaterThan(0);
        if (format === 'fit') {
          expect(serialized.result.file.data).toBeInstanceOf(Uint8Array);
          const roundTrip = await request(worker, {
            id: 4, operation: 'parse', format: 'fit', data: serialized.result.file.data,
          });
          if (!roundTrip.ok || roundTrip.result.operation !== 'parse') throw new Error('FIT round trip failed');
          expect(roundTrip.result.activity.points).toHaveLength(2);
          expect(roundTrip.result.activity.summary.distance).toBe(30);
        }
      }
    } finally {
      await worker.terminate();
    }
  });

  it('returns an explicit failure and remains usable after a malformed upload', async () => {
    const worker = new Worker(workerCode, { eval: true });
    try {
      const failure = await request(worker, { id: 9, operation: 'parse', format: 'fit', data: new ArrayBuffer(1) });
      expect(failure).toMatchObject({ id: 9, ok: false, error: { code: 'invalid-file' } });
      const success = await request(worker, {
        id: 10, operation: 'parse', format: 'gpx', data: '<gpx><trkpt lat="0" lon="0"/></gpx>',
      });
      expect(success).toMatchObject({ id: 10, ok: true });
    } finally {
      await worker.terminate();
    }
  });
});
