/**
 * Guards against the app and backend catalogs drifting apart:
 * every product the app shows a "Try on" button for must exist here,
 * and every garment file must actually be in /garments.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/catalog.js';

const appProducts = readFileSync(path.join(process.cwd(), '..', 'app', 'src', 'data', 'products.ts'), 'utf8');

/** Pull `id: '...'` values whose block says `tryOnEnabled: true`. */
function tryOnIdsInApp(): string[] {
  return [...appProducts.matchAll(/id: '([a-z0-9-]+)'[\s\S]*?tryOnEnabled: (true|false)/g)]
    .filter((m) => m[2] === 'true')
    .map((m) => m[1]!);
}

describe('catalog sync', () => {
  it('every try-on product in the app exists in the backend catalog', () => {
    const ids = tryOnIdsInApp();
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(CATALOG, `missing backend entry for ${id}`).toHaveProperty(id);
  });

  it('every garment file exists', () => {
    for (const item of Object.values(CATALOG)) {
      expect(existsSync(path.join(process.cwd(), 'garments', item.garmentFile)), item.garmentFile).toBe(true);
    }
  });
});
