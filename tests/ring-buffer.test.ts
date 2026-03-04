import { describe, expect, it } from 'bun:test';
import {
  createRingBuffer,
  nextPow2,
  ringBufferAvailable,
  ringBufferRead,
  ringBufferWrite,
} from '../src/ring-buffer';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

describe('nextPow2', () => {
  it('rounds up to nearest power of 2', () => {
    expect(nextPow2(1)).toBe(1);
    expect(nextPow2(2)).toBe(2);
    expect(nextPow2(3)).toBe(4);
    expect(nextPow2(5)).toBe(8);
    expect(nextPow2(1000)).toBe(1024);
    expect(nextPow2(1025)).toBe(2048);
  });
});

describe('ring buffer', () => {
  it('writes and reads a single message', () => {
    const rb = createRingBuffer(1024);
    const msg = encoder.encode('hello world\n');
    const written = ringBufferWrite(rb, msg, msg.length);
    expect(written).toBe(true);

    const out = new Uint8Array(1024);
    const readLen = ringBufferRead(rb, out, out.length);
    expect(readLen).toBe(msg.length);
    expect(decoder.decode(out.subarray(0, readLen))).toBe('hello world\n');
  });

  it('reports available bytes', () => {
    const rb = createRingBuffer(1024);
    expect(ringBufferAvailable(rb)).toBe(0);

    const msg = encoder.encode('test');
    ringBufferWrite(rb, msg, msg.length);
    expect(ringBufferAvailable(rb)).toBe(4);

    const out = new Uint8Array(1024);
    ringBufferRead(rb, out, out.length);
    expect(ringBufferAvailable(rb)).toBe(0);
  });

  it('handles multiple writes and reads', () => {
    const rb = createRingBuffer(1024);
    const messages = ['msg1\n', 'msg2\n', 'msg3\n'];

    for (const m of messages) {
      const data = encoder.encode(m);
      ringBufferWrite(rb, data, data.length);
    }

    const out = new Uint8Array(1024);
    const readLen = ringBufferRead(rb, out, out.length);
    const content = decoder.decode(out.subarray(0, readLen));
    expect(content).toBe('msg1\nmsg2\nmsg3\n');
  });

  it('returns false when buffer is full', () => {
    const rb = createRingBuffer(1024);
    const bigMsg = new Uint8Array(1024);
    bigMsg.fill(0x41); // 'A'
    const written = ringBufferWrite(rb, bigMsg, bigMsg.length);
    expect(written).toBe(true);

    const oneMore = new Uint8Array([0x42]);
    expect(ringBufferWrite(rb, oneMore, oneMore.length)).toBe(false);
  });

  it('handles wrap-around correctly', () => {
    const rb = createRingBuffer(1024);

    const first = new Uint8Array(800);
    first.fill(0x41); // 'A'
    ringBufferWrite(rb, first, first.length);

    const out1 = new Uint8Array(1024);
    ringBufferRead(rb, out1, out1.length);

    const second = new Uint8Array(500);
    second.fill(0x42); // 'B'
    const written = ringBufferWrite(rb, second, second.length);
    expect(written).toBe(true);

    const out2 = new Uint8Array(1024);
    const readLen = ringBufferRead(rb, out2, out2.length);
    expect(readLen).toBe(500);
    for (let i = 0; i < 500; i++) {
      expect(out2[i]).toBe(0x42);
    }
  });
});
