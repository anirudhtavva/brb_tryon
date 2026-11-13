/**
 * Real dependencies for production. Kept separate from handlers.ts so tests
 * never touch the real network or environment by accident.
 */
import { loadConfig } from './config.js';
import type { Deps } from './handlers.js';
import { createProvider } from './providers/index.js';
import { createCounterStore } from './quota.js';

export function productionDeps(): Deps {
  const config = loadConfig();
  return { config, provider: createProvider(config), store: createCounterStore(config) };
}
