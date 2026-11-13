# BRB Virtual Try-On

Pick a product, upload a photo, see it on you.

```
app/       React Native + Expo (SDK 58) — product page rebuild + "Try on" flow
backend/   Vercel serverless API — calls the AI, keeps the key, guards credits and privacy
docs/      Architecture note (one page) + diagram for the CEO
```

---

## Try it

**Fastest: on any iPhone, no install.** Open **https://brb-tryon.vercel.app** in Safari.

**In Expo Go (the native app), in 2 minutes.** You need Node 20+ and the **Expo Go** app (App Store). Phone and laptop on the same Wi-Fi.

```bash
cd app
npm install
cp .env.example .env          # already points at the live server
npx expo start                # scan the QR code with the iPhone camera
```

On a Mac with Xcode, press `i` instead to open it in the iPhone Simulator. On office Wi-Fi that blocks phones, use `npx expo start --tunnel`.

## Run everything locally (free, no credits used)

```bash
# 1. Server, in mock mode (fake try-ons, $0)
cd backend
npm install
cp .env.example .env.local
#   fill in JOB_TOKEN_SECRET (openssl rand -hex 32) and APP_CLIENT_KEY (openssl rand -hex 16)
npm run local                 # → http://localhost:3000/api/health

# 2. App, pointed at your laptop
cd ../app
npm install
cp .env.example .env
#   EXPO_PUBLIC_API_BASE_URL=http://<your laptop's Wi-Fi IP>:3000
#   EXPO_PUBLIC_APP_KEY=<same value as APP_CLIENT_KEY>
npx expo start
```

In mock mode the "result" is the product photo after ~4 seconds. That's on purpose: it proves the whole flow without spending a credit. On a Mac, `Start BRB Try-On.command` does all of this in one double-click.

**Going live:** set `TRYON_PROVIDER=fashn` and `FASHN_API_KEY=...`, restart. That's the only change.

## Put it online: one link for any iPhone (easiest)

Double-click **`Deploy to Vercel.command`** (after running the Start launcher once, so your settings exist). It:

1. builds the app for the web, so it runs in Safari on any iPhone (11 to 18), with nothing to install,
2. logs you in to Vercel (first time: a browser window opens; a free account is fine),
3. copies your settings (FASHN key, limits, secrets) to Vercel as environment variables,
4. puts the web app **and** the try-on server live on one address, e.g. `https://brb-tryon.vercel.app`,
5. points the Expo Go app at that address too, saves it in `LIVE LINK.txt`, and opens it.

Share that link. On an iPhone: open it in Safari, then Share → Add to Home Screen to make it look like an app.

**Expo Go (native app):** after deploying, run `Start BRB Try-On.command` and scan the QR code with the iPhone camera (same Wi-Fi as the Mac). The phone loads the app from the Mac and does try-ons on Vercel. On blocked Wi-Fi, use the phone's hotspot or `npx expo start --tunnel` in `app/`.

If the link shows a Vercel login page: vercel.com → brb-tryon → Settings → Deployment Protection → turn off Vercel Authentication.

Recommended once live: Vercel → Storage → add **Upstash Redis** (free), then deploy again, so limits are shared across Vercel's servers.

## Working as a team: how a teammate's change goes live

The flow is the usual one, and only the first setup is manual:

1. **Code lives on GitHub.** Each change is made on its own branch and opened as a pull request.
2. **Checks run by themselves.** GitHub Actions (`.github/workflows/ci.yml`) runs the server typecheck, the 42 server tests, the app typecheck and a web build. A red check blocks the merge.
3. **Try it before merging.** Vercel posts a preview link on the pull request, so the change can be tried on a phone first.
4. **Merge = live.** Merging to `main` makes Vercel rebuild the web app from `app/` and the server from `backend/`, and the live link updates within about 2 minutes (`backend/scripts/vercel-build.sh`).

**One-time setup** (after the repo is on GitHub): Vercel → brb-tryon → Settings → Git → connect the repo, then Settings → Build and Deployment → Root Directory = `backend`. Settings already copied by the deploy script stay as they are.

**Who touches what**

| Area | Folder | Watch out for |
|---|---|---|
| Screens, styling, products | `app/src/app`, `app/src/components`, `app/src/data` | A product id with Try on must also be in `backend/src/catalog.ts` (a test checks this) |
| Try-on flow on the phone | `app/src/hooks`, `app/src/services` | The API contract below; error `code`s never change once shipped |
| Server logic, limits, privacy | `backend/src` | Add or update a test in `backend/tests` with every change |
| AI vendor | `backend/src/providers` | New vendor = new file following `types.ts` |

Never commit `.env` files or keys: they are in `.gitignore`, and keys live in Vercel's settings.

## API

