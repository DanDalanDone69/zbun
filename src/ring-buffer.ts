export function nextPow2(n: number): number {
  let v = n - 1;
  v |= v >> 1;
  v |= v >> 2;
  v |= v >> 4;
  v |= v >> 8;
  v |= v >> 16;
  return v + 1;
}

const CONTROL_BYTES = 8;

export interface RingBufferState {
  sab: SharedArrayBuffer;
  ctrl: Int32Array;
  data: Uint8Array;
  capacity: number;
  capacityMask: number;
}

export function createRingBuffer(requestedSize: number): RingBufferState {
  const capacity = nextPow2(Math.max(requestedSize, 1024)); // minimum 1KB
  const sab = new SharedArrayBuffer(CONTROL_BYTES + capacity);
  const ctrl = new Int32Array(sab, 0, 2);
  const data = new Uint8Array(sab, CONTROL_BYTES);

  Atomics.store(ctrl, 0, 0); // writeHead = 0
  Atomics.store(ctrl, 1, 0); // readTail = 0

  return { sab, ctrl, data, capacity, capacityMask: capacity - 1 };
}

export function attachRingBuffer(sab: SharedArrayBuffer): RingBufferState {
  const ctrl = new Int32Array(sab, 0, 2);
  const data = new Uint8Array(sab, CONTROL_BYTES);
  const capacity = data.length;
  return { sab, ctrl, data, capacity, capacityMask: capacity - 1 };
}

export function ringBufferWrite(rb: RingBufferState, src: Uint8Array, len: number): boolean {
  const head = Atomics.load(rb.ctrl, 0);
  const tail = Atomics.load(rb.ctrl, 1);
  const available = rb.capacity - (head - tail);

  if (len > available) {
    return false;
  }

  const startIdx = head & rb.capacityMask;
  const endIdx = startIdx + len;

  if (endIdx <= rb.capacity) {
    rb.data.set(src.subarray(0, len), startIdx);
  } else {
    const firstPart = rb.capacity - startIdx;
    rb.data.set(src.subarray(0, firstPart), startIdx);
    rb.data.set(src.subarray(firstPart, len), 0);
  }

  Atomics.store(rb.ctrl, 0, head + len);
  Atomics.notify(rb.ctrl, 0);

  return true;
}

export function ringBufferRead(rb: RingBufferState, output: Uint8Array, maxLen: number): number {
  const head = Atomics.load(rb.ctrl, 0);
  const tail = Atomics.load(rb.ctrl, 1);
  const available = head - tail;

  if (available === 0) return 0;

  const readLen = Math.min(available, maxLen);
  const startIdx = tail & rb.capacityMask;
  const endIdx = startIdx + readLen;

  if (endIdx <= rb.capacity) {
    output.set(rb.data.subarray(startIdx, startIdx + readLen));
  } else {
    const firstPart = rb.capacity - startIdx;
    output.set(rb.data.subarray(startIdx, rb.capacity));
    output.set(rb.data.subarray(0, readLen - firstPart), firstPart);
  }

  Atomics.store(rb.ctrl, 1, tail + readLen);

  if (head === tail + readLen) {
    const currentHead = Atomics.load(rb.ctrl, 0);
    if (currentHead === tail + readLen) {
      Atomics.store(rb.ctrl, 1, 0);
      Atomics.store(rb.ctrl, 0, 0);
    }
  }

  return readLen;
}

export function ringBufferAvailable(rb: RingBufferState): number {
  const head = Atomics.load(rb.ctrl, 0);
  const tail = Atomics.load(rb.ctrl, 1);
  return head - tail;
}

export function ringBufferWait(
  rb: RingBufferState,
  timeoutMs: number,
): 'ok' | 'timed-out' | 'not-equal' {
  const head = Atomics.load(rb.ctrl, 0);
  return Atomics.wait(rb.ctrl, 0, head, timeoutMs);
}
