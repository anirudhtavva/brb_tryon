/**
 * Picks the try-on engine from config. This is the ONLY place that knows
 * which vendor we use. Add a new `case` here to plug in another provider.
 */
import type { Config } from '../config.js';
import { Errors } from '../errors.js';
import { FashnProvider } from './fashn.js';
import { MockProvider } from './mock.js';
import type { TryOnProvider } from './types.js';

export function createProvider(config: Config): TryOnProvider {
  switch (config.provider) {
    case 'fashn':
      if (!config.fashnApiKey) throw Errors.misconfigured('FASHN_API_KEY missing');
      return new FashnProvider(config.fashnApiKey);
    case 'mock':
      return new MockProvider(config.mock.delayMs, config.mock.outcome);
  }
}

export type { TryOnProvider } from './types.js';
