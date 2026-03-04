import type { WriteBuffer } from './encoder';
import { writeBool, writeInt, writeKey, writeStringValue } from './encoder';
import type { ZBunLogger } from './logger';
import type { ContextBuilder as IContextBuilder, Logger } from './types';

export class ContextBuilderImpl implements IContextBuilder {
  private wb: WriteBuffer;
  private parent: ZBunLogger;

  constructor(parent: ZBunLogger, baseContext?: Uint8Array | null) {
    this.parent = parent;
    this.wb = { buf: new Uint8Array(4096), pos: 0 };
    if (baseContext) {
      this.wb.buf.set(baseContext);
      this.wb.pos = baseContext.length;
    }
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

  bool(key: string, value: boolean): this {
    writeKey(this.wb, key);
    writeBool(this.wb, value);
    return this;
  }

  logger(): Logger {
    const contextBytes = this.wb.buf.slice(0, this.wb.pos);
    return this.parent.child(contextBytes);
  }
}
