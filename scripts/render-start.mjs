#!/usr/bin/env node
// Render start command for the single `gpcsk` web service (see render.yaml).
//
//   1. prisma migrate deploy          — apply pending migrations (fatal on error)
//   2. seed demo data                 — only when the User table is empty
//   3. start the API                  — serves /api/* and the built web SPA
//   4. RAG corpus (background)        — PDF chunking on a fresh DB, then
//                                       OpenAI embeddings for any chunk still
//                                       missing one (no-op once populated)
//
// Steps 1–2 run before the port opens so Render's health check only passes
// on a usable database. Step 4 runs after the server is up so a slow OpenAI
// pass never blocks the deploy.
//
// Works with pnpm's isolated node_modules: every tool is invoked through
// apps/api/node_modules/.bin, so neither pnpm nor corepack is needed at runtime.

import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const API = path.join(ROOT, 'apps', 'api')
const BIN = path.join(API, 'node_modules', '.bin')
const WEB_DIST = path.join(ROOT, 'apps', 'web', 'dist')

process.env.NODE_ENV ||= 'production'
process.env.API_PORT ||= process.env.PORT || '8001'
process.env.WEB_DIST_DIR ||= WEB_DIST

const log = (msg) => console.log(`[render-start] ${msg}`)

function run(label, cmd, args, { fatal = true } = {}) {
  log(`${label}: ${path.basename(cmd)} ${args.join(' ')}`)
  const r = spawnSync(cmd, args, { cwd: API, stdio: 'inherit', env: process.env })
  if (r.status !== 0) {
    const msg = `${label} exited with ${r.status ?? r.signal}`
    if (fatal) { console.error(`[render-start] FATAL: ${msg}`); process.exit(r.status || 1) }
    console.warn(`[render-start] WARN: ${msg} — continuing`)
    return false
  }
  return true
}

function runAsync(label, cmd, args) {
  return new Promise((resolve) => {
    log(`${label}: ${path.basename(cmd)} ${args.join(' ')}`)
    const child = spawn(cmd, args, { cwd: API, stdio: 'inherit', env: process.env })
    child.on('exit', (code) => {
      if (code !== 0) console.warn(`[render-start] WARN: ${label} exited with ${code}`)
      resolve(code === 0)
    })
  })
}

function userCount() {
  const script = `
    import { PrismaClient } from '@prisma/client'
    const prisma = new PrismaClient()
    const n = await prisma.user.count()
    console.log('USER_COUNT=' + n)
    await prisma.$disconnect()
  `
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: API, encoding: 'utf8', env: process.env,
  })
  const m = /USER_COUNT=(\d+)/.exec(r.stdout ?? '')
  if (!m) {
    console.warn(`[render-start] WARN: could not read user count — assuming seeded\n${r.stderr ?? ''}`)
    return -1
  }
  return Number(m[1])
}

// ── 1. Migrations ────────────────────────────────────────────────────────────
if (!process.env.DATABASE_URL) { console.error('[render-start] FATAL: DATABASE_URL is not set'); process.exit(1) }
run('migrate', path.join(BIN, 'prisma'), ['migrate', 'deploy'])

// ── 2. Seed (fresh database only) ────────────────────────────────────────────
const users = userCount()
const freshDb = users === 0
if (freshDb) {
  log('empty database — seeding demo data')
  run('seed', path.join(BIN, 'tsx'), ['src/seed/index.ts'], { fatal: false })
} else {
  log(`database already seeded (${users} users) — skipping seed`)
}

// ── 3. API + SPA ─────────────────────────────────────────────────────────────
if (!fs.existsSync(path.join(WEB_DIST, 'index.html'))) {
  console.warn('[render-start] WARN: apps/web/dist/index.html missing — API will run without the SPA')
}
log(`starting API on :${process.env.API_PORT}`)
const server = spawn(process.execPath, ['dist/index.js'], { cwd: API, stdio: 'inherit', env: process.env })
server.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)))
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.kill(sig))

// ── 4. RAG corpus (background, never blocks the deploy) ──────────────────────
setTimeout(async () => {
  if (freshDb) await runAsync('rag:ingest-pdfs', path.join(BIN, 'tsx'), ['src/rag/ingest-pdfs.ts'])
  if (process.env.OPENAI_API_KEY) await runAsync('rag:ingest', path.join(BIN, 'tsx'), ['src/rag/ingest.ts'])
  else log('OPENAI_API_KEY not set — skipping embeddings (chat falls back to keyword search)')
}, 15_000).unref()
