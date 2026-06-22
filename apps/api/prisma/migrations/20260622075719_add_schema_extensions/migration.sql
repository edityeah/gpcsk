/*
  Warnings:

  - You are about to drop the column `embedding` on the `KnowledgeChunk` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('ROUTINE', 'RISK_BASED', 'COMPLAINT_DRIVEN', 'AUTO_SENSOR_DROPOUT', 'FOLLOWUP');

-- DropIndex
DROP INDEX "CetpMonitoringReport_cetpId_monthOf_idx";

-- DropIndex
DROP INDEX "KnowledgeChunk_embedding_idx";

-- AlterTable
ALTER TABLE "ConsentApplication" ADD COLUMN     "docVerification" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Inspection" ADD COLUMN     "inspectionType" "InspectionType" NOT NULL DEFAULT 'ROUTINE';

-- AlterTable
ALTER TABLE "KnowledgeChunk" DROP COLUMN "embedding";

-- CreateTable
CREATE TABLE "StationUptimeStat" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "onlineMinutes" INTEGER NOT NULL,
    "offlineMinutes" INTEGER NOT NULL,
    "outageCount" INTEGER NOT NULL,

    CONSTRAINT "StationUptimeStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskBasedSuggestion" (
    "id" TEXT NOT NULL,
    "industryId" TEXT NOT NULL,
    "suggestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "breakdown" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "scheduledInspectionId" TEXT,

    CONSTRAINT "RiskBasedSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StationUptimeStat_stationId_date_idx" ON "StationUptimeStat"("stationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StationUptimeStat_stationId_date_key" ON "StationUptimeStat"("stationId", "date");

-- CreateIndex
CREATE INDEX "RiskBasedSuggestion_state_suggestedAt_idx" ON "RiskBasedSuggestion"("state", "suggestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RiskBasedSuggestion_industryId_state_key" ON "RiskBasedSuggestion"("industryId", "state");

-- AddForeignKey
ALTER TABLE "StationUptimeStat" ADD CONSTRAINT "StationUptimeStat_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "MonitoringStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskBasedSuggestion" ADD CONSTRAINT "RiskBasedSuggestion_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskBasedSuggestion" ADD CONSTRAINT "RiskBasedSuggestion_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
