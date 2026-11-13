/**
 * Input checks for the try-on request.
 *
 * We never trust the client. The photo must be a real JPEG/PNG/WebP (checked by
 * its first bytes, not just the label), and small enough to fit Vercel's 4.5 MB
 * request limit with room to spare.
 */
import { Errors } from './errors.js';

/** ~3 MB decoded. The app resizes to ~1024px, which is usually 150–400 KB. */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
/** Anything under ~2 KB is not a usable photo of a person. */
export const MIN_IMAGE_BYTES = 2 * 1024;

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AllowedMime = (typeof ALLOWED_MIME)[number];

const DATA_URI = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/]+={0,2})$/;
const PRODUCT_ID = /^[a-z0-9-]{1,64}$/;

export interface TryOnRequestBody {
  productId: string;
  /** The shopper's photo as `data:image/jpeg;base64,...` */
  personImage: string;
}

/** Detect the real file type from its first bytes ("magic numbers"). */
function sniffMime(bytes: Buffer): AllowedMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP')
    return 'image/webp';
  return null;
}

/**
 * Check a base64 data URI and return a normalised copy.
 * Throws a friendly AppError if anything is off.
 */
export function validatePersonImage(dataUri: unknown): string {
  if (typeof dataUri !== 'string') throw Errors.invalidRequest('personImage must be a string');

  // Cheap length check first, before running a regex over megabytes of text.
  const approxBytes = Math.floor((dataUri.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES + 1024) throw Errors.imageTooLarge(approxBytes);

  const match = DATA_URI.exec(dataUri);
  if (!match) throw Errors.unsupportedImage('not a base64 image data URI');
  const [, declaredMime, base64] = match as unknown as [string, string, string];

  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > MAX_IMAGE_BYTES) throw Errors.imageTooLarge(bytes.length);
  if (bytes.length < MIN_IMAGE_BYTES) throw Errors.unsupportedImage(`too small: ${bytes.length} bytes`);

  const realMime = sniffMime(bytes);
  if (!realMime) throw Errors.unsupportedImage(`unrecognised file signature (declared ${declaredMime})`);

  // Rebuild the URI with the real type, so a mislabelled file can't confuse the provider.
  return `data:${realMime};base64,${base64}`;
}

/** Parse and validate the JSON body of POST /api/tryon. */
export function parseTryOnBody(body: unknown): TryOnRequestBody {
  if (typeof body !== 'object' || body === null) throw Errors.invalidRequest('body must be a JSON object');
  const { productId, personImage } = body as Record<string, unknown>;

  if (typeof productId !== 'string' || !PRODUCT_ID.test(productId)) {
    throw Errors.invalidRequest('productId must be a lowercase slug');
  }
  return { productId, personImage: validatePersonImage(personImage) };
}
