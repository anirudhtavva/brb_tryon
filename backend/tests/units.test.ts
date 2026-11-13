import { describe, expect, it } from 'vitest';
import { createJobToken, verifyJobToken } from '../src/jobToken.js';
import { MemoryCounterStore, reserveTryOn } from '../src/quota.js';
import { parseTryOnBody, validatePersonImage } from '../src/validation.js';
import { PERSON_JPEG, testConfig } from './helpers.js';

const SECRET = 's'.repeat(40);

describe('validatePersonImage', () => {
  it('accepts a real JPEG', () => {
    expect(validatePersonImage(PERSON_JPEG)).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('relabels a mislabelled file by its real bytes', () => {
    const lying = PERSON_JPEG.replace('image/jpeg', 'image/png');
    expect(validatePersonImage(lying)).toMatch(/^data:image\/jpeg;/);
  });

  it('rejects non-images even if labelled as JPEG', () => {
    const fake = `data:image/jpeg;base64,${Buffer.from('<svg>'.repeat(1000)).toString('base64')}`;
    expect(() => validatePersonImage(fake)).toThrow(/UNSUPPORTED_IMAGE/);
  });

  it('rejects remote URLs (we only accept uploaded bytes)', () => {
    expect(() => validatePersonImage('https://example.com/me.jpg')).toThrow(/UNSUPPORTED_IMAGE/);
  });

  it('rejects images over the size limit', () => {
    const huge = `data:image/jpeg;base64,${'A'.repeat(5_000_000)}`;
    expect(() => validatePersonImage(huge)).toThrow(/IMAGE_TOO_LARGE/);
  });

  it('rejects odd product ids', () => {
    expect(() => parseTryOnBody({ productId: '../etc/passwd', personImage: PERSON_JPEG })).toThrow(/INVALID_REQUEST/);
  });
});

describe('job tokens', () => {
  it('round-trips', () => {
    const token = createJobToken({ pid: 'abc123', prod: 'p' }, SECRET);
    expect(verifyJobToken(token, SECRET).pid).toBe('abc123');
  });

  it('rejects a tampered payload', () => {
    const token = createJobToken({ pid: 'abc123', prod: 'p' }, SECRET);
    const [, sig] = token.split('.');
    const forged = `${Buffer.from(JSON.stringify({ pid: 'someone-else', prod: 'p', exp: 9e9 })).toString('base64url')}.${sig}`;
    expect(() => verifyJobToken(forged, SECRET)).toThrow(/INVALID_JOB/);
  });

  it('rejects a token signed with another secret', () => {
    const token = createJobToken({ pid: 'abc', prod: 'p' }, 'o'.repeat(40));
    expect(() => verifyJobToken(token, SECRET)).toThrow(/INVALID_JOB/);
  });

  it('expires', () => {
    const token = createJobToken({ pid: 'abc', prod: 'p' }, SECRET, Date.now() - 60 * 60 * 1000);
    expect(() => verifyJobToken(token, SECRET)).toThrow(/expired/);
  });
});

describe('quota', () => {
  it('limits one user per hour', async () => {
    const store = new MemoryCounterStore();
    const config = testConfig({ rateLimitPerHour: 2 });
    await reserveTryOn(store, config, 'ip-a');
    await reserveTryOn(store, config, 'ip-a');
    await expect(reserveTryOn(store, config, 'ip-a')).rejects.toThrow(/RATE_LIMITED/);
    // Another user is unaffected.
    await expect(reserveTryOn(store, config, 'ip-b')).resolves.toBeDefined();
  });

  it('enforces the service-wide daily cap', async () => {
    const store = new MemoryCounterStore();
    const config = testConfig({ dailyTryOnCap: 2 });
    await reserveTryOn(store, config, 'a');
    await reserveTryOn(store, config, 'b');
    await expect(reserveTryOn(store, config, 'c')).rejects.toThrow(/DAILY_LIMIT_REACHED/);
  });

  it('gives the slot back on release', async () => {
    const store = new MemoryCounterStore();
    const config = testConfig({ dailyTryOnCap: 1 });
    const reservation = await reserveTryOn(store, config, 'a');
    await reservation.release();
    await expect(reserveTryOn(store, config, 'a')).resolves.toBeDefined();
  });

  it('fails closed when the counter store is down', async () => {
    const broken = { incr: async () => Promise.reject(new Error('down')), decr: async () => {} };
    await expect(reserveTryOn(broken, testConfig(), 'a')).rejects.toThrow(/PROVIDER_UNAVAILABLE/);
  });
});
