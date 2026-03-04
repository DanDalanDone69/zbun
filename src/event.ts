import type { LevelValue } from './constants';
import { BYTE_NEWLINE, BYTE_RBRACE, LEVEL_HEADERS } from './constants';
import type { WriteBuffer } from './encoder';
import {
  writeBool,
  writeFloat,
  writeInt,
  writeKey,
  writeRawString,
  writeStringValue,
} from './encoder';
import type { Event, InternalLogger } from './types';

export class LogEvent implements Event {
  wb!: WriteBuffer;
  private logger: InternalLogger;

  constructor(logger: InternalLogger) {
    this.logger = logger;
  }

  reset(level: LevelValue): this {
    this.wb = this.logger.acquireBuffer();
    this.wb.pos = 0;

    const header = LEVEL_HEADERS[level];
    this.wb.buf.set(header, 0);
    this.wb.pos = header.length;

    writeInt(this.wb, Date.now());

    const ctx = this.logger.contextBytes;
    if (ctx) {
      this.wb.buf.set(ctx, this.wb.pos);
      this.wb.pos += ctx.length;
    }

    return this;
  }

  str(key: string, value: string): this {
    writeKey(this.wb, key);
    writeStringValue(this.wb, value);
    return this;
  }

  int(key: string, value: number): this {
    writeKey(this.wb, key);
    writeInt(this.wb, value);
    return this;
  }

  float(key: string, value: number): this {
    writeKey(this.wb, key);
    writeFloat(this.wb, value);
    return this;
  }

  bool(key: string, value: boolean): this {
    writeKey(this.wb, key);
    writeBool(this.wb, value);
    return this;
  }

  err(error: unknown): this {
    if (error instanceof Error) {
      writeKey(this.wb, 'error');
      writeStringValue(this.wb, error.message);
      if (error.stack) {
        writeKey(this.wb, 'stack');
        writeStringValue(this.wb, error.stack);
      }
    } else if (typeof error === 'string') {
      writeKey(this.wb, 'error');
      writeStringValue(this.wb, error);
    }
    return this;
  }

  any(key: string, value: unknown): this {
    writeKey(this.wb, key);
    if (value === null || value === undefined) {
      writeRawString(this.wb, 'null');
    } else if (typeof value === 'string') {
      writeStringValue(this.wb, value);
    } else if (typeof value === 'number') {
      writeFloat(this.wb, value);
    } else if (typeof value === 'boolean') {
      writeBool(this.wb, value);
    } else {
      writeRawString(this.wb, JSON.stringify(value));
    }
    return this;
  }

  msg(message: string): void {
    writeKey(this.wb, 'message');
    writeStringValue(this.wb, message);
    this.wb.buf[this.wb.pos++] = BYTE_RBRACE;
    this.wb.buf[this.wb.pos++] = BYTE_NEWLINE;
    this.logger.dispatch(this.wb.buf, this.wb.pos);
    this.logger.releaseBuffer(this.wb);
  }

  send(): void {
    this.wb.buf[this.wb.pos++] = BYTE_RBRACE;
    this.wb.buf[this.wb.pos++] = BYTE_NEWLINE;
    this.logger.dispatch(this.wb.buf, this.wb.pos);
    this.logger.releaseBuffer(this.wb);
  }
}
