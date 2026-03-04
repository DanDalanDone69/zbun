import type { Transport } from './types';

export class SyncTransport implements Transport {
  private writer: ReturnType<ReturnType<typeof Bun.file>['writer']> | null = null;
  private isStdout: boolean;

  constructor(target: string) {
    this.isStdout = target === 'stdout';
    if (!this.isStdout) {
      this.writer = Bun.file(target).writer({ highWaterMark: 65536 });
    }
  }

  write(buf: Uint8Array, len: number): void {
    const slice = buf.subarray(0, len);
    if (this.writer) {
      this.writer.write(slice);
    } else {
      Bun.write(Bun.stdout, slice);
    }
  }

  flush(): Promise<void> {
    if (this.writer) {
      this.writer.flush();
    }
    return Promise.resolve();
  }

  close(): Promise<void> {
    if (this.writer) {
      this.writer.flush();
      this.writer.end();
    }
    return Promise.resolve();
  }
}
