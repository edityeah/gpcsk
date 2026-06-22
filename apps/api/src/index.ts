import { buildApp } from './app.js'
import { env } from './env.js'
import { logger } from './logger.js'
import cron from 'node-cron'
import { ingestAaqm, ingestCems } from './ingest/index.js'

const app = buildApp()
app.listen(env.API_PORT, () => logger.info(`GPCSK API listening on :${env.API_PORT}`))

// ── Live ingest cron (gated by ENABLE_LIVE_INGEST env var) ───────────────────

if (env.ENABLE_LIVE_INGEST !== 'false') {
  logger.info('Live ingest: scheduling hourly cron jobs')

  // Run once on startup after 30s to let DB settle (avoids race on fresh deploy)
  setTimeout(() => {
    logger.info('Live ingest: running initial AAQM ingest…')
    void ingestAaqm()
  }, 30_000)

  setTimeout(() => {
    logger.info('Live ingest: running initial CEMS ingest…')
    void ingestCems()
  }, 60_000)

  // Hourly: AAQM at :00, CEMS at :15
  cron.schedule('0 * * * *', () => {
    logger.info('Cron: starting AAQM ingest')
    void ingestAaqm()
  })

  cron.schedule('15 * * * *', () => {
    logger.info('Cron: starting CEMS ingest')
    void ingestCems()
  })
} else {
  logger.info('Live ingest: ENABLE_LIVE_INGEST=false — cron skipped')
}
