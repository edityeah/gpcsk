-- Add unique constraint on Cetp.name (was in schema but missing from initial migration)
CREATE UNIQUE INDEX IF NOT EXISTS "Cetp_name_key" ON "Cetp"("name");

-- Add unique constraint on CetpMonitoringReport(cetpId, monthOf) (was in schema but missing from initial migration)
CREATE UNIQUE INDEX IF NOT EXISTS "CetpMonitoringReport_cetpId_monthOf_key" ON "CetpMonitoringReport"("cetpId", "monthOf");
