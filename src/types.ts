import type { LevelName } from './constants';
import type { WriteBuffer } from './encoder';

export interface Event {
  str(key: string, value: string): Event;
  int(key: string, value: number): Event;
  float(key: string, value: number): Event;
  bool(key: string, value: boolean): Event;
  err(error: unknown): Event;
  any(key: string, value: unknown): Event;
  msg(message: string): void;
  send(): void;
}

export interface Transport {
  write(buf: Uint8Array, len: number): void;
  flush(): Promise<void>;
  close(): Promise<void>;
}

export interface InternalLogger {
  readonly levelNum: number;
  readonly contextBytes: Uint8Array | null;
  acquireBuffer(): WriteBuffer;
  releaseBuffer(wb: WriteBuffer): void;
  dispatch(buf: Uint8Array, len: number): void;
}

export interface LoggerOptions {
  level?: LevelName;
  target?: 'stdout' | string;
  async?: boolean;
  bufferSize?: number;
}

export interface Logger {
  trace(): Event;
  debug(): Event;
  info(): Event;
  warn(): Event;
  error(): Event;
  fatal(): Event;

  isTrace(): boolean;
  isDebug(): boolean;
  isInfo(): boolean;
  isWarn(): boolean;
  isError(): boolean;
  isFatal(): boolean;

  setLevel(level: LevelName): void;
  getLevel(): LevelName;

  with(): ContextBuilder;

  flush(): Promise<void>;
}

export interface ContextBuilder {
  str(key: string, value: string): ContextBuilder;
  int(key: string, value: number): ContextBuilder;
  bool(key: string, value: boolean): ContextBuilder;
  logger(): Logger;
}
