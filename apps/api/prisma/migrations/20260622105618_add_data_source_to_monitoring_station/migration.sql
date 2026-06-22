-- AlterTable
ALTER TABLE "MonitoringStation" ADD COLUMN     "dataSource" TEXT NOT NULL DEFAULT 'SYNTHETIC',
ADD COLUMN     "lastIngestedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "IngestRun" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "stationsTouched" INTEGER NOT NULL DEFAULT 0,
    "readingsInserted" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "IngestRun_pkey" PRIMARY KEY ("id")
);
