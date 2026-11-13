# backend/src/providers/ — the AI vendor plug

The only folder that knows which AI is used. Swapping vendors = add one file here.

- `types.ts` — the contract any vendor must follow
- `fashn.ts` — FASHN, with privacy options switched on
- `mock.ts` — a free fake AI for testing without spending credits
- `index.ts` — picks one, based on the `TRYON_PROVIDER` setting
