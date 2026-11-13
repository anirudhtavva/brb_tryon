/**
 * GET /api/tryon-status — check on a try-on started with POST /api/tryon.
 *
 * Headers: x-app-key, x-job-token
 * Returns: 200 { "status": "processing" }
 *          200 { "status": "completed", "image": "data:image/jpeg;base64,..." }
 *          200 { "status": "failed", "error": { "code": "...", "message": "..." } }
 */
import { productionDeps } from '../src/deps.js';
import { createStatusHandler } from '../src/handlers.js';

export const GET = createStatusHandler(productionDeps);
