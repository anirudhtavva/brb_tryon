/** GET /api/health — quick check that the service is deployed and configured. No secrets returned. */
import { productionDeps } from '../src/deps.js';
import { createHealthHandler } from '../src/handlers.js';

export const GET = createHealthHandler(productionDeps);
