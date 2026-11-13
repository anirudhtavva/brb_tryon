/**
 * Which products can be tried on, and the garment photo the AI should use.
 *
 * The app only sends a `productId`. The garment image always comes from here,
 * never from the client. That stops anyone from using our credits to try on
 * arbitrary images from the internet.
 *
 * The ids must match `app/src/data/products.ts`.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Errors } from './errors.js';

/** FASHN categories: what part of the outfit the garment replaces. */
export type GarmentCategory = 'tops' | 'bottoms' | 'one-pieces' | 'auto';

export interface CatalogItem {
  /** File in /garments (bundled into the function via vercel.json `includeFiles`). */
  garmentFile: string;
  category: GarmentCategory;
  /** "model" = garment shown on a person, "flat-lay" = laid flat / ghost mannequin. */
  photoType: 'model' | 'flat-lay' | 'auto';
}

export const CATALOG: Readonly<Record<string, CatalogItem>> = {
  'sleeveless-brocade-mini-qipao-white': {
    garmentFile: 'qipao-white-brocade.jpg',
    category: 'one-pieces',
    photoType: 'model',
  },
  'v-neck-pankou-straight-qipao': {
    garmentFile: 'qipao-vneck-pankou.jpg',
    category: 'one-pieces',
    photoType: 'model',
  },
  'mens-linen-overshirt-brown': {
    garmentFile: 'mens-overshirt-brown.jpg',
    // Full outfit (shirt + trousers) in one pass = 1 credit.
    category: 'one-pieces',
    photoType: 'model',
  },
  'mens-printed-shirt-charcoal': {
    garmentFile: 'mens-shirt-grey.jpg',
    // Full outfit (shirt + trousers) in one pass = 1 credit.
    category: 'one-pieces',
    photoType: 'model',
  },
};

// Garment photos rarely change, so cache them per server instance.
const garmentCache = new Map<string, string>();

export function getCatalogItem(productId: string): CatalogItem {
  const item = CATALOG[productId];
  if (!item) throw Errors.unknownProduct(productId);
  return item;
}

/** Load the garment photo as a base64 data URI. */
export async function loadGarmentDataUri(item: CatalogItem): Promise<string> {
  const cached = garmentCache.get(item.garmentFile);
  if (cached) return cached;

  const filePath = path.join(process.cwd(), 'garments', item.garmentFile);
  try {
    const bytes = await readFile(filePath);
    const mime = item.garmentFile.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const dataUri = `data:${mime};base64,${bytes.toString('base64')}`;
    garmentCache.set(item.garmentFile, dataUri);
    return dataUri;
  } catch (error) {
    throw Errors.misconfigured(`garment file not found: ${filePath} (${(error as Error).message})`);
  }
}
