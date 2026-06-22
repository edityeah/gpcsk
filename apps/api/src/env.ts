import { z } from 'zod'

const Env = z.object({
  DATABASE_URL: z.string().url(),
  API_PORT: z.coerce.number().int().positive().default(8001),
  API_JWT_SECRET: z.string().min(16),
  API_JWT_TTL_HOURS: z.coerce.number().int().positive().default(24),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3001'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  ENABLE_LIVE_INGEST: z.string().optional().default('true'),
})

export const env = Env.parse(process.env)
export type Env = typeof env
