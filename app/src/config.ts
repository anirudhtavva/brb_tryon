/**
 * App settings, read from `app/.env` (see `.env.example`).
 * EXPO_PUBLIC_* values are baked into the app at build time.
 */
import { Platform } from 'react-native';

/**
 * Where the try-on server is.
 * - In Expo Go (iPhone app): EXPO_PUBLIC_API_BASE_URL, e.g. https://brb-tryon.vercel.app
 * - On the web build: left empty, so the app calls the same site it was loaded from
 *   (the web app and the server live on one Vercel address — no CORS, nothing to configure).
 */
function resolveApiBaseUrl(): string {
  const fromEnv = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return '';
}

export const config = {
  apiBaseUrl: resolveApiBaseUrl(),
  appKey: process.env.EXPO_PUBLIC_APP_KEY ?? '',
} as const;

/** True when the app has what it needs to call the try-on API. */
export const isTryOnConfigured = config.apiBaseUrl.length > 0 && config.appKey.length > 0;
