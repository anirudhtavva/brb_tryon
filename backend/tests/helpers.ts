/** Shared test fixtures. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Config } from '../src/config.js';

export const APP_KEY = 'test-app-key-0123456789';

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    provider: 'mock',
    fashnApiKey: null,
    jobTokenSecret: 'x'.repeat(40),
    appClientKey: APP_KEY,
    rateLimitPerHour: 5,
    dailyTryOnCap: 25,
    upstash: null,
    mock: { delayMs: 0, outcome: 'success' },
    ...overrides,
  };
}

/** A real JPEG from the repo, so magic-byte checks pass. */
export const PERSON_JPEG = `data:image/jpeg;base64,${readFileSync(
  path.join(process.cwd(), 'garments', 'qipao-white-brocade.jpg'),
).toString('base64')}`;

export function postTryOn(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://test.local/api/tryon', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-app-key': APP_KEY, 'x-forwarded-for': '1.2.3.4', ...headers },
    body: JSON.stringify(body),
  });
}

export function getStatus(token: string, headers: Record<string, string> = {}): Request {
  return new Request('https://test.local/api/tryon-status', {
    headers: { 'x-app-key': APP_KEY, 'x-job-token': token, ...headers },
  });
}
