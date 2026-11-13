# backend/api/ — the public endpoints

Each file is one web address on Vercel. They only connect the request to the logic in `src/handlers.ts`.

- `tryon.ts` — `POST /api/tryon`: start a try-on
- `tryon-status.ts` — `GET /api/tryon-status`: check for the result
- `health.ts` — `GET /api/health`: is the server up
