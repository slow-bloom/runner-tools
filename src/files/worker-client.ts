import type { Activity, ParseTrackOptions } from './types.js';
import {
  FileConversionError,
  type ProcessActivitiesOptions,
  type ProcessedActivity,
  type SerializeActivityOptions,
  type SerializedActivity,
  type TrackFileData,
  type TrackFileInputFormat,
  type TrackFileOutputFormat,
} from './converter.js';
import type { FileWorkerCommand, FileWorkerResponse, FileWorkerResult } from './worker-protocol.js';

export interface FileConverterClient {
  parse(data: TrackFileData, format: TrackFileInputFormat, options?: ParseTrackOptions): Promise<Activity>;
  process(activities: Activity[], options?: ProcessActivitiesOptions): Promise<ProcessedActivity>;
  serialize(activity: Activity, format: TrackFileOutputFormat, options?: SerializeActivityOptions): Promise<SerializedActivity>;
  dispose(): void;
}

/** Use the locally hosted runner-tools.worker.js; file contents never leave the browser. */
export function createFileConverterClient(workerURL: string | URL): FileConverterClient {
  const worker = new Worker(workerURL);
  let nextId = 0;
  let failure: Error | null = null;
  const pending = new Map<number, {
    resolve: (result: FileWorkerResult) => void;
    reject: (error: Error) => void;
  }>();

  function fail(error: Error): void {
    failure = error;
    for (const request of pending.values()) request.reject(error);
    pending.clear();
    worker.terminate();
  }

  worker.addEventListener('message', (event: MessageEvent<FileWorkerResponse>) => {
    const response = event.data;
    const request = pending.get(response.id);
    if (!request) return;
    pending.delete(response.id);
    if (response.ok) {
      request.resolve(response.result);
    } else {
      const error = response.error.code
        ? new FileConversionError(response.error.code, response.error.message)
        : new Error(response.error.message);
      error.name = response.error.name;
      request.reject(error);
    }
  });
  worker.addEventListener('error', (event: ErrorEvent) => {
    fail(new Error(event.message || 'The file conversion worker could not start.'));
  });
  worker.addEventListener('messageerror', () => {
    fail(new Error('The file conversion worker returned unreadable data.'));
  });

  function send(command: FileWorkerCommand): Promise<FileWorkerResult> {
    if (failure) return Promise.reject(failure);
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      try {
        worker.postMessage({ ...command, id });
      } catch (error) {
        pending.delete(id);
        reject(error);
      }
    });
  }

  return {
    async parse(data, format, options) {
      const result = await send({ operation: 'parse', data, format, options });
      if (result.operation !== 'parse') throw new Error('Unexpected file worker response.');
      return result.activity;
    },
    async process(activities, options) {
      const result = await send({ operation: 'process', activities, options });
      if (result.operation !== 'process') throw new Error('Unexpected file worker response.');
      return result.result;
    },
    async serialize(activity, format, options) {
      const result = await send({ operation: 'serialize', activity, format, options });
      if (result.operation !== 'serialize') throw new Error('Unexpected file worker response.');
      return result.file;
    },
    dispose() {
      fail(new Error('The file conversion worker has been disposed.'));
    },
  };
}
