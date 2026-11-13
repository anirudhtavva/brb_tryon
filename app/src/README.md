# app/src/ — all app code

Organized by type of code, with one rule: screens never talk to the server; only `services/tryOnApi.ts` does.

| Folder / file | What it holds |
|---|---|
| `app/` | Screens (Expo Router: one file = one screen) |
| `components/` | Reusable building blocks: header, carousel, try-on sheet… |
| `hooks/` | The try-on flow as a state machine |
| `services/` | The only code that calls the try-on server |
| `utils/` | Small helpers: shrink photos, delete temp files, pop-ups |
| `data/` | The hardcoded demo products |
| `theme.ts` | Colours and text sizes from the BRB screenshots |
| `config.ts` | Server address and app key, read from `.env` |
