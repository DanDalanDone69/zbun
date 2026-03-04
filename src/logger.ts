import type { LevelName, LevelValue } from './constants';
import { Level, levelFromString } from './constants';
import { ContextBuilderImpl } from './context';
import type { WriteBuffer } from './encoder';
import { LogEvent } from './event';
import { NOOP_EVENT } from './noop-event';
import { SyncTransport } from './transport-sync';
import type {
  ContextBuilder,
  Event,
  InternalLogger,
  Logger,
  LoggerOptions,
  Transport,
} from './types';

const LEVEL_NAMES: LevelName[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'];

const DEFAULT_BUF_SIZE = 8192;

export class ZBunLogger implements InternalLogger, Logger {
  levelNum: LevelValue;
  readonly contextBytes: Uint8Array | null;
  private transport: Transport;
  private pool: WriteBuffer[] = [];
  private event: LogEvent;

  constructor(opts: LoggerOptions, contextBytes?: Uint8Array | null, transport?: Transport) {
    this.levelNum = levelFromString(opts.level ?? 'info');
    this.contextBytes = contextBytes ?? null;
    this.event = new LogEvent(this);

    if (transport) {
      this.transport = transport;
    } else if (opts.async) {
      const { AsyncTransport } = require('./transport-async');
      this.transport = new AsyncTransport(opts.target ?? 'stdout', opts.bufferSize);
      process.on('beforeExit', () => {
        this.transport.flush();
      });
    } else {
      this.transport = new SyncTransport(opts.target ?? 'stdout');
    }
  }

  trace(): Event {
    return this.levelNum <= Level.TRACE ? this.event.reset(Level.TRACE) : NOOP_EVENT;
  }

  debug(): Event {
    return this.levelNum <= Level.DEBUG ? this.event.reset(Level.DEBUG) : NOOP_EVENT;
  }

  info(): Event {
    return this.levelNum <= Level.INFO ? this.event.reset(Level.INFO) : NOOP_EVENT;
  }

  warn(): Event {
    return this.levelNum <= Level.WARN ? this.event.reset(Level.WARN) : NOOP_EVENT;
  }

  error(): Event {
    return this.levelNum <= Level.ERROR ? this.event.reset(Level.ERROR) : NOOP_EVENT;
  }

  fatal(): Event {
    return this.levelNum <= Level.FATAL ? this.event.reset(Level.FATAL) : NOOP_EVENT;
  }

  isTrace(): boolean {
    return this.levelNum <= Level.TRACE;
  }
  isDebug(): boolean {
    return this.levelNum <= Level.DEBUG;
  }
  isInfo(): boolean {
    return this.levelNum <= Level.INFO;
  }
  isWarn(): boolean {
    return this.levelNum <= Level.WARN;
  }
  isError(): boolean {
    return this.levelNum <= Level.ERROR;
  }
  isFatal(): boolean {
    return this.levelNum <= Level.FATAL;
  }

  setLevel(level: LevelName): void {
    this.levelNum = levelFromString(level);
  }
  getLevel(): LevelName {
    return LEVEL_NAMES[this.levelNum] ?? 'info';
  }

  with(): ContextBuilder {
    return new ContextBuilderImpl(this, this.contextBytes);
  }

  child(contextBytes: Uint8Array): Logger {
    return new ZBunLogger({ level: this.getLevel() }, contextBytes, this.transport);
  }

  acquireBuffer(): WriteBuffer {
    return this.pool.pop() || { buf: new Uint8Array(DEFAULT_BUF_SIZE), pos: 0 };
  }

  releaseBuffer(wb: WriteBuffer): void {
    wb.pos = 0;
    this.pool.push(wb);
  }

  dispatch(buf: Uint8Array, len: number): void {
    this.transport.write(buf, len);
  }

  flush(): Promise<void> {
    return this.transport.flush();
  }
}

export function createLogger(opts?: LoggerOptions): Logger {
  return new ZBunLogger(opts ?? {});
}
