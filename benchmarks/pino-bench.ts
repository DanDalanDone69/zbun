import pino from 'pino';

// Synchronous destination to /dev/null — matches zbun's sync FileSink behavior.
// sync: true ensures pino serializes + writes on each call (no async buffering).
const log = pino({ level: 'info' }, pino.destination({ dest: '/dev/null', sync: true }));

let i = 0;

export function pinoBench(): void {
  log.info({ module: 'auth', userId: i++, success: true }, 'User login flow completed');
}
