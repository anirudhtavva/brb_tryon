/**
 * Talks to our try-on backend (never to FASHN directly — the API key stays on the server).
 *
 * Two calls:
 *   startTryOn()  → POST /api/tryon        returns a job token
 *   waitForResult() → GET /api/tryon-status, polled until done, failed or timed out
 *
 * Built for slow, flaky mobile networks: every request has a timeout, polling
 * survives a few dropped requests, and everything can be cancelled.
 */
import { config } from '../config';

/** Give up on a single HTTP request after this long. Uploads get more time. */
const UPLOAD_TIMEOUT_MS = 45_000;
const POLL_REQUEST_TIMEOUT_MS = 15_000;
/** Give up on the whole try-on after this long. FASHN normally takes ~8–20 s. */
const TOTAL_TIMEOUT_MS = 120_000;
/** How many poll requests in a row may fail (e.g. switching Wi-Fi → 4G) before we stop. */
const MAX_CONSECUTIVE_POLL_FAILURES = 4;

/** Error the UI can show directly. `code` comes from the backend, or is set here. */
export class TryOnError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    /** Whether "Try again" with the same photo makes sense. */
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'TryOnError';
  }
}

/** Codes where retrying the same photo won't help — the user needs a different photo. */
const NEEDS_NEW_PHOTO = new Set(['POSE_NOT_DETECTED', 'IMAGE_REJECTED', 'IMAGE_UNREADABLE', 'UNSUPPORTED_IMAGE', 'IMAGE_TOO_LARGE']);
/** Codes where retrying won't help at all right now. */
const NOT_RETRYABLE = new Set(['UNAUTHORIZED', 'UNKNOWN_PRODUCT', 'DAILY_LIMIT_REACHED', 'RATE_LIMITED', 'SERVER_MISCONFIGURED']);

function errorFromBody(body: unknown, fallbackStatus: number): TryOnError {
  const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
  const code = error?.code ?? `HTTP_${fallbackStatus}`;
  const message = error?.message ?? 'Something went wrong. Please try again.';
  return new TryOnError(code, message, !NEEDS_NEW_PHOTO.has(code) && !NOT_RETRYABLE.has(code));
}

export function isNewPhotoNeeded(error: TryOnError): boolean {
  return NEEDS_NEW_PHOTO.has(error.code);
}

/**
 * fetch() with a timeout that also respects an outer cancel signal.
 * (React Native doesn't ship AbortSignal.timeout/any, so we wire it by hand.)
 */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, outer?: AbortSignal) {
  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  if (outer?.aborted) controller.abort();
  outer?.addEventListener('abort', onOuterAbort);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (outer?.aborted) throw new TryOnError('CANCELLED', 'Cancelled.', false);
    if (controller.signal.aborted) {
      throw new TryOnError('NETWORK_TIMEOUT', 'The connection is slow. Please try again.', true);
    }
    throw new TryOnError('NETWORK_ERROR', "Can't reach BRB right now. Check your connection and try again.", true);
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onOuterAbort);
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function headers(extra: Record<string, string> = {}) {
  return { 'x-app-key': config.appKey, Accept: 'application/json', ...extra };
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new TryOnError('CANCELLED', 'Cancelled.', false));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    if (signal?.aborted) onAbort();
    else signal?.addEventListener('abort', onAbort);
  });

export interface StartedJob {
  jobToken: string;
  pollIntervalMs: number;
}

/** Upload the photo and start a try-on. */
export async function startTryOn(productId: string, personImage: string, signal?: AbortSignal): Promise<StartedJob> {
  const response = await fetchWithTimeout(
    `${config.apiBaseUrl}/api/tryon`,
    {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ productId, personImage }),
    },
    UPLOAD_TIMEOUT_MS,
    signal,
  );
  const body = await readJson(response);
  if (response.status !== 202) throw errorFromBody(body, response.status);

  const { jobToken, pollIntervalMs } = (body ?? {}) as Partial<StartedJob>;
  if (typeof jobToken !== 'string') throw new TryOnError('BAD_RESPONSE', 'Something went wrong. Please try again.', true);
  return { jobToken, pollIntervalMs: Math.max(1000, pollIntervalMs ?? 2000) };
}

/** Poll until the try-on is finished. Resolves with the result image as a data URI. */
export async function waitForResult(job: StartedJob, signal?: AbortSignal): Promise<string> {
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  let interval = job.pollIntervalMs;
  let failuresInARow = 0;

  while (Date.now() < deadline) {
    await sleep(interval, signal);

    let response: Response;
    try {
      response = await fetchWithTimeout(
        `${config.apiBaseUrl}/api/tryon-status`,
        { method: 'GET', headers: headers({ 'x-job-token': job.jobToken }) },
        POLL_REQUEST_TIMEOUT_MS,
        signal,
      );
    } catch (error) {
      if (error instanceof TryOnError && error.code === 'CANCELLED') throw error;
      // Network blip: back off and keep going, the job is still running on the server.
      failuresInARow += 1;
      if (failuresInARow >= MAX_CONSECUTIVE_POLL_FAILURES) throw error;
      interval = Math.min(interval * 2, 8000);
      continue;
    }

    const body = (await readJson(response)) as
      | { status: 'processing'; pollIntervalMs?: number }
      | { status: 'completed'; image: string }
      | { status: 'failed'; error: { code: string; message: string } }
      | null;

    // Server hiccup (5xx): treat like a network blip.
    if (response.status >= 500 && response.status !== 503) {
      failuresInARow += 1;
      if (failuresInARow >= MAX_CONSECUTIVE_POLL_FAILURES) throw errorFromBody(body, response.status);
      continue;
    }
    if (!response.ok) throw errorFromBody(body, response.status);

    failuresInARow = 0;
    interval = job.pollIntervalMs;

    if (body?.status === 'completed' && typeof body.image === 'string') return body.image;
    if (body?.status === 'failed') throw errorFromBody(body, 200);
    // else: still processing, loop again
  }

  throw new TryOnError('TIMEOUT', 'This is taking longer than usual. Please try again.', true);
}
