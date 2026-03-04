import { describe, expect, it } from 'bun:test';
import { Level } from '../src/constants';
import type { WriteBuffer } from '../src/encoder';
import { LogEvent } from '../src/event';
import { NOOP_EVENT } from '../src/noop-event';
import type { InternalLogger } from '../src/types';

function mockLogger(contextBytes?: Uint8Array | null): InternalLogger & { output: string } {
  const pool: WriteBuffer[] = [];
  const mock = {
    levelNum: Level.TRACE,
    contextBytes: contextBytes ?? null,
    output: '',
    acquireBuffer(): WriteBuffer {
      return pool.pop() || { buf: new Uint8Array(8192), pos: 0 };
    },
    releaseBuffer(wb: WriteBuffer): void {
      wb.pos = 0;
      pool.push(wb);
    },
    dispatch(buf: Uint8Array, len: number): void {
      mock.output += new TextDecoder().decode(buf.subarray(0, len));
    },
  };
  return mock;
}

describe('LogEvent', () => {
  it('produces valid JSON with str/int/bool fields', () => {
    const logger = mockLogger();
    const event = new LogEvent(logger).reset(Level.INFO);
    event.str('module', 'auth').int('userId', 123).bool('ok', true).msg('login');

    const parsed = JSON.parse(logger.output.trim());
    expect(parsed.level).toBe('info');
    expect(parsed.module).toBe('auth');
    expect(parsed.userId).toBe(123);
    expect(parsed.ok).toBe(true);
    expect(parsed.message).toBe('login');
    expect(typeof parsed.time).toBe('number');
  });

  it('handles error objects', () => {
    const logger = mockLogger();
    const event = new LogEvent(logger).reset(Level.ERROR);
    event.err(new Error('test error')).msg('failed');

    const parsed = JSON.parse(logger.output.trim());
    expect(parsed.level).toBe('error');
    expect(parsed.error).toBe('test error');
    expect(typeof parsed.stack).toBe('string');
    expect(parsed.message).toBe('failed');
  });

  it('handles string errors', () => {
    const logger = mockLogger();
    const event = new LogEvent(logger).reset(Level.ERROR);
    event.err('string error').msg('failed');

    const parsed = JSON.parse(logger.output.trim());
    expect(parsed.error).toBe('string error');
  });

  it('.any() handles objects via JSON.stringify', () => {
    const logger = mockLogger();
    const event = new LogEvent(logger).reset(Level.INFO);
    event.any('data', { a: 1, b: 'two' }).msg('test');

    const parsed = JSON.parse(logger.output.trim());
    expect(parsed.data).toEqual({ a: 1, b: 'two' });
  });

  it('.any() handles null', () => {
    const logger = mockLogger();
    const event = new LogEvent(logger).reset(Level.INFO);
    event.any('val', null).msg('test');

    const parsed = JSON.parse(logger.output.trim());
    expect(parsed.val).toBe(null);
  });

  it('.send() produces valid JSON without message field', () => {
    const logger = mockLogger();
    const event = new LogEvent(logger).reset(Level.WARN);
    event.str('key', 'value').send();

    const parsed = JSON.parse(logger.output.trim());
    expect(parsed.level).toBe('warn');
    expect(parsed.key).toBe('value');
    expect(parsed.message).toBeUndefined();
  });

  it('includes pre-computed context bytes', () => {
    const te = new TextEncoder();
    const ctx = te.encode(',"reqId":"abc"');
    const logger = mockLogger(ctx);

    const event = new LogEvent(logger).reset(Level.INFO);
    event.msg('hello');

    const parsed = JSON.parse(logger.output.trim());
    expect(parsed.reqId).toBe('abc');
    expect(parsed.message).toBe('hello');
  });
});

describe('NOOP_EVENT', () => {
  it('returns itself for all chained methods', () => {
    expect(NOOP_EVENT.str('a', 'b')).toBe(NOOP_EVENT);
    expect(NOOP_EVENT.int('a', 1)).toBe(NOOP_EVENT);
    expect(NOOP_EVENT.bool('a', true)).toBe(NOOP_EVENT);
    expect(NOOP_EVENT.float('a', 1.5)).toBe(NOOP_EVENT);
    expect(NOOP_EVENT.err(new Error('x'))).toBe(NOOP_EVENT);
    expect(NOOP_EVENT.any('a', {})).toBe(NOOP_EVENT);
  });

  it('.msg() and .send() do nothing', () => {
    NOOP_EVENT.msg('test');
    NOOP_EVENT.send();
  });
});
