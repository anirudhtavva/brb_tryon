# backend/ — the try-on server (Vercel)

Sits between the app and the AI. It keeps the API key, limits spending, and never stores photos.

- `api/` — the 3 endpoints Vercel serves
- `src/` — the server logic
- `garments/` — garment photos sent to the AI
- `tests/` — 42 automatic tests
- `scripts/` — run locally, and the Vercel build step

Run locally: `npm install`, `cp .env.example .env.local`, `npm run local`. Check: `npm run check`.
