/**
 * The actual endpoint logic, written as plain functions of (Request) → Response.
 *
 * Dependencies (config, provider, counter store) are passed in, so tests can
 * swap in fakes. The files in /api only wire up the real ones.
 *
 *   POST /api/tryon          start a try-on       → 202 { jobToken, pollIntervalMs }
 *   GET  /api/tryon-status   check on a try-on    → 200 { status: processing | completed | failed }
 *   GET  /api/health         is the service up?   → 200 { ok, provider }
 */
import { getCatalogItem, loadGarmentDataUri } from './catalog.js';
import type { Config } from './config.js';
import { clientIp, json, readJson, requireAppKey, withErrorBoundary } from './http.js';
import { createJobToken, verifyJobToken } from './jobToken.js';
import { log } from './log.js';
import type { TryOnProvider } from './providers/types.js';
import { reserveTryOn, type CounterStore } from './quota.js';
import { parseTryOnBody } from './validation.js';

/** How often the app should poll. FASHN "balanced" usually takes ~8–15 s. */
export const POLL_INTERVAL_MS = 2000;

export interface Deps {
  config: Config;
  provider: TryOnProvider;
  store: CounterStore;
}

/** Build deps lazily per request, so a missing env var becomes a clean 500, not a crash at import. */
export type DepsFactory = () => Deps;

export function createTryOnHandler(getDeps: DepsFactory) {
  return withErrorBoundary('tryon_submit', async (request, requestId) => {
    const { config, provider, store } = getDeps();
    requireAppKey(request, config.appClientKey);

    // 1. Validate everything BEFORE spending anything.
    const body = parseTryOnBody(await readJson(request));
    const item = getCatalogItem(body.productId);
    const garmentImage = await loadGarmentDataUri(item);

    // 2. Reserve a slot against the per-user and daily limits.
    const reservation = await reserveTryOn(store, config, clientIp(request));

    // 3. Start the job. If it never started, give the slot back (failed jobs cost no credits).
    let predictionId: string;
    try {
      ({ predictionId } = await provider.submit({
        personImage: body.personImage,
        garmentImage,
        category: item.category,
        photoType: item.photoType,
        productId: body.productId,
      }));
    } catch (error) {
      await reservation.release();
      throw error;
    }

    log('info', 'tryon_started', { requestId, provider: provider.name, product: body.productId, predictionId });
    const jobToken = createJobToken({ pid: predictionId, prod: body.productId }, config.jobTokenSecret);
    return json(202, { jobToken, pollIntervalMs: POLL_INTERVAL_MS });
  });
}

export function createStatusHandler(getDeps: DepsFactory) {
  return withErrorBoundary('tryon_status', async (request) => {
    const { config, provider } = getDeps();
    requireAppKey(request, config.appClientKey);

    // Token comes in a header (not the URL) so it never ends up in access logs.
    const job = verifyJobToken(request.headers.get('x-job-token'), config.jobTokenSecret);
    const status = await provider.getStatus(job.pid);

    switch (status.state) {
      case 'processing':
        return json(200, { status: 'processing', pollIntervalMs: POLL_INTERVAL_MS });
      case 'completed':
        return json(200, { status: 'completed', image: status.imageDataUri });
      case 'failed':
        log('warn', 'tryon_failed', { code: status.error.code, detail: status.error.internalDetail ?? null });
        return json(200, {
          status: 'failed',
          error: { code: status.error.code, message: status.error.publicMessage },
        });
    }
  });
}

export function createHealthHandler(getDeps: DepsFactory) {
  return withErrorBoundary('health', async () => {
    const { config } = getDeps(); // throws SERVER_MISCONFIGURED if env is incomplete
    return json(200, {
      ok: true,
      provider: config.provider,
      sharedLimits: config.upstash !== null,
    });
  });
}
