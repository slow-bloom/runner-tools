import type { Activity, ParseTrackOptions } from './types.js';
import {
  FileConversionError,
  parseActivityFile,
  processActivities,
  serializeActivity,
  type FileConversionErrorCode,
  type ProcessActivitiesOptions,
  type ProcessedActivity,
  type SerializeActivityOptions,
  type SerializedActivity,
  type TrackFileData,
  type TrackFileInputFormat,
  type TrackFileOutputFormat,
} from './converter.js';

export type FileWorkerCommand =
  | { operation: 'parse'; data: TrackFileData; format: TrackFileInputFormat; options?: ParseTrackOptions }
  | { operation: 'process'; activities: Activity[]; options?: ProcessActivitiesOptions }
  | { operation: 'serialize'; activity: Activity; format: TrackFileOutputFormat; options?: SerializeActivityOptions };

export type FileWorkerRequest = FileWorkerCommand & { id: number };

export type FileWorkerResult =
  | { operation: 'parse'; activity: Activity }
  | { operation: 'process'; result: ProcessedActivity }
  | { operation: 'serialize'; file: SerializedActivity };

export type FileWorkerResponse =
  | { id: number; ok: true; result: FileWorkerResult }
  | { id: number; ok: false; error: { name: string; message: string; code?: FileConversionErrorCode } };

/** Shared by the standalone worker and tests; all failures cross the seam explicitly. */
export function handleFileWorkerRequest(request: FileWorkerRequest): FileWorkerResponse {
  try {
    let result: FileWorkerResult;
    switch (request.operation) {
      case 'parse':
        result = { operation: 'parse', activity: parseActivityFile(request.data, request.format, request.options) };
        break;
      case 'process':
        result = { operation: 'process', result: processActivities(request.activities, request.options) };
        break;
      case 'serialize':
        result = { operation: 'serialize', file: serializeActivity(request.activity, request.format, request.options) };
        break;
      default:
        throw new Error('Unknown file worker operation.');
    }
    return { id: request.id, ok: true, result };
  } catch (error) {
    return {
      id: request.id,
      ok: false,
      error: {
        name: error instanceof Error ? error.name : 'Error',
        message: error instanceof Error ? error.message : String(error),
        ...(error instanceof FileConversionError ? { code: error.code } : {}),
      },
    };
  }
}
