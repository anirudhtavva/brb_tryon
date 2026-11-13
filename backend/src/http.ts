/**
 * Small helpers shared by every endpoint: JSON responses, auth, client IP,
 * and one error boundary so no handler can leak a stack trace.
 */
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { AppError, Errors } from './errors.js';
import { log } from './log.js';

/** Vercel rejects bodies over 4.5 MB; we stop a little earlier with a clearer error. */
const MAX_BODY_CHARS = 4_400_000;

export function json(status: number, body: unknown, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

/** Check the shared app key in constant time. */
export function requireAppKey(request: Request, expected: string): void {
  const given = Buffer.from(request.headers.get('x-app-key') ?? '');
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) throw Errors.unauthorized();
}

/**
 * Best guess at the caller's IP. On Vercel, `x-forwarded-for` is set by the
 * platform (clients can't spoof the first entry), so it's safe for rate limiting.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'unknown';
}

/** Read and parse a JSON body with a size guard. */
export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    throw Errors.invalidRequest('content-type must be application/json');
  }
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_CHARS) throw Errors.imageTooLarge(declared);

  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) throw Errors.imageTooLarge(text.length);
  try {
    return JSON.parse(text);
  } catch {
    throw Errors.invalidRequest('body is not valid JSON');
  }
}

/**
 * Wrap a handler so every error becomes a clean JSON response:
 *   { "error": { "code": "RATE_LIMITED", "message": "..." }, "requestId": "..." }
 */
export function withErrorBoundary(
  name: string,
  handler: (request: Request, requestId: string) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const requestId = randomUUID();
    const started = Date.now();
    try {
      const response = await handler(request, requestId);
      log('info', `${name}_ok`, { requestId, status: response.status, ms: Date.now() - started });
      return response;
    } catch (error) {
      const appError = error instanceof AppError ? error : Errors.internal((error as Error)?.message ?? String(error));
      log(appError.status >= 500 ? 'error' : 'warn', `${name}_error`, {
        requestId,
        code: appError.code,
        status: appError.status,
        detail: appError.internalDetail ?? null,
        ms: Date.now() - started,
      });
      const headers: Record<string, string> = {};
      if (appError.status === 429 || appError.status === 503) headers['Retry-After'] = '60';
      return json(
        appError.status,
        { error: { code: appError.code, message: appError.publicMessage }, requestId },
        headers,
      );
    }
  };
}
