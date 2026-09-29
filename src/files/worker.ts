import { handleFileWorkerRequest, type FileWorkerRequest } from './worker-protocol.js';

globalThis.addEventListener('message', (event: MessageEvent<FileWorkerRequest>) => {
  const response = handleFileWorkerRequest(event.data);
  const transfer: Transferable[] = [];
  if (response.ok && response.result.operation === 'serialize') {
    const data = response.result.file.data;
    if (data instanceof Uint8Array && data.buffer instanceof ArrayBuffer) transfer.push(data.buffer);
  }
  globalThis.postMessage(response, { transfer });
});
