# Try-On: how the code is organised, who builds what, and the risks

*One-page note. Diagram: `docs/architecture.html`.*

## The shape of it

```
iPhone app ──HTTPS──▶ Our API (Vercel) ──HTTPS──▶ AI vendor (FASHN today)
                         │
                         └──▶ Redis (limits only, no photos)
```

The app never talks to the AI vendor. Our API sits in the middle and owns three things: **the key**, **the spend limits**, and **the privacy rules**. Starting a try-on and checking on it are two separate calls, because the AI takes 8–20 seconds and a phone connection can drop in that time.

## App codebase (`app/`)

```
src/app/          screens only (Expo Router: one file = one screen)
src/components/   UI pieces: header, carousel, size chips, try-on sheet…
src/hooks/        useTryOn: the flow as a state machine (idle → upload → processing → done/error)
src/services/     tryOnApi: the only file that knows our API's URLs
src/utils/        preparePhoto: resize + strip location data before upload
src/data/         product data (hardcoded for now, swapped for the real catalog API later)
src/theme.ts      colours and type sizes, taken from the current app
```

Rule of thumb: screens don't call `fetch`, and components don't know about job tokens. That keeps the try-on feature easy to drop into the real BRB app: copy `TryOnSheet`, `useTryOn` and `tryOnApi`, add one button.

This prototype is organized **by type of code**, which suits its size. In the real BRB app I'd organize **by feature**: `features/try-on`, `features/product`, `features/cart`, each owned by one team, plus a shared design system (`shared/ui`) and one shared server client (`shared/api`). Try-on is already self-contained, so it moves into `features/try-on/` almost as is.

## Backend codebase (`backend/`)

```
api/              thin route files (3 endpoints)
src/handlers.ts   the endpoint logic, testable without a server
src/providers/    one file per AI vendor + the shared interface  ← vendor lock-in stops here
src/quota.ts      per-person and daily limits
src/jobToken.ts   signed, expiring job tokens (no database needed)
src/validation.ts photo checks before any money is spent
src/catalog.ts    which products can be tried on, and their garment photos
```

## Splitting the work

| | App team | Backend team |
|---|---|---|
| Owns | Screens, photo capture, loading/result UX, error copy placement | API, vendor adapter, limits, privacy, cost monitoring |
| Shared contract | The 3 endpoints + error `code` list in the README. Agree on it first, then both sides work in parallel |
| Can work alone because | Backend has a **mock mode**, so the app team never waits for the AI or spends credits | Endpoint tests run against a fake vendor network |

**How changes ship:** every change is a GitHub pull request. Automatic checks (42 server tests, typechecks, a web build) must pass, Vercel posts a preview link to try it on a phone, and merging to `main` puts it live in about 2 minutes.

Merging into the real BRB app: products come from the existing catalog API, and the backend catalog becomes a `tryOnEnabled` flag + garment photo per product in that catalog.

## Risks and what covers them

| Risk | Impact | Mitigation now | Next step |
|---|---|---|---|
| Vendor shuts down / raises prices | Feature stops | Provider interface: swap = 1 new file | Keep a 2nd vendor adapter tested |
| Credits drained by abuse or a bug | Unplanned spend | Per-IP + daily caps, catalog-only garments, no auto-retry of paid calls, fail-closed limits | Per-user limits once login exists; spend alerts |
| App key extracted from the app | Others call our API | It's only a speed bump; the caps above are the real guard | Signed user sessions |
| Personal photos leak | Trust, legal (HK PDPO, GDPR) | Never stored by us, base64 in/out, auto-deleted by vendor, EXIF stripped, logs redacted | Vendor data agreement; privacy notice review |
| Poor results on some photos/bodies | Shoppers lose trust | Clear photo tips, friendly retry messages, "AI preview" label | Quality test set across body types and skin tones before launch |
| Slow AI (queues) | Drop-off | Live progress, 2-min timeout, cancel, resilient polling | Push updates; faster mode if quality holds |
| Vercel free plan is non-commercial | Can't launch on it | Fine for the prototype | Vercel Pro before go-live |
| Shared office Wi-Fi = one IP | Colleagues share a limit | Cap set generously | Per-user limits |
