import {
  attachRingBuffer,
  type RingBufferState,
  ringBufferAvailable,
  ringBufferRead,
} from './ring-buffer';

let rb: RingBufferState;
let writer: ReturnType<ReturnType<typeof Bun.file>['writer']>;
let running = false;

const BATCH_SIZE = 64 * 1024;
const batchBuf = new Uint8Array(BATCH_SIZE);

self.onmessage = (ev: MessageEvent) => {
  const { type } = ev.data;

  if (type === 'init') {
    rb = attachRingBuffer(ev.data.sab);

    if (ev.data.target === 'stdout') {
      writer = Bun.stdout.writer();
    } else {
      writer = Bun.file(ev.data.target).writer();
    }

    running = true;
    consumeLoop();
  } else if (type === 'flush') {
    drainAndFlush();
    self.postMessage({ type: 'flushed' });
  } else if (type === 'close') {
    running = false;
    drainAndFlush();
    self.postMessage({ type: 'closed' });
  }
};

function consumeLoop(): void {
  while (running) {
    const available = ringBufferAvailable(rb);

    if (available === 0) {
      writer.flush();
      Atomics.wait(rb.ctrl, 0, Atomics.load(rb.ctrl, 0), 100);
      continue;
    }

    const readLen = ringBufferRead(rb, batchBuf, BATCH_SIZE);
    if (readLen > 0) {
      writer.write(batchBuf.subarray(0, readLen));
    }
  }
}

function drainAndFlush(): void {
  let readLen: number;
  do {
    readLen = ringBufferRead(rb, batchBuf, BATCH_SIZE);
    if (readLen > 0) {
      writer.write(batchBuf.subarray(0, readLen));
    }
  } while (readLen > 0);
  writer.flush();
}
