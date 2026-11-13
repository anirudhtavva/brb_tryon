/**
 * Free stand-in for FASHN, for building and demoing the UI without spending credits.
 *
 * It needs no database: the prediction id itself carries the product and the
 * start time ("mock.<product>.<startMs>"), so the status call can work out
 * whether the fake job is "done" yet. The "result" is the garment photo, so it's
 * obvious on screen that this was not a real try-on.
 */
import { AppError, Errors } from '../errors.js';
import { getCatalogItem, loadGarmentDataUri } from '../catalog.js';
import type { JobStatus, SubmittedJob, TryOnInput, TryOnProvider } from './types.js';

export class MockProvider implements TryOnProvider {
  readonly name = 'mock';

  constructor(
    private readonly delayMs: number,
    private readonly outcome: 'success' | 'fail',
    private readonly now: () => number = Date.now,
  ) {}

  async submit(input: TryOnInput): Promise<SubmittedJob> {
    return { predictionId: `mock.${input.productId}.${this.now()}` };
  }

  async getStatus(predictionId: string): Promise<JobStatus> {
    const [prefix, productId, startedAt] = predictionId.split('.');
    if (prefix !== 'mock' || !productId || !startedAt) throw Errors.invalidJob('not a mock id');

    if (this.now() - Number(startedAt) < this.delayMs) return { state: 'processing' };

    if (this.outcome === 'fail') {
      return {
        state: 'failed',
        error: new AppError(
          'POSE_NOT_DETECTED',
          422,
          "We couldn't see you clearly. Try a front-facing photo where your full upper body is visible.",
          'mock forced failure',
        ),
      };
    }
    return { state: 'completed', imageDataUri: await loadGarmentDataUri(getCatalogItem(productId)) };
  }
}
