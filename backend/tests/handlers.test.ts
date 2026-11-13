/** End-to-end tests of the endpoints, using the mock provider (no network, no credits). */
import { describe, expect, it } from 'vitest';
import { createStatusHandler, createTryOnHandler, type Deps } from '../src/handlers.js';
import { MockProvider } from '../src/providers/mock.js';
import type { TryOnProvider } from '../src/providers/types.js';
import { MemoryCounterStore } from '../src/quota.js';
import { getStatus, PERSON_JPEG, postTryOn, testConfig } from './helpers.js';

const PRODUCT = 'sleeveless-brocade-mini-qipao-white';

function makeDeps(overrides: Partial<Deps> = {}): Deps {
  return { config: testConfig(), provider: new MockProvider(0, 'success'), store: new MemoryCounterStore(), ...overrides };
}

describe('POST /api/tryon → GET /api/tryon-status', () => {
  it('runs the full happy path', async () => {
    const deps = makeDeps();
    const submit = await createTryOnHandler(() => deps)(postTryOn({ productId: PRODUCT, personImage: PERSON_JPEG }));
    expect(submit.status).toBe(202);
    const { jobToken } = (await submit.json()) as { jobToken: string };

    const status = await createStatusHandler(() => deps)(getStatus(jobToken));
    const body = (await status.json()) as { status: string; image: string };
    expect(body.status).toBe('completed');
    expect(body.image).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('reports "processing" while the job runs', async () => {
    const deps = makeDeps({ provider: new MockProvider(60_000, 'success') });
    const submit = await createTryOnHandler(() => deps)(postTryOn({ productId: PRODUCT, personImage: PERSON_JPEG }));
    const { jobToken } = (await submit.json()) as { jobToken: string };
    const body = await (await createStatusHandler(() => deps)(getStatus(jobToken))).json();
    expect(body).toMatchObject({ status: 'processing' });
  });

  it('passes job failures through as friendly messages', async () => {
    const deps = makeDeps({ provider: new MockProvider(0, 'fail') });
    const submit = await createTryOnHandler(() => deps)(postTryOn({ productId: PRODUCT, personImage: PERSON_JPEG }));
    const { jobToken } = (await submit.json()) as { jobToken: string };
    const body = await (await createStatusHandler(() => deps)(getStatus(jobToken))).json();
    expect(body).toMatchObject({ status: 'failed', error: { code: 'POSE_NOT_DETECTED' } });
  });

  it('rejects calls without the app key', async () => {
    const res = await createTryOnHandler(makeDeps)(
      postTryOn({ productId: PRODUCT, personImage: PERSON_JPEG }, { 'x-app-key': 'wrong' }),
    );
    expect(res.status).toBe(401);
  });

  it('rejects products not in the catalog (no arbitrary garments)', async () => {
    const res = await createTryOnHandler(makeDeps)(postTryOn({ productId: 'not-a-product', personImage: PERSON_JPEG }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'UNKNOWN_PRODUCT' } });
  });

  it('never leaks internal details in errors', async () => {
    const exploding: TryOnProvider = {
      name: 'boom',
      submit: async () => {
        throw new Error('secret stack detail sk_live_123');
      },
      getStatus: async () => ({ state: 'processing' }),
    };
    const res = await createTryOnHandler(() => makeDeps({ provider: exploding }))(
      postTryOn({ productId: PRODUCT, personImage: PERSON_JPEG }),
    );
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('sk_live_123');
  });

  it('refunds the quota when the provider fails to start a job', async () => {
    const store = new MemoryCounterStore();
    const failing: TryOnProvider = {
      name: 'down',
      submit: async () => {
        throw new Error('down');
      },
      getStatus: async () => ({ state: 'processing' }),
    };
    const config = testConfig({ dailyTryOnCap: 1 });
    await createTryOnHandler(() => makeDeps({ config, store, provider: failing }))(
      postTryOn({ productId: PRODUCT, personImage: PERSON_JPEG }),
    );
    // The cap is 1 and the first attempt failed, so this one must still go through.
    const res = await createTryOnHandler(() => makeDeps({ config, store }))(
      postTryOn({ productId: PRODUCT, personImage: PERSON_JPEG }),
    );
    expect(res.status).toBe(202);
  });

  it('rate limits per user and says when to come back', async () => {
    const deps = makeDeps({ config: testConfig({ rateLimitPerHour: 1 }) });
    const handler = createTryOnHandler(() => deps);
    await handler(postTryOn({ productId: PRODUCT, personImage: PERSON_JPEG }));
    const res = await handler(postTryOn({ productId: PRODUCT, personImage: PERSON_JPEG }));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
  });

  it('rejects a forged job token', async () => {
    const res = await createStatusHandler(makeDeps)(getStatus('eyJwaWQiOiJ4In0.bad-signature'));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'INVALID_JOB' } });
  });
});
