import { createRingBuffer, type RingBufferState, ringBufferWrite } from './ring-buffer';
import { SyncTransport } from './transport-sync';
import type { Transport } from './types';

export class AsyncTransport implements Transport {
  private rb: RingBufferState;
  private worker: Worker;
  private fallback: SyncTransport;

  constructor(target: string, bufferSize?: number) {
    this.rb = createRingBuffer(bufferSize ?? 1024 * 1024);
    this.fallback = new SyncTransport(target);

    this.worker = new Worker(new URL('./worker.ts', import.meta.url).href);
    this.worker.postMessage({
      type: 'init',
      sab: this.rb.sab,
      target,
    });
    this.worker.unref();
  }

  write(buf: Uint8Array, len: number): void {
    const data = buf.subarray(0, len);
    const written = ringBufferWrite(this.rb, data, len);
    if (!written) {
      this.fallback.write(buf, len);
    }
  }

  flush(): Promise<void> {
    return new Promise<void>((resolve) => {
      const handler = (ev: MessageEvent) => {
        if (ev.data?.type === 'flushed') {
          this.worker.removeEventListener('message', handler);
          resolve();
        }
      };
      this.worker.addEventListener('message', handler);
      this.worker.postMessage({ type: 'flush' });
    });
  }

  close(): Promise<void> {
    return new Promise<void>((resolve) => {
      const handler = (ev: MessageEvent) => {
        if (ev.data?.type === 'closed') {
          this.worker.removeEventListener('message', handler);
          this.worker.terminate();
          resolve();
        }
      };
      this.worker.addEventListener('message', handler);
      this.worker.postMessage({ type: 'close' });
    });
  }
}
