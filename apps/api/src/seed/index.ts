import { prisma } from '../db.js'
import { seedReference } from './reference.js'
import { seedIndustries } from './industries.js'
import { seedDemoUsers } from './users.js'
import { seedConsents } from './consents.js'
import { seedInspections } from './inspections.js'
import { seedComplaints } from './complaints.js'
import { seedSensors } from './sensors.js'
import { seedCetps } from './cetps.js'
import { seedKnowledge } from './knowledge.js'
import { seedEnforcementActions } from './enforcement.js'
import { seedNotifications } from './notifications.js'
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

  logger.info('seeding complaints…')
  const { complaints: cCount, responses: rCount } = await seedComplaints(prisma)
  logger.info(`complaints done: ${cCount} complaints, ${rCount} responses seeded`)

  logger.info('seeding monitoring stations, readings, and exceedances…')
  await seedSensors(prisma)
  const [stationCount, readingCount, exceedanceCount] = await Promise.all([
    prisma.monitoringStation.count(),
    prisma.sensorReading.count(),
    prisma.exceedance.count(),
  ])
  logger.info(
    `sensors done: ${stationCount} stations, ${readingCount} readings, ` +
    `${exceedanceCount} exceedances seeded`
  )

  logger.info('seeding CETPs + monthly monitoring reports…')
  await seedCetps(prisma)
  const [cetpCount, cetpReportCount] = await Promise.all([
    prisma.cetp.count(),
    prisma.cetpMonitoringReport.count(),
  ])
  logger.info(`CETPs done: ${cetpCount} CETPs, ${cetpReportCount} monthly reports seeded`)

  logger.info('seeding knowledge documents + RAG chunks…')
  await seedKnowledge(prisma)
  const [docCount, chunkCount] = await Promise.all([
    prisma.knowledgeDocument.count(),
    prisma.knowledgeChunk.count(),
  ])
  logger.info(`knowledge done: ${docCount} documents, ${chunkCount} chunks seeded`)

  logger.info('seeding enforcement actions + audit log history…')
  await seedEnforcementActions(prisma)
  const [enforcementCount, auditCount] = await Promise.all([
    prisma.enforcementAction.count(),
    prisma.auditLog.count(),
  ])
  logger.info(`enforcement done: ${enforcementCount} enforcement actions, ${auditCount} total audit log entries seeded`)

  logger.info('seeding notifications…')
  await seedNotifications(prisma)
  const notifCount = await prisma.notification.count()
  logger.info(`notifications done: ${notifCount} notifications seeded`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  logger.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
