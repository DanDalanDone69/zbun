import { describe, expect, it } from 'bun:test';
import { readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLogger } from '../src/index';

describe('integration', () => {
  it('end-to-end: creates logger, logs structured messages, verifies output', async () => {
    const filePath = join(tmpdir(), `zbun-integration-${Date.now()}.log`);
    try {
      const log = createLogger({ level: 'trace', target: filePath });

      log.trace().str('a', '1').msg('trace msg');
      log.debug().int('b', 2).msg('debug msg');
      log.info().bool('c', true).msg('info msg');
      log.warn().float('d', 3.14).msg('warn msg');
      log.error().err(new Error('boom')).msg('error msg');
      log.fatal().any('e', { x: 1 }).msg('fatal msg');
      await log.flush();

      const content = readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(6);

      const levels = lines.map((l) => JSON.parse(l).level);
      expect(levels).toEqual(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);

      expect(JSON.parse(lines[0]).a).toBe('1');
      expect(JSON.parse(lines[1]).b).toBe(2);
      expect(JSON.parse(lines[2]).c).toBe(true);
      expect(JSON.parse(lines[4]).error).toBe('boom');
      expect(JSON.parse(lines[5]).e).toEqual({ x: 1 });
    } finally {
      try {
        unlinkSync(filePath);
      } catch {}
    }
  });

  it('high-volume: 10,000 messages, none lost', async () => {
    const filePath = join(tmpdir(), `zbun-highvol-${Date.now()}.log`);
    try {
      const log = createLogger({ level: 'info', target: filePath });
      const count = 10_000;

      for (let i = 0; i < count; i++) {
        log.info().int('i', i).msg('test');
      }
      await log.flush();

      const content = readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(count);

      expect(JSON.parse(lines[0]).i).toBe(0);
      expect(JSON.parse(lines[count - 1]).i).toBe(count - 1);
    } finally {
      try {
        unlinkSync(filePath);
      } catch {}
    }
  });

  it('child logger with nested contexts', async () => {
    const filePath = join(tmpdir(), `zbun-nested-${Date.now()}.log`);
    try {
      const log = createLogger({ level: 'info', target: filePath });
      const child1 = log.with().str('service', 'api').logger();
      const child2 = child1.with().str('reqId', 'r-1').logger();

      child2.info().msg('nested context');
      await log.flush();

      const content = readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content.trim());
      expect(parsed.service).toBe('api');
      expect(parsed.reqId).toBe('r-1');
      expect(parsed.message).toBe('nested context');
    } finally {
      try {
        unlinkSync(filePath);
      } catch {}
    }
  });
});
