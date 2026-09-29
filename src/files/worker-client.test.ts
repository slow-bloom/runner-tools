import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFileConverterClient } from './worker-client.js';
import { handleFileWorkerRequest, type FileWorkerRequest } from './worker-protocol.js';
import { FileConversionError } from './converter.js';

class TestWorker extends EventTarget {
  static instances: TestWorker[] = [];
  requests: FileWorkerRequest[] = [];
  terminate = vi.fn();
  postMessage = vi.fn((request: FileWorkerRequest) => { this.requests.push(request); });

  constructor(public url: string | URL) {
    super();
    TestWorker.instances.push(this);
  }

  complete(index: number) {
    this.dispatchEvent(new MessageEvent('message', {
      data: structuredClone(handleFileWorkerRequest(this.requests[index])),
    }));
  }
}

const gpx = '<gpx><trk><trkseg><trkpt lat="0" lon="0"><time>2026-09-29T00:00:00Z</time></trkpt></trkseg></trk></gpx>';

describe('file worker client', () => {
  beforeEach(() => {
    TestWorker.instances = [];
    vi.stubGlobal('Worker', TestWorker);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('loads the local worker and correlates out-of-order results', async () => {
    const client = createFileConverterClient('/js/runner-tools.worker.js');
    const worker = TestWorker.instances[0];
    expect(worker.url).toBe('/js/runner-tools.worker.js');
    const first = client.parse(gpx, 'gpx');
    const second = client.parse(gpx, 'gpx', { locale: 'zh' });
    worker.complete(1);
    worker.complete(0);
    expect((await first).name).toBe('Activity');
    const activity = await second;
    expect(activity.name).toBe('运动记录');
    expect(activity.points[0].time).toBeInstanceOf(Date);

    const processing = client.process([activity], { stripGPS: true });
    worker.complete(2);
    const processed = await processing;
    const exporting = client.serialize(processed.activity, 'csv');
    worker.complete(3);
    expect((await exporting).mimeType).toBe('text/csv');
    client.dispose();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('surfaces conversion errors with their localization code', async () => {
    const client = createFileConverterClient('/worker.js');
    const promise = client.parse('<gpx/>', 'gpx');
    const rejection = expect(promise).rejects.toMatchObject({
      name: 'FileConversionError',
      code: 'no-trackpoints',
    });
    TestWorker.instances[0].complete(0);
    await rejection;
    client.dispose();
  });

  it('rejects in-flight and subsequent work after worker load errors', async () => {
    const client = createFileConverterClient('/missing-worker.js');
    const promise = client.parse(gpx, 'gpx');
    const rejection = expect(promise).rejects.toThrow(/could not start/);
    TestWorker.instances[0].dispatchEvent(new Event('error'));
    await rejection;
    await expect(client.parse(gpx, 'gpx')).rejects.toThrow(/could not start/);
  });

  it('rejects unreadable worker messages and explicit disposal without hanging', async () => {
    const client = createFileConverterClient('/worker.js');
    const promise = client.parse(gpx, 'gpx');
    const rejection = expect(promise).rejects.toThrow(/unreadable data/);
    TestWorker.instances[0].dispatchEvent(new Event('messageerror'));
    await rejection;
    const other = createFileConverterClient('/worker.js');
    const pending = other.parse(gpx, 'gpx');
    const disposed = expect(pending).rejects.toThrow(/disposed/);
    other.dispose();
    await disposed;
    await expect(other.parse(gpx, 'gpx')).rejects.toThrow(/disposed/);
  });

  it('surfaces postMessage failures instead of leaving an unresolved request', async () => {
    const client = createFileConverterClient('/worker.js');
    TestWorker.instances[0].postMessage.mockImplementation(() => {
      throw new DOMException('Cannot clone input', 'DataCloneError');
    });
    await expect(client.parse(gpx, 'gpx')).rejects.toThrow(/Cannot clone input/);
    client.dispose();
  });

  it('keeps thrown library errors distinguishable from successful worker replies', () => {
    const response = handleFileWorkerRequest({
      id: 7,
      operation: 'process',
      activities: [],
    });
    expect(response).toMatchObject({
      id: 7,
      ok: false,
      error: { name: FileConversionError.name, code: 'no-trackpoints' },
    });
  });

  it('ignores unrelated responses without losing the pending request', async () => {
    const client = createFileConverterClient('/worker.js');
    const pending = client.parse(gpx, 'gpx');
    const worker = TestWorker.instances[0];
    worker.dispatchEvent(new MessageEvent('message', { data: { id: 999, ok: false, error: { name: 'Error', message: 'Unrelated' } } }));
    worker.complete(0);
    expect((await pending).points).toHaveLength(1);
    client.dispose();
  });

  it('rejects unexpected operation responses for each public method', async () => {
    const client = createFileConverterClient('/worker.js');
    const worker = TestWorker.instances[0];
    const parsed = handleFileWorkerRequest({ id: 0, operation: 'parse', data: gpx, format: 'gpx' });
    if (!parsed.ok || parsed.result.operation !== 'parse') throw new Error('Invalid test activity');
    const { activity } = parsed.result;
    const results = [
      client.parse(gpx, 'gpx'),
      client.process([activity]),
      client.serialize(activity, 'csv'),
    ];
    const rejections = results.map((result) => expect(result).rejects.toThrow(/Unexpected file worker response/));
    for (let index = 0; index < results.length; index++) {
      worker.dispatchEvent(new MessageEvent('message', {
        data: {
          id: index + 1,
          ok: true,
          result: index === 2 ? { operation: 'parse', activity }
            : { operation: 'serialize', file: { data: '', mimeType: 'text/csv', extension: 'csv' } },
        },
      }));
    }
    await Promise.all(rejections);
    client.dispose();
  });

  it('preserves technical errors without conversion codes', async () => {
    const client = createFileConverterClient('/worker.js');
    const pending = client.parse(gpx, 'gpx');
    const rejection = expect(pending).rejects.toMatchObject({ name: 'RangeError', message: 'Invalid FIT record' });
    TestWorker.instances[0].dispatchEvent(new MessageEvent('message', {
      data: { id: 1, ok: false, error: { name: 'RangeError', message: 'Invalid FIT record' } },
    }));
    await rejection;
    client.dispose();
  });

  it('reports worker load error details and unknown protocol operations', async () => {
    const client = createFileConverterClient('/worker.js');
    const pending = client.parse(gpx, 'gpx');
    const rejection = expect(pending).rejects.toThrow(/Blocked by policy/);
    const event = new Event('error');
    Object.defineProperty(event, 'message', { value: 'Blocked by policy' });
    TestWorker.instances[0].dispatchEvent(event);
    await rejection;
    const response = handleFileWorkerRequest({
      id: 8,
      // @ts-expect-error Invalid operation sent by a JavaScript consumer.
      operation: 'unknown',
    });
    expect(response).toMatchObject({
      id: 8, ok: false, error: { message: 'Unknown file worker operation.' },
    });
  });
});
