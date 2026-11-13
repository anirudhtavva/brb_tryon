#!/bin/bash
# -----------------------------------------------------------------------------
# BRB Virtual Try-On — one-click deploy to Vercel (macOS).
#
# Double-click this file. It will:
#   1. build the app for the web (works in Safari on any iPhone, nothing to install),
#   2. log you in to Vercel (first time only: a browser window opens),
#   3. copy your settings (FASHN key, limits, secrets) to Vercel,
#   4. put the web app AND the try-on server live on one Vercel address,
#   5. point the Expo Go app at that address too, and open the link.
#
# Run "Start BRB Try-On.command" once before this, so your settings exist.
# Safe to run again any time: it just redeploys.
# -----------------------------------------------------------------------------
set -uo pipefail
cd "$(dirname "$0")"
ROOT="$(pwd)"
VERCEL="npx --yes vercel@65"

say()  { printf "\n\033[1;35m▶ %s\033[0m\n" "$1"; }
fail() { printf "\n\033[1;31m✖ %s\033[0m\n\n" "$1"; read -r -p "Press Enter to close…"; exit 1; }

# --- 0. Checks ----------------------------------------------------------------
command -v node >/dev/null 2>&1 || fail "Node.js isn't installed. Install the LTS version from nodejs.org."
BACKEND_ENV="backend/.env.local"
[ -f "$BACKEND_ENV" ] || fail "No settings yet. Double-click 'Start BRB Try-On.command' once first, then run this again."
APP_KEY=$(grep -E '^APP_CLIENT_KEY=' "$BACKEND_ENV" | cut -d= -f2-)
[ -n "$APP_KEY" ] || fail "APP_CLIENT_KEY is missing in backend/.env.local."
MODE=$(grep -E '^TRYON_PROVIDER=' "$BACKEND_ENV" | cut -d= -f2-)
say "Mode: ${MODE:-mock}  (edit backend/.env.local to change)"

# --- 1. Install + build the web app ------------------------------------------
say "Installing (first run takes a few minutes)"
(cd backend && npm install --no-audit --no-fund --loglevel=error) || fail "Backend install failed. Check your internet."
(cd app && npm install --no-audit --no-fund --loglevel=error) || fail "App install failed. Check your internet."

say "Building the web version of the app"
# Empty server address = the web app calls the same Vercel site it is loaded from.
printf "EXPO_PUBLIC_API_BASE_URL=\nEXPO_PUBLIC_APP_KEY=%s\n" "$APP_KEY" > app/.env.production.local
(cd app && CI=1 npm run build:web); BUILD_OK=$?
rm -f app/.env.production.local   # only for the web build; Expo Go must keep using app/.env
[ $BUILD_OK -eq 0 ] || fail "The web build failed. Scroll up for the error."
[ -f backend/public/index.html ] || fail "The web build produced no index.html."

# --- 2. Vercel login + project -------------------------------------------------
cd "$ROOT/backend"
if ! $VERCEL whoami >/dev/null 2>&1; then
  say "Logging in to Vercel — a browser window will open. Approve it, then come back here."
  $VERCEL login || fail "Vercel login didn't finish. Run this file again."
fi
if [ ! -f .vercel/project.json ]; then
  say "Creating the Vercel project"
  $VERCEL link --yes --project brb-tryon || fail "Couldn't create the Vercel project."
fi

# --- 3. Copy settings to Vercel ------------------------------------------------
say "Copying your settings to Vercel"
while IFS='=' read -r KEY VALUE; do
  case "$KEY" in ''|\#*|MOCK_*) continue ;; esac
  [ -n "$VALUE" ] || continue
  $VERCEL env rm "$KEY" production --yes >/dev/null 2>&1 || true
  printf '%s' "$VALUE" | $VERCEL env add "$KEY" production >/dev/null 2>&1 \
    && echo "   ✓ $KEY" || echo "   ✖ $KEY (add it by hand in Vercel → Settings → Environment Variables)"
done < .env.local

# --- 4. Deploy -------------------------------------------------------------------
say "Putting it live (about a minute)"
OUT=$($VERCEL deploy --prod --yes 2>&1) || { echo "$OUT"; fail "The deploy failed. The error is above."; }
echo "$OUT" | tail -5
# Prefer the short production address (e.g. https://brb-tryon.vercel.app) over the long per-deploy one.
URL=$(echo "$OUT" | grep -oE 'https://[a-zA-Z0-9.-]+\.vercel\.app' | awk '{ print length, $0 }' | sort -n | head -1 | cut -d' ' -f2)
[ -n "$URL" ] || fail "Deployed, but I couldn't read the address. Find it on vercel.com under the brb-tryon project."

# --- 5. Check it, point Expo Go at it, open it ---------------------------------
say "Checking the live server"
sleep 3
HEALTH=$(curl -s "$URL/api/health" || true)
echo "   $HEALTH"
if ! echo "$HEALTH" | grep -q '"ok":true'; then
  echo
  echo "   The server didn't answer as expected. If you see a Vercel login page at $URL,"
  echo "   go to vercel.com → brb-tryon → Settings → Deployment Protection and turn off Vercel Authentication."
fi

cd "$ROOT"
printf "EXPO_PUBLIC_API_BASE_URL=%s\nEXPO_PUBLIC_APP_KEY=%s\n" "$URL" "$APP_KEY" > app/.env
echo "$URL" > "LIVE LINK.txt"

printf "\n\033[1;32m✔ Live at: %s\033[0m\n" "$URL"
echo "   • Any iPhone: open that link in Safari. Tip: Share → Add to Home Screen makes it look like an app."
echo "   • Expo Go: the app now uses this server too. Run 'Start BRB Try-On.command' and scan the QR code."
echo "   • The link is also saved in 'LIVE LINK.txt' in this folder."
open "$URL"
echo
read -r -p "Press Enter to close…"
