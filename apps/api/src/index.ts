import { buildApp } from './app.js'
import { env } from './env.js'
import { logger } from './logger.js'

const app = buildApp()
app.listen(env.API_PORT, () => logger.info(`GPCSK API listening on :${env.API_PORT}`))
