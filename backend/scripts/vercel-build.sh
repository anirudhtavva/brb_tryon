#!/bin/sh
# Runs on Vercel's servers before every deploy (Vercel calls `npm run vercel-build`).
#
# - Deploys from GitHub include the whole repo, so we build the web app fresh from app/.
#   That way a teammate's merged change shows up on the live link automatically.
#   (Needs Vercel → Settings → Build and Deployment → "Include files outside the
#   root directory in the Build Step" switched ON.)
# - Deploys from "Deploy to Vercel.command" upload only backend/, with the web app
#   already built into public/, so there is nothing to do here.
# - If neither is true, stop with a clear error instead of publishing a site with no app.
set -e
if [ -d ../app ]; then
  echo "Building the web app from app/ ..."
  cd ../app
  npm ci --no-audit --no-fund
  # Empty server address = call the same site. The app key comes from Vercel's settings.
  EXPO_PUBLIC_API_BASE_URL= EXPO_PUBLIC_APP_KEY="$APP_CLIENT_KEY" \
    npx expo export --platform web --output-dir ../backend/public --clear
elif [ -f public/index.html ]; then
  echo "app/ not uploaded (deploy from the script): using the prebuilt web app in public/."
else
  echo "ERROR: the app/ folder isn't available to this build, so the web app can't be built."
  echo "Fix: Vercel → Settings → Build and Deployment → turn ON"
  echo "     'Include files outside the root directory in the Build Step', then redeploy."
  exit 1
fi
