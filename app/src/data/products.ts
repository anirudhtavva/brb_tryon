/**
 * Hardcoded demo catalog (the brief says no backend connection for products).
 *
 * `id` values for try-on items MUST match `backend/src/catalog.ts`, because the
 * backend only accepts known ids and picks the garment photo itself.
 */
export type Audience = 'women' | 'men';

export interface Product {
  id: string;
  name: string;
  store: { name: string; isOpen: boolean };
  priceHkd: number;
  audience: Audience;
  sizes: string[];
  description: string;
  /** Carousel images, as bundled assets (`require(...)`). Empty = show a placeholder. */
  images: number[];
  deliveryMinutes: number;
  /** Only clothing that the backend catalog knows about can be tried on. */
  tryOnEnabled: boolean;
}

const QIPOLOGY = { name: 'Qipology', isOpen: false };

export const PRODUCTS: Product[] = [
  {
    id: 'sleeveless-brocade-mini-qipao-white',
    name: 'Sleeveless Brocade Mini Qipao (White)',
    store: QIPOLOGY,
    priceHkd: 1880,
    audience: 'women',
    sizes: ['XXS', 'XS', 'S', 'M'],
    description:
      "The sleeveless mini dress is made from a brocade in a beautiful white that will ensure you shine at different events. It's cut in a simple A-line silhouette, and can be dressed up with heels, or down in flats. This is a great option as a simple civil ceremony dress or graduation too.",
    images: [require('../../assets/products/qipao-white-1.jpg'), require('../../assets/products/qipao-white-2.jpg')],
    deliveryMinutes: 90,
    tryOnEnabled: true,
  },
  {
    id: 'v-neck-pankou-straight-qipao',
    name: 'V-neck Pankou Straight-Cut Qipao (Sage)',
    store: QIPOLOGY,
    priceHkd: 1380,
    audience: 'women',
    sizes: ['XS', 'S', 'M', 'L'],
    // Placeholder copy — replace with the real description from the store.
    description:
      'A relaxed straight-cut qipao with a soft V-neck and a hand-knotted pankou button. Easy to wear from the office to dinner.',
    images: [require('../../assets/products/qipao-vneck-1.jpg')],
    deliveryMinutes: 90,
    tryOnEnabled: true,
  },
  {
    id: 'qipology-red-envelope',
    name: 'Qipology Red Envelope',
    store: QIPOLOGY,
    priceHkd: 25,
    audience: 'women',
    sizes: [],
    description: 'Gold-foiled red envelopes, a pack for Lunar New Year and celebrations.',
    images: [require('../../assets/products/red-envelope-1.jpg')],
    deliveryMinutes: 90,
    tryOnEnabled: false, // accessories can't be tried on
  },
  {
    id: 'mens-linen-overshirt-brown',
    name: "Men's Linen Overshirt & Cream Trousers",
    store: { name: 'BRB Men', isOpen: true },
    priceHkd: 980,
    audience: 'men',
    sizes: ['S', 'M', 'L', 'XL'],
    // Placeholder copy — replace with the real description from the store.
    description: 'The full look: a relaxed brown linen overshirt over a white tee, with wide cream trousers. Try on puts the whole outfit on you.',
    images: [require('../../assets/products/mens-overshirt-brown-1.jpg')],
    deliveryMinutes: 90,
    tryOnEnabled: true,
  },
  {
    id: 'mens-printed-shirt-charcoal',
    name: "Men's Charcoal Shirt & White Trousers",
    store: { name: 'BRB Men', isOpen: true },
    priceHkd: 690,
    audience: 'men',
    sizes: ['S', 'M', 'L', 'XL'],
    // Placeholder copy — replace with the real description from the store.
    description: 'The full look: a slim charcoal micro-print shirt with tailored white trousers. Try on puts the whole outfit on you.',
    images: [require('../../assets/products/mens-shirt-grey-1.jpg')],
    deliveryMinutes: 90,
    tryOnEnabled: true,
  },
];

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

/** Up to `limit` other products to show under "Related Products". */
export function getRelated(id: string, limit = 6): Product[] {
  const current = getProduct(id);
  return PRODUCTS.filter((p) => p.id !== id && p.audience === current?.audience).slice(0, limit);
}

/** "HKD 1,880.00" (big price) or "HK$1,880.00" (small price), like the current app. */
export function formatPrice(hkd: number, style: 'long' | 'short' = 'long'): string {
  const amount = hkd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return style === 'long' ? `HKD ${amount}` : `HK$${amount}`;
}
