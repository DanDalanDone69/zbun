/**
 * ZBun Benchmark Harness
 *
 * Runs identical workloads against zbun, pino, and winston.
 * Multiple rounds with median to reduce variance.
 *
 * Usage: bun run benchmarks/run.ts
 */

import { zbunBench } from './zbun-bench';

let pinoBench: (() => void) | null = null;
let winstonBench: (() => void) | null = null;

try {
  const m = await import('./pino-bench');
  pinoBench = m.pinoBench;
} catch {
  console.log('pino not installed, skipping pino benchmark');
}

try {
  const m = await import('./winston-bench');
  winstonBench = m.winstonBench;
} catch {
  console.log('winston not installed, skipping winston benchmark');
}

const ITERATIONS = 100_000;
const WARMUP = 10_000;
const ROUNDS = 5;

interface BenchResult {
  name: string;
  opsPerSec: number;
  memDeltaKB: number;
  durationMs: number;
  p99ns: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function measureP99(fn: () => void): number {
  const P99_SAMPLES = 10_000;
  const latencies: number[] = [];
  for (let i = 0; i < P99_SAMPLES; i++) {
    const t0 = Bun.nanoseconds();
    fn();
    latencies.push(Bun.nanoseconds() - t0);
  }
  latencies.sort((a, b) => a - b);
  return percentile(latencies, 99);
}

function runBench(name: string, fn: () => void): BenchResult {
  // Warmup
  for (let i = 0; i < WARMUP; i++) fn();
  if (Bun.gc) Bun.gc(true);

  const durations: number[] = [];
  const memDeltas: number[] = [];

  for (let round = 0; round < ROUNDS; round++) {
    if (Bun.gc) Bun.gc(true);

    const memBefore = process.memoryUsage().heapUsed;
    const start = performance.now();

    for (let i = 0; i < ITERATIONS; i++) fn();

    const durationMs = performance.now() - start;
    const memAfter = process.memoryUsage().heapUsed;

    durations.push(durationMs);
    memDeltas.push(memAfter - memBefore);
  }

  const medianDuration = median(durations);
  const medianMem = median(memDeltas);
  if (Bun.gc) Bun.gc(true);
  const p99ns = measureP99(fn);

  return {
    name,
    opsPerSec: Math.round((ITERATIONS / medianDuration) * 1000),
    memDeltaKB: Math.round(medianMem / 1024),
    durationMs: Math.round(medianDuration * 100) / 100,
    p99ns: Math.round(p99ns),
  };
}

console.log(
  `\nZBun Benchmark — ${ITERATIONS.toLocaleString()} iterations x ${ROUNDS} rounds (median)\n`,
);
console.log('─'.repeat(70));

const results: BenchResult[] = [];

results.push(runBench('zbun', zbunBench));
if (pinoBench) results.push(runBench('pino', pinoBench));
if (winstonBench) results.push(runBench('winston', winstonBench));

// Print results table
console.log(
  `${'Name'.padEnd(12)} ${'Ops/sec'.padStart(12)} ${'Duration'.padStart(12)} ${'Mem Δ'.padStart(10)} ${'p99 lat'.padStart(10)}`,
);
console.log('─'.repeat(70));

for (const r of results) {
  console.log(
    `${r.name.padEnd(12)} ${r.opsPerSec.toLocaleString().padStart(12)} ${(`${r.durationMs}ms`).padStart(12)} ${(`${r.memDeltaKB}KB`).padStart(10)} ${(`${r.p99ns}ns`).padStart(10)}`,
  );
}

// Comparison
if (results.length > 1) {
  const zbunResult = results[0];
  console.log(`\n${'─'.repeat(60)}`);
  for (let i = 1; i < results.length; i++) {
    const ratio = (zbunResult.opsPerSec / results[i].opsPerSec).toFixed(2);
    console.log(`zbun is ${ratio}x vs ${results[i].name}`);
  }
}

console.log('');
