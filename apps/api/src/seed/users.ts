import type { PrismaClient } from '@prisma/client'

export const DEMO_USERS = [
  { phone: '9000000001', role: 'CONSENT_OFFICER',                xgnId: 'XGN-CO-001',  name: 'Anjali Patel',  designation: 'Consent Officer',          region: 'Gandhinagar HQ' },
  { phone: '9000000002', role: 'MONITORING_OFFICER',             xgnId: 'XGN-MO-001',  name: 'Rohit Solanki', designation: 'Monitoring Officer',       region: 'Gandhinagar HQ' },
  { phone: '9000000003', role: 'INSPECTION_ENFORCEMENT_OFFICER', xgnId: 'XGN-IEO-001', name: 'Mehul Joshi',   designation: 'Inspection & Enforcement', region: 'Ahmedabad RO'   },
  { phone: '9000000004', role: 'COMPLAINTS_OFFICER',             xgnId: 'XGN-CMP-001', name: 'Priya Shah',    designation: 'Complaints Officer',       region: 'Gandhinagar HQ' },
  { phone: '9000000005', role: 'SENIOR_REVIEWER',                xgnId: 'XGN-SR-001',  name: 'Dr. K. Trivedi',designation: 'Member Secretary',         region: 'Gandhinagar HQ' },
] as const

export async function seedDemoUsers(prisma: PrismaClient): Promise<void> {
  for (const u of DEMO_USERS) {
    await prisma.user.upsert({
      where: { phone: u.phone },
      update: {},
      create: { phone: u.phone, role: u.role as never, xgnId: u.xgnId, name: u.name, designation: u.designation, region: u.region },
    })
  }
}
