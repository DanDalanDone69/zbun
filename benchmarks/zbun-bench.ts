import { createLogger } from '../src/index';

const log = createLogger({ level: 'info', target: '/dev/null' });

let i = 0;

export function zbunBench(): void {
  log
    .info()
    .str('module', 'auth')
    .int('userId', i++)
    .bool('success', true)
    .msg('User login flow completed');
}
