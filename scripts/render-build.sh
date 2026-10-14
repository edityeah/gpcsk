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
corepack enable 2>/dev/null || true
PNPM="corepack pnpm"
$PNPM -v

$PNPM install --frozen-lockfile --prod=false

$PNPM --filter @gpcsk/shared build
$PNPM --filter @gpcsk/api exec prisma generate
$PNPM --filter @gpcsk/api build

export VITE_API_URL="${VITE_API_URL-}"
$PNPM --filter @gpcsk/web build

test -f apps/web/dist/index.html || { echo "Vite build failed: apps/web/dist/index.html missing"; exit 1; }
test -f apps/api/dist/index.js   || { echo "API build failed: apps/api/dist/index.js missing"; exit 1; }
echo "── build complete"
