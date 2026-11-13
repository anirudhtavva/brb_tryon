/**
 * Signed job tokens.
 *
 * When a try-on starts we hand the app a token instead of the raw provider job id.
 * The token is `payload.signature`, where the signature is an HMAC-SHA256 made
 * with a server-only secret. This means:
 *  - nobody can poll someone else's job by guessing ids,
 *  - nobody can forge or edit a token (changing one byte breaks the signature),
 *  - tokens expire on their own, no database needed.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Errors } from './errors.js';

/** How long the app may keep polling one job. FASHN deletes base64 results after 60 min anyway. */
export const JOB_TOKEN_TTL_SECONDS = 15 * 60;

export interface JobPayload {
  /** Provider's prediction id. */
  pid: string;
  /** Product being tried on (for logs / analytics). */
  prod: string;
  /** Expiry, unix seconds. */
  exp: number;
}

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function createJobToken(
  payload: Omit<JobPayload, 'exp'>,
  secret: string,
  now: number = Date.now(),
): string {
  const full: JobPayload = { ...payload, exp: Math.floor(now / 1000) + JOB_TOKEN_TTL_SECONDS };
  const body = Buffer.from(JSON.stringify(full)).toString('base64url');
  return `${body}.${sign(body, secret)}`;
}

export function verifyJobToken(token: unknown, secret: string, now: number = Date.now()): JobPayload {
  if (typeof token !== 'string' || token.length > 1024) throw Errors.invalidJob('missing or oversized token');

  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra !== undefined) throw Errors.invalidJob('malformed token');

  // Constant-time compare so attackers can't learn the signature byte by byte.
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    throw Errors.invalidJob('bad signature');
  }

  let payload: JobPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as JobPayload;
  } catch {
    throw Errors.invalidJob('unreadable payload');
  }
  if (typeof payload.pid !== 'string' || typeof payload.exp !== 'number') throw Errors.invalidJob('bad payload');
  if (payload.exp * 1000 < now) throw Errors.invalidJob('expired');
  return payload;
}
