# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS build
WORKDIR /repo
RUN corepack enable && apk add --no-cache openssl
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages packages
COPY apps/api apps/api
# Source PDFs + OCR sidecar for the RAG ingest pipeline (ingest-pdfs reads
# from docs/references/gpcb-sources/). The 80 MB AR 2024-25 is gitignored
# and may be absent at build time; the .txt sidecar will be used in that case.
COPY docs/references docs/references
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @gpcsk/shared build
RUN pnpm --filter @gpcsk/api exec prisma generate
RUN pnpm --filter @gpcsk/api build

# Prune dev-only deps from each workspace package so the final image is smaller.
RUN pnpm --filter @gpcsk/api prune --prod || true

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
RUN apk add --no-cache openssl
# Copy the entire workspace (including hoisted root node_modules + .pnpm
# symlink store + every package). This is the only structure that resolves
# correctly for pnpm's isolated node-linker at runtime.
COPY --from=build /repo /repo
WORKDIR /repo/apps/api
EXPOSE 8001
CMD ["node", "dist/index.js"]
