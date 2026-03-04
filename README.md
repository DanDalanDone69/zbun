# ZBun

The fastest structured logging library for [Bun](https://bun.sh).

ZBun merges the zero-allocation fluent API of Go's [zerolog](https://github.com/rs/zerolog) with the lock-free asynchronous I/O of C++'s [spdlog](https://github.com/gabime/spdlog) — built from scratch for the Bun runtime. Zero dependencies.

## Benchmarks

Structured logging (`str` + `int` + `bool` fields) writing to `/dev/null`, Bun 1.3.10, 100k iterations x 5 rounds (median):

| Logger | Ops/sec | vs ZBun |
|--------|---------|---------|
| **zbun** | **2,888,549** | — |
| pino | 931,519 | 3.10x slower |
| winston | 1,016,133 | 2.84x slower |

> ZBun achieves **3.1x higher throughput** than pino and **2.8x** over winston with zero memory overhead (0KB heap delta).

## Install

```bash
bun add @2ez4dan/zbun
```

**Requires Bun >= 1.1.** Recommended: Bun >= 1.3.x.

## Quick Start

```typescript
import { createLogger } from '@2ez4dan/zbun';

const log = createLogger({
  level: 'info',          // 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  target: 'stdout',       // or a file path like './app.log'
});

log.info()
   .str('module', 'auth')
   .int('userId', 12345)
   .bool('success', true)
   .msg('User login completed');

// Output: {"level":"info","time":1709568000000,"module":"auth","userId":12345,"success":true,"message":"User login completed"}
```

## API

### Log Levels

```typescript
log.trace()  // Level 0
log.debug()  // Level 1
log.info()   // Level 2
log.warn()   // Level 3
log.error()  // Level 4
log.fatal()  // Level 5
```

If a level is disabled, the call returns a frozen no-op singleton — zero allocation, zero buffer writes.

### Typed Field Methods

```typescript
log.info()
   .str('name', 'alice')        // String field (JSON-escaped)
   .int('age', 30)              // Integer (no toString() allocation)
   .float('score', 9.5)         // Floating point
   .bool('active', true)        // Boolean
   .any('meta', { x: 1 })       // Any value (JSON.stringify fallback for objects)
   .msg('user created');
```

Type-specific methods (`.str`, `.int`, `.bool`) are faster than `.any` because they skip type checking and use optimized byte encoding paths.

### Error Logging

```typescript
try {
  await db.connect();
} catch (e) {
  log.error()
     .err(e)                    // Extracts message + stack trace
     .str('host', 'db-1')
     .msg('Connection failed');
}
```

### Child Loggers

Attach persistent context fields that are included in every log entry:

```typescript
const reqLog = log.with()
                  .str('reqId', 'req-55aa77')
                  .str('path', '/api/users')
                  .logger();

reqLog.info().msg('Request started');
// Output: {"level":"info","time":...,"reqId":"req-55aa77","path":"/api/users","message":"Request started"}

// Child loggers nest — grandchild inherits all parent context
const dbLog = reqLog.with().str('db', 'postgres').logger();
```

Context fields are pre-serialized as a byte array when `.logger()` is called. On each subsequent log call, they are copied directly into the buffer — O(1) cost regardless of how many context fields exist.

### Async Mode

For maximum throughput, enable async mode to offload I/O to a background Worker thread:

```typescript
const log = createLogger({
  level: 'info',
  target: 'stdout',
  async: true,                  // Enables SharedArrayBuffer + Worker
  bufferSize: 1024 * 1024,      // 1MB ring buffer (default)
});

// Logs are written to a lock-free ring buffer on the main thread,
// then flushed to I/O by a background Bun Worker.
log.info().str('fast', 'path').msg('Non-blocking');

// Flush before exit to ensure all buffered logs are written
await log.flush();
```

If the ring buffer fills up, ZBun transparently falls back to synchronous writing — no messages are ever dropped.

### `.send()` — Log Without a Message

```typescript
log.info().str('event', 'heartbeat').int('uptime', 3600).send();
// Output: {"level":"info","time":...,"event":"heartbeat","uptime":3600}
```

## How It's Fast

1. **Manual byte encoding** — JSON is built byte-by-byte into a pre-allocated `Uint8Array`. No `JSON.stringify()`, no intermediate string objects.

2. **Buffer pooling** — Each logger holds a stack of reusable write buffers. In steady state, zero allocations per log call.

3. **No-op singleton** — Disabled log levels return a frozen `Object.freeze`'d singleton. Every chained method is a no-op that returns itself.

4. **Type-specific formatters** — `.int(k, 42)` writes ASCII digits directly via `% 10` extraction (no `Number.toString()` allocation). `.bool(k, true)` writes the 4 pre-encoded bytes `true`.

5. **Pre-computed contexts** — Child logger context fields are serialized once as raw bytes, then `memcpy`'d on each log call.

6. **Lock-free async I/O** — Async mode uses a SPSC ring buffer over `SharedArrayBuffer` with `Atomics` for zero-contention, zero-copy handoff to a background Worker.

## Configuration

```typescript
interface LoggerOptions {
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';
  target?: 'stdout' | string;   // 'stdout' or a file path
  async?: boolean;               // Enable background Worker transport
  bufferSize?: number;           // Ring buffer size in bytes (default: 1MB)
}
```

## Running Tests

```bash
bun test
```

## Running Benchmarks

```bash
bun add -d pino winston
bun run benchmarks/run.ts
```

## License

MIT
