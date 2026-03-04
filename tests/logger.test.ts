import { describe, expect, it } from 'bun:test';
import { readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLogger } from '../src/logger';
import { NOOP_EVENT } from '../src/noop-event';

describe('Logger', () => {
  it('filters disabled log levels', () => {
    const log = createLogger({ level: 'warn' });
    expect(log.info()).toBe(NOOP_EVENT);
    expect(log.warn()).not.toBe(NOOP_EVENT);
    expect(log.error()).not.toBe(NOOP_EVENT);
  });

  it('writes to a file', async () => {
    const filePath = join(tmpdir(), `zbun-test-${Date.now()}.log`);
    try {
      const log = createLogger({ level: 'info', target: filePath });
      log.info().str('key', 'value').msg('hello');
      await log.flush();

      const content = readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(1);

      const parsed = JSON.parse(lines[0]);
      expect(parsed.level).toBe('info');
      expect(parsed.key).toBe('value');
      expect(parsed.message).toBe('hello');
    } finally {
      try {
        unlinkSync(filePath);
      } catch {}
    }
  });

  it('creates child loggers with context', async () => {
    const filePath = join(tmpdir(), `zbun-child-test-${Date.now()}.log`);
    try {
      const log = createLogger({ level: 'info', target: filePath });
      const child = log.with().str('reqId', 'req-123').str('path', '/api').logger();

      child.info().msg('request handled');
      await log.flush();

      const content = readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content.trim());
      expect(parsed.reqId).toBe('req-123');
      expect(parsed.path).toBe('/api');
      expect(parsed.message).toBe('request handled');
    } finally {
      try {
        unlinkSync(filePath);
      } catch {}
    }
  });

  it('child logger inherits parent level', () => {
    const log = createLogger({ level: 'error' });
    const child = log.with().str('ctx', 'test').logger();
    expect(child.info()).toBe(NOOP_EVENT);
    expect(child.error()).not.toBe(NOOP_EVENT);
  });

  it('level guards reflect current level', () => {
    const log = createLogger({ level: 'warn' });
    expect(log.isTrace()).toBe(false);
    expect(log.isDebug()).toBe(false);
    expect(log.isInfo()).toBe(false);
    expect(log.isWarn()).toBe(true);
    expect(log.isError()).toBe(true);
    expect(log.isFatal()).toBe(true);
  });

  it('setLevel / getLevel change the active level', () => {
    const log = createLogger({ level: 'info' });
    expect(log.getLevel()).toBe('info');
    expect(log.isDebug()).toBe(false);

    log.setLevel('debug');
    expect(log.getLevel()).toBe('debug');
    expect(log.isDebug()).toBe(true);
    expect(log.debug()).not.toBe(NOOP_EVENT);

    log.setLevel('error');
    expect(log.getLevel()).toBe('error');
    expect(log.isInfo()).toBe(false);
    expect(log.info()).toBe(NOOP_EVENT);
  });
});
