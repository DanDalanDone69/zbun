// Log level numeric constants for fast integer comparison
export const Level = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  FATAL: 5,
  SILENT: 6,
} as const;

export type LevelValue = (typeof Level)[keyof typeof Level];
export type LevelName = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';

const encoder = new TextEncoder();

export const LEVEL_HEADERS: Record<LevelValue, Uint8Array> = {
  [Level.TRACE]: encoder.encode('{"level":"trace","time":'),
  [Level.DEBUG]: encoder.encode('{"level":"debug","time":'),
  [Level.INFO]: encoder.encode('{"level":"info","time":'),
  [Level.WARN]: encoder.encode('{"level":"warn","time":'),
  [Level.ERROR]: encoder.encode('{"level":"error","time":'),
  [Level.FATAL]: encoder.encode('{"level":"fatal","time":'),
  [Level.SILENT]: encoder.encode('{"level":"silent","time":'),
};

export const BYTE_QUOTE = 0x22; // "
export const BYTE_COLON = 0x3a; // :
export const BYTE_COMMA = 0x2c; // ,
export const BYTE_RBRACE = 0x7d; // }
export const BYTE_NEWLINE = 0x0a; // \n

const LEVEL_MAP: Record<LevelName, LevelValue> = {
  trace: Level.TRACE,
  debug: Level.DEBUG,
  info: Level.INFO,
  warn: Level.WARN,
  error: Level.ERROR,
  fatal: Level.FATAL,
  silent: Level.SILENT,
};

export function levelFromString(name: LevelName): LevelValue {
  return LEVEL_MAP[name] ?? Level.INFO;
}
