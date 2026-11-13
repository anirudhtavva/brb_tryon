/**
 * FASHN adapter (https://docs.fashn.ai).
 *
 * Flow: POST /v1/run → prediction id, then GET /v1/status/{id} until done.
 *
 * Privacy choices made here:
 *  - Photos go in as base64 (never as a URL we host). FASHN deletes base64
 *    inputs when the job finishes, with a 1-day backstop.
 *  - `return_base64: true` makes FASHN return the result inline and delete it
 *    after 60 minutes, instead of keeping a CDN copy for 3 days.
 *  So no photo is ever written to our own storage.
 *
 * Cost choices: tryon-v1.6, 1 sample, "balanced" mode = 1 credit per try-on.
 */
import { AppError, Errors } from '../errors.js';
import { log } from '../log.js';
import type { JobStatus, SubmittedJob, TryOnInput, TryOnProvider } from './types.js';

const BASE_URL = 'https://api.fashn.ai/v1';
const MODEL = 'tryon-v1.6';
/** Max time we wait for one HTTP call to FASHN. */
const REQUEST_TIMEOUT_MS = 20_000;
/** FASHN ids are short alphanumeric strings. Anything else is rejected before it reaches a URL. */
const PREDICTION_ID = /^[A-Za-z0-9_-]{1,128}$/;

interface FashnError {
  name?: string;
  message?: string;
}
interface FashnRunResponse {
  id?: string;
  error?: FashnError | string | null;
}
interface FashnStatusResponse {
  id?: string;
  status?: 'starting' | 'in_queue' | 'processing' | 'completed' | 'failed' | 'canceled' | 'time_out';
  output?: string[] | null;
  error?: FashnError | string | null;
}

/** Turn FASHN's error names into our stable, shopper-friendly errors. */
export function mapFashnError(error: FashnError | string | null | undefined): AppError {
  const name = typeof error === 'string' ? error : error?.name ?? 'Unknown';
  const detail = typeof error === 'string' ? error : `${name}: ${error?.message ?? ''}`;
  switch (name) {
    case 'PoseError':
      return new AppError(
        'POSE_NOT_DETECTED',
        422,
        "We couldn't see you clearly. Try a front-facing photo where your full upper body is visible.",
        detail,
      );
    case 'NSFWError':
    case 'ContentModerationError':
      return new AppError('IMAGE_REJECTED', 422, "This photo can't be used. Please try a different one.", detail);
    case 'ImageLoadError':
    case 'PhotoTypeError':
    case 'InputValidationError':
      return new AppError('IMAGE_UNREADABLE', 422, "We couldn't read that photo. Please try another one.", detail);
    default:
      return Errors.providerUnavailable(detail);
  }
}

/** Map an HTTP failure (before any job exists) to our errors. */
function mapHttpFailure(status: number, body: string): AppError {
  if (status === 401 || status === 403) return Errors.misconfigured(`FASHN rejected API key (HTTP ${status})`);
  if (status === 402) return Errors.providerBusy('FASHN out of credits (HTTP 402)');
  if (status === 429) return Errors.providerBusy('FASHN rate limit (HTTP 429)');
  if (status >= 500) return Errors.providerUnavailable(`FASHN HTTP ${status}`);
  // 4xx: try to read FASHN's error body for a better message.
  try {
    const parsed = JSON.parse(body) as FashnRunResponse;
    if (parsed.error) return mapFashnError(parsed.error);
  } catch {
    /* not JSON — fall through */
  }
  return Errors.providerUnavailable(`FASHN HTTP ${status}`);
}

/** Make sure the result is a data URI the app can display directly. */
function toDataUri(output: string): string {
  if (output.startsWith('data:image/')) return output;
  return `data:image/jpeg;base64,${output}`;
}

export class FashnProvider implements TryOnProvider {
  readonly name = 'fashn';

  constructor(
    private readonly apiKey: string,
    /** Injected so tests can fake the network. */
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async call(path: string, init: RequestInit): Promise<{ status: number; text: string }> {
    try {
      const response = await this.fetchImpl(`${BASE_URL}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      return { status: response.status, text: await response.text() };
    } catch (error) {
      const isTimeout = (error as Error).name === 'TimeoutError' || (error as Error).name === 'AbortError';
      throw Errors.providerUnavailable(isTimeout ? `FASHN ${path} timed out` : `FASHN network error: ${(error as Error).message}`);
    }
  }

  async submit(input: TryOnInput): Promise<SubmittedJob> {
    const started = Date.now();
    // Not retried on purpose: a retry after a timeout could start (and bill) a second job.
    const { status, text } = await this.call('/run', {
      method: 'POST',
      body: JSON.stringify({
        model_name: MODEL,
        inputs: {
          model_image: input.personImage,
          garment_image: input.garmentImage,
          category: input.category,
          garment_photo_type: input.photoType,
          mode: 'balanced',
          moderation_level: 'conservative',
          num_samples: 1,
          output_format: 'jpeg',
          return_base64: true,
        },
      }),
    });

    if (status < 200 || status >= 300) throw mapHttpFailure(status, text);

    let parsed: FashnRunResponse;
    try {
      parsed = JSON.parse(text) as FashnRunResponse;
    } catch {
      throw Errors.providerUnavailable('FASHN /run returned non-JSON');
    }
    if (parsed.error) throw mapFashnError(parsed.error);
    if (!parsed.id || !PREDICTION_ID.test(parsed.id)) throw Errors.providerUnavailable('FASHN /run returned no valid id');

    log('info', 'fashn_submitted', { predictionId: parsed.id, ms: Date.now() - started, product: input.productId });
    return { predictionId: parsed.id };
  }

  async getStatus(predictionId: string): Promise<JobStatus> {
    if (!PREDICTION_ID.test(predictionId)) throw Errors.invalidJob('bad prediction id');

    // Status checks are safe to retry once (they don't cost credits).
    let result = await this.call(`/status/${predictionId}`, { method: 'GET' }).catch(() => null);
    if (!result || result.status >= 500) {
      result = await this.call(`/status/${predictionId}`, { method: 'GET' });
    }

    const { status, text } = result;
    if (status === 404) return { state: 'failed', error: Errors.invalidJob('prediction not found') };
    if (status < 200 || status >= 300) throw mapHttpFailure(status, text);

    let parsed: FashnStatusResponse;
    try {
      parsed = JSON.parse(text) as FashnStatusResponse;
    } catch {
      throw Errors.providerUnavailable('FASHN /status returned non-JSON');
    }

    switch (parsed.status) {
      case 'starting':
      case 'in_queue':
      case 'processing':
        return { state: 'processing' };

      case 'completed': {
        const first = parsed.output?.[0];
        if (!first) return { state: 'failed', error: Errors.providerUnavailable('completed with no output') };
        // After 60 min FASHN replaces base64 results with this marker (privacy deletion).
        if (first.includes('_expired')) {
          return {
            state: 'failed',
            error: new AppError('RESULT_EXPIRED', 410, 'This result was deleted for your privacy. Please try again.'),
          };
        }
        return { state: 'completed', imageDataUri: toDataUri(first) };
      }

      case 'failed':
      case 'canceled':
      case 'time_out':
        log('warn', 'fashn_job_failed', {
          predictionId,
          status: parsed.status,
          errorName: typeof parsed.error === 'object' ? parsed.error?.name : String(parsed.error),
        });
        return { state: 'failed', error: mapFashnError(parsed.error ?? parsed.status) };

      default:
        throw Errors.providerUnavailable(`unknown FASHN status "${String(parsed.status)}"`);
    }
  }
}
