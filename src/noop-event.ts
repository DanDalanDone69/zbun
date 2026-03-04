import type { Event } from './types';

const NOOP_EVENT: Event = Object.freeze({
  str() {
    return NOOP_EVENT;
  },
  int() {
    return NOOP_EVENT;
  },
  float() {
    return NOOP_EVENT;
  },
  bool() {
    return NOOP_EVENT;
  },
  err() {
    return NOOP_EVENT;
  },
  any() {
    return NOOP_EVENT;
  },
  msg() {},
  send() {},
});

export { NOOP_EVENT };
