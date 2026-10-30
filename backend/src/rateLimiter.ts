import { redis } from './redis';

const HOUR = 3600_000;

// Atomic check-and-increment. Over limit -> roll back and report denied.
const LUA = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
if c > tonumber(ARGV[1]) then
  redis.call('DECR', KEYS[1])
  return 0
end
return 1
`;

/**
 * Redis counter keyed by sender + hour window. Safe across any number of workers/instances.
 * When denied, caller reschedules the job to the start of the next window (never drops it).
 */
export async function acquireSlot(senderId: number, limit: number) {
  const now = Date.now();
  const window = Math.floor(now / HOUR);
  const key = `rl:${senderId}:${window}`;
  const ok = (await redis.eval(LUA, 1, key, limit, 2 * 3600)) as number;
  return { allowed: ok === 1, window, nextWindowAt: (window + 1) * HOUR };
}
