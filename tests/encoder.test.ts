import { describe, expect, it } from 'bun:test';
import { BYTE_RBRACE } from '../src/constants';
import {
  type WriteBuffer,
  writeBool,
  writeByte,
  writeFloat,
  writeInt,
  writeKey,
  writeStringValue,
} from '../src/encoder';

const BYTE_LBRACE = 0x7b;

function makeWB(size = 1024): WriteBuffer {
  return { buf: new Uint8Array(size), pos: 0 };
}

function result(wb: WriteBuffer): string {
  return new TextDecoder().decode(wb.buf.subarray(0, wb.pos));
}

describe('writeInt', () => {
  it('writes 0', () => {
    const wb = makeWB();
    writeInt(wb, 0);
    expect(result(wb)).toBe('0');
  });

  it('writes positive integers', () => {
    const wb = makeWB();
    writeInt(wb, 12345);
    expect(result(wb)).toBe('12345');
  });

  it('writes negative integers', () => {
    const wb = makeWB();
    writeInt(wb, -42);
    expect(result(wb)).toBe('-42');
  });

  it('writes large integers', () => {
    const wb = makeWB();
    writeInt(wb, 1234567890);
    expect(result(wb)).toBe('1234567890');
  });

  it('writes 1', () => {
    const wb = makeWB();
    writeInt(wb, 1);
    expect(result(wb)).toBe('1');
  });
});

describe('writeStringValue', () => {
  it('writes a simple ASCII string', () => {
    const wb = makeWB();
    writeStringValue(wb, 'hello');
    expect(result(wb)).toBe('"hello"');
  });

  it('escapes double quotes', () => {
    const wb = makeWB();
    writeStringValue(wb, 'say "hi"');
    expect(result(wb)).toBe('"say \\"hi\\""');
  });

  it('escapes backslashes', () => {
    const wb = makeWB();
    writeStringValue(wb, 'path\\to\\file');
    expect(result(wb)).toBe('"path\\\\to\\\\file"');
  });

  it('escapes newlines and tabs', () => {
    const wb = makeWB();
    writeStringValue(wb, 'line1\nline2\ttab');
    expect(result(wb)).toBe('"line1\\nline2\\ttab"');
  });

  it('handles empty string', () => {
    const wb = makeWB();
    writeStringValue(wb, '');
    expect(result(wb)).toBe('""');
  });

  it('round-trips through JSON.parse', () => {
    const wb = makeWB();
    const testStr = 'hello "world"\nfoo\\bar';
    writeStringValue(wb, testStr);
    const parsed = JSON.parse(result(wb));
    expect(parsed).toBe(testStr);
  });
});

describe('writeKey', () => {
  it('writes a JSON key with comma prefix', () => {
    const wb = makeWB();
    writeKey(wb, 'name');
    expect(result(wb)).toBe(',"name":');
  });
});

describe('writeBool', () => {
  it('writes true', () => {
    const wb = makeWB();
    writeBool(wb, true);
    expect(result(wb)).toBe('true');
  });

  it('writes false', () => {
    const wb = makeWB();
    writeBool(wb, false);
    expect(result(wb)).toBe('false');
  });
});

describe('writeFloat', () => {
  it('writes integer-valued float as integer', () => {
    const wb = makeWB();
    writeFloat(wb, 42);
    expect(result(wb)).toBe('42');
  });

  it('writes decimal float', () => {
    const wb = makeWB();
    writeFloat(wb, 3.14);
    expect(result(wb)).toBe('3.14');
  });
});

describe('full JSON line round-trip', () => {
  it('produces valid JSON', () => {
    const wb = makeWB();
    writeByte(wb, BYTE_LBRACE);
    // Write first key manually without comma
    const { buf } = wb;
    let p = wb.pos;
    buf[p++] = 0x22; // "
    buf[p++] = 0x61; // a
    buf[p++] = 0x22; // "
    buf[p++] = 0x3a; // :
    wb.pos = p;
    writeInt(wb, 1);
    writeKey(wb, 'b');
    writeStringValue(wb, 'hello');
    writeKey(wb, 'c');
    writeBool(wb, true);
    writeByte(wb, BYTE_RBRACE);

    const json = result(wb);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual({ a: 1, b: 'hello', c: true });
  });
});
