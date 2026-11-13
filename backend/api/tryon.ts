/**
 * POST /api/tryon — start a virtual try-on.
 *
 * Headers: x-app-key, content-type: application/json
 * Body:    { "productId": "sleeveless-brocade-mini-qipao-white", "personImage": "data:image/jpeg;base64,..." }
 * Returns: 202 { "jobToken": "...", "pollIntervalMs": 2000 }
 */
import { productionDeps } from '../src/deps.js';
import { createTryOnHandler } from '../src/handlers.js';

export const POST = createTryOnHandler(productionDeps);
