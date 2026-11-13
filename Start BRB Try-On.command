#!/bin/bash
# -----------------------------------------------------------------------------
# BRB Virtual Try-On — one-click start for macOS.
#
# Double-click this file. It will:
#   1. check Node.js is installed,
#   2. create the config files with fresh random secrets (first run only),
#   3. ask for your FASHN API key (or press Enter to use free mock mode),
#   4. install everything,
#   5. start the backend, then open the app in the iPhone Simulator.
#
# Close this Terminal window to stop everything.
# -----------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

say() { printf "\n\033[1;35m▶ %s\033[0m\n" "$1"; }
fail() { printf "\n\033[1;31m✖ %s\033[0m\n\n" "$1"; read -r -p "Press Enter to close…"; exit 1; }

# --- 1. Node.js --------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  open "https://nodejs.org/en/download"
  fail "Node.js isn't installed. I've opened nodejs.org — install the LTS version, then double-click this file again."
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge 20 ] || fail "Node.js $NODE_MAJOR is too old. Install the LTS version from nodejs.org, then try again."

# --- 2. Config files (first run only) ---------------------------------------
BACKEND_ENV="backend/.env.local"
APP_ENV="app/.env"
if [ ! -f "$BACKEND_ENV" ]; then
  say "Creating config files with fresh secrets"
  SECRET=$(openssl rand -hex 32)
  KEY=$(openssl rand -hex 16)
  {
    echo "TRYON_PROVIDER=mock"
    echo "FASHN_API_KEY="
    echo "JOB_TOKEN_SECRET=$SECRET"
    echo "APP_CLIENT_KEY=$KEY"
    echo "RATE_LIMIT_PER_HOUR=5"
    echo "DAILY_TRYON_CAP=25"
    echo "MOCK_DELAY_MS=4000"
  } > "$BACKEND_ENV"
  {
    echo "EXPO_PUBLIC_API_BASE_URL=http://localhost:3000"
    echo "EXPO_PUBLIC_APP_KEY=$KEY"
  } > "$APP_ENV"
fi

# --- 3. FASHN key (asked only while none is saved) ---------------------------
CURRENT_KEY=$(grep -E '^FASHN_API_KEY=' "$BACKEND_ENV" | cut -d= -f2- || true)
if [ -z "$CURRENT_KEY" ]; then
  echo
  echo "Paste your FASHN API key and press Enter."
  echo "Or just press Enter to use FREE mock mode (no credits used)."
  read -r -s -p "FASHN key: " NEW_KEY
  echo
  if [ -n "$NEW_KEY" ]; then
    # Rewrite the file with the key and live mode switched on (works with macOS tools).
    grep -vE '^(FASHN_API_KEY|TRYON_PROVIDER)=' "$BACKEND_ENV" > "$BACKEND_ENV.tmp"
    { echo "TRYON_PROVIDER=fashn"; echo "FASHN_API_KEY=$NEW_KEY"; cat "$BACKEND_ENV.tmp"; } > "$BACKEND_ENV"
    rm -f "$BACKEND_ENV.tmp"
    say "Saved. Live mode is ON — each try-on uses 1 FASHN credit."
  else
    say "Mock mode — try-ons are fake and free."
  fi
else
  MODE=$(grep -E '^TRYON_PROVIDER=' "$BACKEND_ENV" | cut -d= -f2-)
  say "Using saved settings (mode: $MODE). Edit backend/.env.local to change them."
fi

# --- 4. Install --------------------------------------------------------------
say "Installing backend (first run takes a minute)"
(cd backend && npm install --no-audit --no-fund --loglevel=error) || fail "Backend install failed. Check your internet connection."
say "Installing app (first run takes a few minutes)"
(cd app && npm install --no-audit --no-fund --loglevel=error) || fail "App install failed. Check your internet connection."

# --- 5. Start backend, wait until healthy ------------------------------------
say "Starting the try-on backend"
(cd backend && npm run local > ../backend.log 2>&1) &
BACKEND_PID=$!
trap 'kill $BACKEND_PID 2>/dev/null; pkill -f "scripts/local-server.ts" 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  curl -sf http://localhost:3000/api/health >/dev/null 2>&1 && break
  sleep 1
done
curl -sf http://localhost:3000/api/health >/dev/null 2>&1 || fail "Backend didn't start. Details are in backend.log in this folder."
printf "   %s\n" "$(curl -s http://localhost:3000/api/health)"

# --- 6. Open the app in the iPhone Simulator ---------------------------------
if [ "${SKIP_APP:-}" = "1" ]; then say "SKIP_APP=1 set, stopping here."; exit 0; fi

# Open the Simulator ourselves (no "System Events" automation permission needed).
say "Opening the iPhone Simulator"
open -a Simulator
for _ in $(seq 1 60); do
  xcrun simctl list devices booted 2>/dev/null | grep -q "Booted" && break
  sleep 2
done

# Fast, production-like mode by default. Run with DEV=1 for debugging tools.
MODE_FLAGS="--no-dev --minify"
[ "${DEV:-}" = "1" ] && MODE_FLAGS=""

# Once the app server is up, open the app in Expo Go on the Simulator.
(
  for _ in $(seq 1 120); do
    curl -sf http://localhost:8081/status 2>/dev/null | grep -q "running" && break
    sleep 2
  done
  if ! xcrun simctl openurl booted "exp://127.0.0.1:8081" 2>/dev/null; then
    printf "\n   Couldn't open Expo Go automatically. Press i in this window instead.\n"
  fi
) &

say "Starting the app (keep this window open while you use the app)"
echo "   Tip: drag a photo from Finder onto the simulator, then tap Try on → Choose from library."
cd app
npx expo start $MODE_FLAGS
