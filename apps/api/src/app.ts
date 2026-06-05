import express, { type Express } from 'express'
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

  return app
}
