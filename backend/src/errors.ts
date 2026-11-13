/**
 * One error type for the whole backend.
 *
 * Every failure the app can see has:
 *  - a stable `code` the app can switch on (never changes once shipped),
 *  - an HTTP status,
 *  - a short, friendly `message` that is safe to show to a shopper.
 *
 * Internal details (stack traces, provider messages) are logged, never returned.
 */

export type ErrorCode =
  | 'INVALID_REQUEST' // body is malformed or missing fields
  | 'UNKNOWN_PRODUCT' // productId is not in the catalog
  | 'UNSUPPORTED_IMAGE' // not a JPEG/PNG/WebP, or not a real image
  | 'IMAGE_TOO_LARGE' // photo is above the size limit
  | 'UNAUTHORIZED' // missing/wrong app key
  | 'RATE_LIMITED' // this user tried too many times recently
  | 'DAILY_LIMIT_REACHED' // service-wide daily cap hit (protects credits)
  | 'INVALID_JOB' // job token missing, tampered or expired
  | 'POSE_NOT_DETECTED' // AI could not find a clear full person
  | 'IMAGE_REJECTED' // content moderation blocked the photo
  | 'IMAGE_UNREADABLE' // AI could not load / decode the photo
  | 'RESULT_EXPIRED' // result was deleted (privacy window passed)
  | 'PROVIDER_BUSY' // AI service is overloaded or rate limiting us
  | 'PROVIDER_UNAVAILABLE' // AI service timed out or is down
  | 'SERVER_MISCONFIGURED' // a required env var is missing / key rejected
  | 'INTERNAL'; // anything else

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    /** Safe to show to the shopper. */
    public readonly publicMessage: string,
    /** Extra detail for logs only. */
    public readonly internalDetail?: string,
  ) {
    super(internalDetail ? `${code}: ${internalDetail}` : code);
    this.name = 'AppError';
  }
}

/** Shortcuts for the errors we raise most often. */
export const Errors = {
  invalidRequest: (detail: string) =>
    new AppError('INVALID_REQUEST', 400, 'Something went wrong with that request.', detail),
  unknownProduct: (id: string) =>
    new AppError('UNKNOWN_PRODUCT', 400, 'This product is not available for try-on.', `productId=${id}`),
  unsupportedImage: (detail: string) =>
    new AppError('UNSUPPORTED_IMAGE', 415, 'Please choose a JPEG or PNG photo.', detail),
  imageTooLarge: (bytes: number) =>
    new AppError('IMAGE_TOO_LARGE', 413, 'That photo is too large. Please try another one.', `bytes=${bytes}`),
  unauthorized: () => new AppError('UNAUTHORIZED', 401, 'This app is not allowed to use try-on.'),
  rateLimited: (retryAfterSec: number) =>
    new AppError(
      'RATE_LIMITED',
      429,
      `You've tried on a lot of looks. Please try again in about ${Math.max(1, Math.ceil(retryAfterSec / 60))} min.`,
      `retryAfter=${retryAfterSec}`,
    ),
  dailyLimit: () =>
    new AppError('DAILY_LIMIT_REACHED', 429, 'Try-on is very popular today. Please come back tomorrow.'),
  invalidJob: (detail: string) =>
    new AppError('INVALID_JOB', 400, 'This try-on has expired. Please start again.', detail),
  misconfigured: (detail: string) =>
    new AppError('SERVER_MISCONFIGURED', 500, 'Try-on is temporarily unavailable.', detail),
  providerBusy: (detail: string) =>
    new AppError('PROVIDER_BUSY', 503, 'Try-on is busy right now. Please try again in a minute.', detail),
  providerUnavailable: (detail: string) =>
    new AppError('PROVIDER_UNAVAILABLE', 503, 'Try-on is temporarily unavailable. Please try again soon.', detail),
  internal: (detail: string) => new AppError('INTERNAL', 500, 'Something went wrong. Please try again.', detail),
} as const;
