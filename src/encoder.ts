import { BYTE_COLON, BYTE_COMMA, BYTE_QUOTE } from './constants';

export interface WriteBuffer {
  buf: Uint8Array;
  pos: number;
}

const NEEDS_ESCAPE = new Uint8Array(128);
const ESCAPE_SEQS: Uint8Array[] = new Array(128);

const te = new TextEncoder();

for (let i = 0; i < 0x20; i++) {
  NEEDS_ESCAPE[i] = 1;
  const hex = i.toString(16).padStart(4, '0');
  ESCAPE_SEQS[i] = te.encode(`\\u${hex}`);
}
NEEDS_ESCAPE[0x08] = 1;
ESCAPE_SEQS[0x08] = te.encode('\\b');
NEEDS_ESCAPE[0x09] = 1;
ESCAPE_SEQS[0x09] = te.encode('\\t');
NEEDS_ESCAPE[0x0a] = 1;
ESCAPE_SEQS[0x0a] = te.encode('\\n');
NEEDS_ESCAPE[0x0c] = 1;
ESCAPE_SEQS[0x0c] = te.encode('\\f');
NEEDS_ESCAPE[0x0d] = 1;
ESCAPE_SEQS[0x0d] = te.encode('\\r');
NEEDS_ESCAPE[0x22] = 1;
ESCAPE_SEQS[0x22] = te.encode('\\"');
NEEDS_ESCAPE[0x5c] = 1;
ESCAPE_SEQS[0x5c] = te.encode('\\\\');

const textEncoder = new TextEncoder();

const keyCache: Record<string, Uint8Array> = Object.create(null);
let keyCacheSize = 0;
const KEY_CACHE_MAX = 256;

function getKeyBytes(key: string): Uint8Array {
  const cached = keyCache[key];
  if (cached !== undefined) return cached;

  const bytes = new Uint8Array(key.length + 4);
  bytes[0] = BYTE_COMMA;
  bytes[1] = BYTE_QUOTE;
  for (let i = 0; i < key.length; i++) {
    bytes[i + 2] = key.charCodeAt(i);
  }
  bytes[key.length + 2] = BYTE_QUOTE;
  bytes[key.length + 3] = BYTE_COLON;

  if (keyCacheSize < KEY_CACHE_MAX) {
    keyCache[key] = bytes;
    keyCacheSize++;
  }
  return bytes;
}

export function writeByte(wb: WriteBuffer, b: number): void {
  wb.buf[wb.pos++] = b;
}

export function writeBytes(wb: WriteBuffer, src: Uint8Array): void {
  wb.buf.set(src, wb.pos);
  wb.pos += src.length;
}

export function writeKey(wb: WriteBuffer, key: string): void {
  const encoded = getKeyBytes(key);
  wb.buf.set(encoded, wb.pos);
  wb.pos += encoded.length;
}

export function writeStringValue(wb: WriteBuffer, val: string): void {
  const { buf } = wb;
  let p = wb.pos;
  buf[p++] = BYTE_QUOTE;

  const len = val.length;

  if (len < 128) {
    let needsSlow = false;
    for (let i = 0; i < len; i++) {
      const ch = val.charCodeAt(i);
      if (ch >= 0x80 || NEEDS_ESCAPE[ch]) {
        needsSlow = true;
        break;
      }
    }

    if (!needsSlow) {
      for (let i = 0; i < len; i++) {
        buf[p++] = val.charCodeAt(i);
      }
      buf[p++] = BYTE_QUOTE;
      wb.pos = p;
      return;
    }
  }

  let i = 0;
  while (i < len) {
    const ch = val.charCodeAt(i);

    if (ch < 0x80) {
      if (NEEDS_ESCAPE[ch]) {
        const esc = ESCAPE_SEQS[ch];
        buf.set(esc, p);
        p += esc.length;
      } else {
        buf[p++] = ch;
      }
      i++;
    } else {
      let char: string;
      if (ch >= 0xd800 && ch <= 0xdbff && i + 1 < len) {
        char = val.substring(i, i + 2);
        i += 2;
      } else {
        char = val[i];
        i++;
      }
      const result = textEncoder.encodeInto(char, buf.subarray(p));
      p += result.written!;
    }
  }

  buf[p++] = BYTE_QUOTE;
  wb.pos = p;
}

export function writeRawString(wb: WriteBuffer, val: string): void {
  const { buf } = wb;
  let p = wb.pos;
  for (let i = 0; i < val.length; i++) {
    buf[p++] = val.charCodeAt(i);
  }
  wb.pos = p;
}

const DIGIT_PAIRS = new Uint8Array(200);
for (let i = 0; i < 100; i++) {
  DIGIT_PAIRS[i * 2] = 0x30 + ((i / 10) | 0);
  DIGIT_PAIRS[i * 2 + 1] = 0x30 + (i % 10);
}

const DIGIT_BUF = new Uint8Array(21);

export function writeInt(wb: WriteBuffer, val: number): void {
  const { buf } = wb;
  let p = wb.pos;

  if (val === 0) {
    buf[p++] = 0x30;
    wb.pos = p;
    return;
  }

  let n = val;
  if (n < 0) {
    buf[p++] = 0x2d;
    n = -n;
  }

  let dIdx = 0;
  while (n >= 100) {
    const pair = (n % 100) * 2;
    DIGIT_BUF[dIdx++] = DIGIT_PAIRS[pair + 1];
    DIGIT_BUF[dIdx++] = DIGIT_PAIRS[pair];
    n = (n / 100) | 0;
  }
  if (n >= 10) {
    const pair = n * 2;
    DIGIT_BUF[dIdx++] = DIGIT_PAIRS[pair + 1];
    DIGIT_BUF[dIdx++] = DIGIT_PAIRS[pair];
  } else {
    DIGIT_BUF[dIdx++] = 0x30 + n;
  }

  for (let j = dIdx - 1; j >= 0; j--) {
    buf[p++] = DIGIT_BUF[j];
  }

  wb.pos = p;
}

export function writeFloat(wb: WriteBuffer, val: number): void {
  if (Number.isInteger(val) && Math.abs(val) < Number.MAX_SAFE_INTEGER) {
    writeInt(wb, val);
    return;
  }
  writeRawString(wb, `${val}`);
}

const TRUE_BYTES = te.encode('true');
const FALSE_BYTES = te.encode('false');
const NULL_BYTES = te.encode('null');

export function writeBool(wb: WriteBuffer, val: boolean): void {
  const src = val ? TRUE_BYTES : FALSE_BYTES;
  wb.buf.set(src, wb.pos);
  wb.pos += src.length;
}

export function writeNull(wb: WriteBuffer): void {
  wb.buf.set(NULL_BYTES, wb.pos);
  wb.pos += NULL_BYTES.length;
}
