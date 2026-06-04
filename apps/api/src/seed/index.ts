import { prisma } from '../db.js'
import { seedDemoUsers } from './users.js'
import { logger } from '../logger.js'

async function main() {
  logger.info('seeding demo users…')
  await seedDemoUsers(prisma)
  const count = await prisma.user.count()
  logger.info(`done. users now: ${count}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  logger.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
