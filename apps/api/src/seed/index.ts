import { prisma } from '../db.js'
import { seedReference } from './reference.js'
import { seedDemoUsers } from './users.js'
import { logger } from '../logger.js'

async function main() {
  logger.info('seeding reference data…')
  await seedReference(prisma)
  const [sectorCount, districtCount, talukaCount, zoneCount, normCount] = await Promise.all([
    prisma.sector.count(),
    prisma.district.count(),
    prisma.taluka.count(),
    prisma.gidcZone.count(),
    prisma.norm.count(),
  ])
  logger.info(
    `reference data done: ${sectorCount} sectors, ${districtCount} districts, ` +
    `${talukaCount} talukas, ${zoneCount} GIDC zones, ${normCount} norms`
  )

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
