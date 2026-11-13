/**
 * Rate limiting and the daily credit cap.
 *
 * Two counters protect the FASHN credits:
 *  1. per user (hashed IP): at most N try-ons per hour,
 *  2. whole service: at most M try-ons per UTC day — a hard ceiling on spend.
 *
 * Counters live in Upstash Redis when configured (shared by all server
 * instances). Without Redis we fall back to memory, which only counts per
 * instance — fine for local dev and demos, documented as a known gap.
 *
 * If Redis is configured but unreachable we FAIL CLOSED (block the try-on),
 * because an unbounded spend is worse than a short outage.
 */
import { createHash } from 'node:crypto';
import type { Config } from './config.js';
import { AppError, Errors } from './errors.js';
import { log } from './log.js';

/** Minimal counter store: increment a key that expires after `ttlSeconds`. */
export interface CounterStore {
  incr(key: string, ttlSeconds: number): Promise<number>;
  decr(key: string): Promise<void>;
}

/** In-memory store. Per server instance only. */
export class MemoryCounterStore implements CounterStore {
  private counters = new Map<string, { value: number; expiresAt: number }>();

  async incr(key: string, ttlSeconds: number): Promise<number> {
    const now = Date.now();
    const current = this.counters.get(key);
    if (!current || current.expiresAt <= now) {
      this.counters.set(key, { value: 1, expiresAt: now + ttlSeconds * 1000 });
      return 1;
    }
    current.value += 1;
    return current.value;
  }

  async decr(key: string): Promise<void> {
    const current = this.counters.get(key);
    if (current && current.value > 0) current.value -= 1;
  }
}

/** Upstash Redis over its REST API (plain fetch, no SDK, works on Vercel free tier). */
export class UpstashCounterStore implements CounterStore {
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  private async pipeline(commands: (string | number)[][]): Promise<{ result?: unknown; error?: string }[]> {
    const response = await fetch(`${this.url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error(`Upstash HTTP ${response.status}`);
    return (await response.json()) as { result?: unknown; error?: string }[];
  }

  async incr(key: string, ttlSeconds: number): Promise<number> {
    // INCR then set the expiry only if the key has none yet (NX), in one round trip.
    const [incr] = await this.pipeline([
      ['INCR', key],
      ['EXPIRE', key, ttlSeconds, 'NX'],
    ]);
    if (!incr || typeof incr.result !== 'number') throw new Error(`Upstash INCR failed: ${incr?.error ?? 'unknown'}`);
    return incr.result;
  }

  async decr(key: string): Promise<void> {
    await this.pipeline([['DECR', key]]);
  }
}

// One memory store per server instance, shared across requests.
const sharedMemoryStore = new MemoryCounterStore();

export function createCounterStore(config: Config): CounterStore {
  return config.upstash ? new UpstashCounterStore(config.upstash.url, config.upstash.token) : sharedMemoryStore;
}

/** A handle to undo a reservation if the try-on never reached the provider. */
export interface Reservation {
  release(): Promise<void>;
}

/**
 * Reserve one try-on for this client. Throws RATE_LIMITED or DAILY_LIMIT_REACHED.
 *
 * @param clientId raw client identifier (IP). It is hashed with the server secret,
 *                 so raw IP addresses are never stored.
 */
export async function reserveTryOn(
  store: CounterStore,
  config: Config,
  clientId: string,
  now: Date = new Date(),
): Promise<Reservation> {
  const hashedClient = createHash('sha256').update(`${config.jobTokenSecret}:${clientId}`).digest('hex').slice(0, 32);

  const hourBucket = Math.floor(now.getTime() / 3_600_000);
  const userKey = `tryon:user:${hashedClient}:${hourBucket}`;
  const dayKey = `tryon:day:${now.toISOString().slice(0, 10)}`;

  try {
    const userCount = await store.incr(userKey, 3600);
    if (userCount > config.rateLimitPerHour) {
      const secondsLeftInHour = 3600 - Math.floor((now.getTime() % 3_600_000) / 1000);
      throw Errors.rateLimited(secondsLeftInHour);
    }

    const dayCount = await store.incr(dayKey, 2 * 86_400);
    if (dayCount > config.dailyTryOnCap) {
      await store.decr(userKey); // don't punish the user for the global cap
      log('warn', 'daily_cap_reached', { cap: config.dailyTryOnCap });
      throw Errors.dailyLimit();
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    // Counter store is down: fail closed to protect credits.
    log('error', 'quota_store_unavailable', { message: (error as Error).message });
    throw Errors.providerUnavailable('quota store unavailable');
  }

  return {
    release: async () => {
      try {
        await Promise.all([store.decr(userKey), store.decr(dayKey)]);
      } catch (error) {
        log('warn', 'quota_release_failed', { message: (error as Error).message });
      }
    },
  };
}
