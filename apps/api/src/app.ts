import express, { type Express } from 'express'
import cors from 'cors'
import pinoHttp from 'pino-http'
import { env } from './env.js'
import { logger } from './logger.js'
import { authRouter } from './auth/router.js'
import { usersRouter } from './users/router.js'

export function buildApp(): Express {
  const app = express()
  app.use(cors({ origin: env.CORS_ALLOWED_ORIGINS.split(',').map(s => s.trim()), credentials: true }))
  app.use(express.json({ limit: '2mb' }))
  app.use(pinoHttp({ logger }))

  app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }))
  app.use('/api/auth', authRouter)
  app.use('/api', usersRouter)

  return app
}
