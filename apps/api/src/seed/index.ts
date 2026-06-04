import { prisma } from '../db.js'
import { seedReference } from './reference.js'
import { seedIndustries } from './industries.js'
import { seedDemoUsers } from './users.js'
import { seedConsents } from './consents.js'
import { seedInspections } from './inspections.js'
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

  logger.info('seeding industries…')
  await seedIndustries(prisma)
  const industryCount = await prisma.industry.count()
  logger.info(`industries done: ${industryCount} industrial units seeded`)

  logger.info('seeding demo users…')
  await seedDemoUsers(prisma)
  const userCount = await prisma.user.count()
  logger.info(`done. users now: ${userCount}`)

  logger.info('seeding consent applications…')
  await seedConsents(prisma)
  const consentCount = await prisma.consentApplication.count()
  logger.info(`consents done: ${consentCount} consent applications seeded`)

  logger.info('seeding inspections + violations…')
  await seedInspections(prisma)
  const [inspectionCount, violationCount] = await Promise.all([
    prisma.inspection.count(),
    prisma.violation.count(),
  ])
  logger.info(`inspections done: ${inspectionCount} inspections, ${violationCount} violations seeded`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  logger.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
