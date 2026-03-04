import { Writable } from 'node:stream';
import winston from 'winston';

// Create a synchronous /dev/null writable stream — no internal buffering.
// This ensures winston actually serializes + writes on each .info() call,
// matching pino (sync: true) and zbun (FileSink) behavior.
const devNull = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  },
});

const log = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Stream({ stream: devNull })],
});

let i = 0;

export function winstonBench(): void {
  log.info('User login flow completed', {
    module: 'auth',
    userId: i++,
    success: true,
  });
}
