# backend/src/ — the server logic

| File | Job |
|---|---|
| `handlers.ts` | What each endpoint does: check, limit, start the job, return the result |
| `validation.ts` | Rejects bad photos before any money is spent |
| `quota.ts` | Per-person and daily limits that protect the AI credits |
| `jobToken.ts` | Signed, expiring tickets so only you can fetch your result |
| `catalog.ts` | Which products can be tried on, and their garment photo |
| `errors.ts` | Every error code, with a shopper-friendly message |
| `http.ts`, `config.ts`, `log.ts`, `deps.ts` | Shared plumbing: replies, settings, privacy-safe logs |
| `providers/` | The AI vendor plug (FASHN today, swappable) |
