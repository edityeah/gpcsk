import express, { type Express } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import cors from 'cors'
import { pinoHttp } from 'pino-http'
import { env } from './env.js'
import { logger } from './logger.js'
import { authRouter } from './auth/router.js'
import { usersRouter } from './users/router.js'
import { cetpsRouter } from './cetps/router.js'
import { sensorsRouter } from './sensors/router.js'
import { exceedancesRouter } from './exceedances/router.js'
import { industriesRouter } from './industries/router.js'
import { consentsRouter } from './consents/router.js'
import { complaintsRouter } from './complaints/router.js'
import { statsRouter } from './stats/router.js'
import { inspectionsRouter } from './inspections/router.js'
import { enforcementRouter } from './enforcement/router.js'
import { aiRouter } from './ai/router.js'
import { broadcastsRouter } from './broadcasts/router.js'
import { notificationsRouter } from './notifications/router.js'
import { voiceRouter } from './voice/router.js'
import { programsRouter } from './programs/router.js'

export function buildApp(): Express {
  const app = express()
  app.use(cors({ origin: env.CORS_ALLOWED_ORIGINS.split(',').map(s => s.trim()), credentials: true }))
  app.use(express.json({ limit: '2mb' }))
  app.use(pinoHttp({ logger }))

  app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }))
  app.use('/api/auth', authRouter)
  app.use('/api', usersRouter)
  app.use('/api', cetpsRouter)
  app.use('/api/sensors', sensorsRouter)
  app.use('/api/exceedances', exceedancesRouter)
  app.use('/api/industries', industriesRouter)
  app.use('/api/consents', consentsRouter)
  app.use('/api/complaints', complaintsRouter)
  app.use('/api/stats', statsRouter)
  app.use('/api/inspections', inspectionsRouter)
  app.use('/api/enforcement', enforcementRouter)
  app.use('/api/ai', aiRouter)
  app.use('/api/voice', voiceRouter)
  app.use('/api/broadcasts', broadcastsRouter)
  app.use('/api/notifications', notificationsRouter)
  app.use('/api/programs', programsRouter)

  mountWebSpa(app)

  return app
}

/**
 * Same-origin SPA hosting. When WEB_DIST_DIR points at a built Vite bundle
 * (apps/web/dist), serve it behind the API routes above so a single service
 * can host both halves (Render). Hashed assets are cached for 30 days;
 * index.html is never cached so a new deploy always ships a fresh shell.
 * Anything under /api or /health is left to the API — unknown API paths 404
 * instead of returning index.html.
 */
function mountWebSpa(app: Express): void {
  const dist = env.WEB_DIST_DIR
  if (!dist) return
  const indexHtml = path.join(dist, 'index.html')
  if (!fs.existsSync(indexHtml)) {
    logger.warn({ dist }, 'WEB_DIST_DIR set but index.html not found — SPA hosting disabled')
    return
  }
  logger.info({ dist }, 'Serving web SPA from WEB_DIST_DIR')

  const NO_CACHE = 'no-store, no-cache, must-revalidate, max-age=0'
  app.use(
    express.static(dist, {
      index: false,
      maxAge: '30d',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', NO_CACHE)
      },
    }),
  )
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (req.path.startsWith('/api/') || req.path === '/api' || req.path === '/health') return next()
    res.setHeader('Cache-Control', NO_CACHE)
    res.sendFile(indexHtml)
  })
}
