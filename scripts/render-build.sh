#!/usr/bin/env bash
# Render build step for the single `gpcsk` web service (see render.yaml).
#
# Builds, in order: shared package → Prisma client → API (tsc) → web (Vite).
# The web bundle is built with VITE_API_URL="" so the SPA talks to the API on
# its own origin — the API serves apps/web/dist at runtime (WEB_DIST_DIR).
#
# Dev dependencies are installed on purpose (--prod=false): the start script
# needs `prisma` and `tsx` at runtime for migrations and seeding.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "── node $(node -v)"
# pnpm via npm, not corepack: the corepack bundled with Node 20.x ships stale
# npm registry signing keys and aborts with "Cannot find matching keyid".
PNPM_VERSION="$(node -p "require('./package.json').packageManager.split('@')[1]")"
if ! command -v pnpm >/dev/null 2>&1 || [ "$(pnpm -v 2>/dev/null)" != "$PNPM_VERSION" ]; then
  npm install -g "pnpm@${PNPM_VERSION}" --no-audit --no-fund
fi
PNPM="pnpm"
echo "── pnpm $($PNPM -v)"

$PNPM install --frozen-lockfile --prod=false

$PNPM --filter @gpcsk/shared build
$PNPM --filter @gpcsk/api exec prisma generate
$PNPM --filter @gpcsk/api build

export VITE_API_URL="${VITE_API_URL-}"
$PNPM --filter @gpcsk/web build

test -f apps/web/dist/index.html || { echo "Vite build failed: apps/web/dist/index.html missing"; exit 1; }
test -f apps/api/dist/index.js   || { echo "API build failed: apps/api/dist/index.js missing"; exit 1; }
echo "── build complete"
