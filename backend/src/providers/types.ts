/**
 * The contract every try-on engine must follow.
 *
 * The rest of the backend only talks to this interface. To switch from FASHN to
 * another vendor or a self-hosted model, write one new file that implements
 * `TryOnProvider` and register it in `providers/index.ts`. Nothing else changes,
 * and the app never notices.
 */
import type { GarmentCategory } from '../catalog.js';
import type { AppError } from '../errors.js';

export interface TryOnInput {
  /** Shopper photo, base64 data URI. */
  personImage: string;
  /** Garment photo, base64 data URI. */
  garmentImage: string;
  category: GarmentCategory;
  photoType: 'model' | 'flat-lay' | 'auto';
  /** Our product id. Providers may ignore it (the mock uses it). */
  productId: string;
}

/** A job we've started. Providers are asynchronous: start, then poll. */
export interface SubmittedJob {
  predictionId: string;
}

/** Where a job is now, in our own words (not the vendor's). */
export type JobStatus =
  | { state: 'processing' }
  | { state: 'completed'; imageDataUri: string }
  | { state: 'failed'; error: AppError };

export interface TryOnProvider {
  readonly name: string;
  submit(input: TryOnInput): Promise<SubmittedJob>;
  getStatus(predictionId: string): Promise<JobStatus>;
}