| Call | Headers | Body / result |
|---|---|---|
| `POST /api/tryon` | `x-app-key` | `{ productId, personImage: "data:image/jpeg;base64,..." }` → `202 { jobToken, pollIntervalMs }` |
| `GET /api/tryon-status` | `x-app-key`, `x-job-token` | `{ status: "processing" }` · `{ status: "completed", image }` · `{ status: "failed", error: { code, message } }` |
| `GET /api/health` | – | `{ ok, provider, sharedLimits }` |

Errors always look like `{ error: { code, message }, requestId }`. `message` is safe to show shoppers; `code` is stable for the app to switch on.

---

## Which API, and why

**FASHN `tryon-v1.6`**, behind our own adapter.

- It's built for exactly this: person photo + garment photo in, person wearing it out. Handles dresses (`one-pieces`) and tops, works from on-model product photos, so we can use the photos BRB already has.
- ~8–15 seconds per image in `balanced` mode, which is fine for a shopper with a loading screen.
- Best privacy options I found: photos can be sent as base64 (deleted when the job ends), results returned inline and deleted after 60 minutes, and they don't train on customer images.
- 1 credit per image, and failed jobs are free.

**On the worry about depending on a third party:** you're right to worry, so the vendor sits behind one interface (`backend/src/providers/types.ts`). FASHN is one file. Moving to another vendor, or to a self-hosted open model on our own GPU, means writing one new file and changing one env var. The app and the API contract don't change. Self-hosting from day one wasn't sensible for a prototype: it needs GPUs, model ops, and most strong open try-on models carry non-commercial licences that need checking first.

## Cost per 1,000 try-ons (rough)

| Item | Cost |
|---|---|
| FASHN: 1,000 × 1 credit × US$0.075 (pay-as-you-go) | **≈ US$75 (≈ HK$585)** |
| Vercel functions (~9k calls), bandwidth (~0.4 GB) | US$0 on free tier |
| Upstash Redis (~3k commands) | US$0 on free tier |
| **Total** | **≈ US$75, i.e. US$0.075 per try-on** |

Watch-outs: people often try 2–3 photos per product, so cost per *engaged shopper* is closer to US$0.15–0.25. Vercel's free Hobby plan is for non-commercial use, so production needs Pro (US$20/month). Volume pricing with FASHN should bring the per-image cost down.

**Credits used building this: 0.** Everything was tested against the mock and a fake FASHN network, so there's no receipt yet. Your 100 credits are untouched for the live demo.

## How the 100 credits are protected

- Max **5 try-ons per person per hour** (`RATE_LIMIT_PER_HOUR`).
- Max **25 per day for the whole service** (`DAILY_TRYON_CAP`), a hard stop on spend. That's 4 days of demos before you'd run out.
- Only catalog products can be tried on. The server picks the garment photo, so nobody can use our key to try on random images.
- Bad photos are rejected *before* any call to FASHN (wrong type, too big, too small).
- If a job never started, the slot is given back. If the limit store is down, try-on stops (fails closed) instead of spending without limits.
- We never auto-retry a start request, because that could bill twice.

## Privacy

- The photo is shrunk on the phone (and its GPS/EXIF data stripped) before upload.
- Our backend never writes it anywhere: no database, no file storage, no logs (the logger also redacts anything that looks like image data).
- FASHN gets it as base64 and deletes it when the job ends (1-day backstop). The result is deleted after 60 minutes. FASHN does not use customer images to train AI models. Source: [FASHN data retention & privacy](https://docs.fashn.ai/api-overview/data-retention-privacy).
- Closing the try-on deletes the photo files from the phone's cache, and the result is kept in memory only, never written to disk.
- One leftover: FASHN keeps request *records* (ids, timestamps, settings, no images). Deleting those needs an email to them. Worth covering in the contract.

## Tests

```bash
cd backend && npm run check     # typecheck + 42 tests: validation, signed tokens, limits, FASHN mapping, endpoints
cd app && npm run typecheck
```

The FASHN tests use a fake network, so they cost nothing. There's also a test that fails if the app shows "Try on" for a product the backend doesn't know.

## What I'd improve with more time

1. **Real accounts** instead of the shared app key. Then limits are per user, not per IP (shared office Wi-Fi shares one IP).
2. **Photo quality check on the phone** (is there one person, facing forward?) before we spend a credit.
3. **Garment photo pipeline:** clean front shots or flat-lays per product give noticeably better results. The current ones are cropped from screenshots.
4. **Push or streaming updates** instead of polling every 2 seconds.
5. **Cache results** per (shopper, product) for the session, so re-opening the sheet is instant and free.
6. **Analytics:** try-on → add-to-cart conversion. That's the number that decides if this is worth US$0.075 a go.
7. **Shared types package** so the app and backend share the API contract and product ids instead of duplicating them.
8. **360° view of the try-on.** The AI only sees the shopper from the front, so other angles would have to be generated (about 8 extra images, so about 8–9 credits per try-on) or made with a video model. Worth it only once per-image costs drop.
9. **E2E tests on a real device** (Maestro) and an evaluation set of photos to compare vendors on quality.
