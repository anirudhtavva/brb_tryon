/**
 * Reads and validates environment variables in one place.
 *
 * Why: a missing secret should fail loudly at the first request with a clear
 * log line, not halfway through a call to the AI provider.
 */
import { Errors } from './errors.js';

export type ProviderName = 'fashn' | 'mock';

export interface Config {
  provider: ProviderName;
  fashnApiKey: string | null;
  jobTokenSecret: string;
  appClientKey: string;
  rateLimitPerHour: number;
  dailyTryOnCap: number;
  upstash: { url: string; token: string } | null;
  mock: { delayMs: number; outcome: 'success' | 'fail' };
}

/** Read a positive integer env var, falling back to a default. */
function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw Errors.misconfigured(`${name} must be a non-negative integer, got "${raw}"`);
  }
  return value;
}

/** Read a required string env var. */
function required(name: string, minLength = 1): string {
  const value = process.env[name]?.trim();
  if (!value || value.length < minLength) {
    throw Errors.misconfigured(`${name} is missing or shorter than ${minLength} characters`);
  }
  return value;
}

/**
 * Build the config from `process.env`.
 * Called per request (it is cheap), so tests can change env between cases.
 */
export function loadConfig(): Config {
  const provider = (process.env.TRYON_PROVIDER ?? 'mock').trim() as ProviderName;
  if (provider !== 'fashn' && provider !== 'mock') {
    throw Errors.misconfigured(`TRYON_PROVIDER must be "fashn" or "mock", got "${provider}"`);
  }

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  const mockOutcome = process.env.MOCK_OUTCOME?.trim() === 'fail' ? 'fail' : 'success';

  return {
    provider,
    // Only demanded when we actually talk to FASHN.
    fashnApiKey: provider === 'fashn' ? required('FASHN_API_KEY') : null,
    // 32+ chars so the HMAC secret can't be brute-forced.
    jobTokenSecret: required('JOB_TOKEN_SECRET', 32),
    appClientKey: required('APP_CLIENT_KEY', 16),
    rateLimitPerHour: intFromEnv('RATE_LIMIT_PER_HOUR', 5),
    dailyTryOnCap: intFromEnv('DAILY_TRYON_CAP', 25),
    upstash: upstashUrl && upstashToken ? { url: upstashUrl, token: upstashToken } : null,
    mock: { delayMs: intFromEnv('MOCK_DELAY_MS', 4000), outcome: mockOutcome },
  };
}
