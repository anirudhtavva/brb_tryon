/**
 * FASHN adapter tests with a fake network, so no credits are spent.
 * Response shapes follow https://docs.fashn.ai/api-reference/tryon-v1-6
 */
import { describe, expect, it, vi } from 'vitest';
import { FashnProvider } from '../src/providers/fashn.js';
import type { TryOnInput } from '../src/providers/types.js';

const INPUT: TryOnInput = {
  personImage: 'data:image/jpeg;base64,AAAA',
  garmentImage: 'data:image/jpeg;base64,BBBB',
  category: 'one-pieces',
  photoType: 'model',
  productId: 'p',
};

function fakeFetch(...responses: Array<{ status: number; body: unknown } | Error>) {
  const fn = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) fn.mockRejectedValueOnce(r);
    else fn.mockResolvedValueOnce(new Response(JSON.stringify(r.body), { status: r.status }));
  }
  return fn as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe('FashnProvider.submit', () => {
  it('sends a private, 1-credit request and returns the id', async () => {
    const fetchMock = fakeFetch({ status: 200, body: { id: 'pred_123', error: null } });
    const provider = new FashnProvider('key', fetchMock);

    await expect(provider.submit(INPUT)).resolves.toEqual({ predictionId: 'pred_123' });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.fashn.ai/v1/run');
    expect(init.headers.Authorization).toBe('Bearer key');
    const sent = JSON.parse(init.body);
    expect(sent.model_name).toBe('tryon-v1.6');
    expect(sent.inputs).toMatchObject({ num_samples: 1, return_base64: true, output_format: 'jpeg' });
  });

  it('maps a bad API key to a config error (not the shopper’s fault)', async () => {
    const provider = new FashnProvider('bad', fakeFetch({ status: 401, body: { error: 'unauthorized' } }));
    await expect(provider.submit(INPUT)).rejects.toMatchObject({ code: 'SERVER_MISCONFIGURED' });
  });

  it('maps rate limiting to PROVIDER_BUSY', async () => {
    const provider = new FashnProvider('k', fakeFetch({ status: 429, body: {} }));
    await expect(provider.submit(INPUT)).rejects.toMatchObject({ code: 'PROVIDER_BUSY' });
  });

  it('does NOT retry /run on network failure (could double-bill)', async () => {
    const fetchMock = fakeFetch(new Error('socket hang up'));
    const provider = new FashnProvider('k', fetchMock);
    await expect(provider.submit(INPUT)).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats a timeout as PROVIDER_UNAVAILABLE', async () => {
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    const provider = new FashnProvider('k', fakeFetch(timeout));
    await expect(provider.submit(INPUT)).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
  });
});

describe('FashnProvider.getStatus', () => {
  it.each(['starting', 'in_queue', 'processing'])('%s → processing', async (status) => {
    const provider = new FashnProvider('k', fakeFetch({ status: 200, body: { id: 'p1', status } }));
    await expect(provider.getStatus('p1')).resolves.toEqual({ state: 'processing' });
  });

  it('returns the image as a data URI when completed', async () => {
    const provider = new FashnProvider(
      'k',
      fakeFetch({ status: 200, body: { id: 'p1', status: 'completed', output: ['data:image/jpeg;base64,ZZZ'] } }),
    );
    await expect(provider.getStatus('p1')).resolves.toEqual({
      state: 'completed',
      imageDataUri: 'data:image/jpeg;base64,ZZZ',
    });
  });

  it('adds the data URI prefix if FASHN sends raw base64', async () => {
    const provider = new FashnProvider('k', fakeFetch({ status: 200, body: { status: 'completed', output: ['ZZZ'] } }));
    await expect(provider.getStatus('p1')).resolves.toMatchObject({ imageDataUri: 'data:image/jpeg;base64,ZZZ' });
  });

  it('reports privacy-expired results clearly', async () => {
    const provider = new FashnProvider(
      'k',
      fakeFetch({ status: 200, body: { status: 'completed', output: ['<base64>_expired'] } }),
    );
    const result = await provider.getStatus('p1');
    expect(result.state === 'failed' && result.error.code).toBe('RESULT_EXPIRED');
  });

  it.each([
    ['PoseError', 'POSE_NOT_DETECTED'],
    ['NSFWError', 'IMAGE_REJECTED'],
    ['ImageLoadError', 'IMAGE_UNREADABLE'],
    ['PipelineError', 'PROVIDER_UNAVAILABLE'],
  ])('maps %s → %s', async (name, code) => {
    const provider = new FashnProvider(
      'k',
      fakeFetch({ status: 200, body: { status: 'failed', error: { name, message: 'x' } } }),
    );
    const result = await provider.getStatus('p1');
    expect(result.state === 'failed' && result.error.code).toBe(code);
  });

  it('retries a status check once after a server error', async () => {
    const fetchMock = fakeFetch({ status: 502, body: {} }, { status: 200, body: { status: 'processing' } });
    const provider = new FashnProvider('k', fetchMock);
    await expect(provider.getStatus('p1')).resolves.toEqual({ state: 'processing' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refuses ids that could change the URL path', async () => {
    const provider = new FashnProvider('k', fakeFetch());
    await expect(provider.getStatus('../credits')).rejects.toMatchObject({ code: 'INVALID_JOB' });
  });
});
