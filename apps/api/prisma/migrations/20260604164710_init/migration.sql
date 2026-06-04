-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CONSENT_OFFICER', 'MONITORING_OFFICER', 'INSPECTION_ENFORCEMENT_OFFICER', 'COMPLAINTS_OFFICER', 'SENIOR_REVIEWER');

-- CreateEnum
CREATE TYPE "Stream" AS ENUM ('AIR', 'WATER', 'HAZARDOUS_WASTE', 'NOISE_MSW');

-- CreateEnum
CREATE TYPE "IndustryCategory" AS ENUM ('RED', 'ORANGE', 'GREEN', 'WHITE');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('CTE', 'CTO', 'HW_AUTH');

-- CreateEnum
CREATE TYPE "ConsentState" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'RECOMMENDED', 'APPROVED', 'REJECTED', 'EXPIRED', 'RENEWED');

-- CreateEnum
CREATE TYPE "MakerCheckerState" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'COMMITTED', 'RETURNED_FOR_REVISION', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ViolationSeverity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ViolationSource" AS ENUM ('SENSOR', 'INSPECTION', 'COMPLAINT', 'AUDIT');

-- CreateEnum
CREATE TYPE "DispositionState" AS ENUM ('PENDING', 'CONFIRMED_VIOLATION', 'SENSOR_GLITCH', 'RESOLVED');

-- CreateEnum
CREATE TYPE "MonitoringStationType" AS ENUM ('OCEMS', 'CEQMS', 'AAQM', 'MINARS', 'GEMS', 'VOC');

-- CreateEnum
CREATE TYPE "SensorValidity" AS ENUM ('VALID', 'FLAGGED', 'MISSING');

-- CreateEnum
CREATE TYPE "EnforcementActionType" AS ENUM ('SHOW_CAUSE', 'CLOSURE_DIRECTION', 'BANK_GUARANTEE_INVOCATION', 'RECOVERY', 'SEALING');

-- CreateEnum
CREATE TYPE "InspectionState" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ComplaintChannel" AS ENUM ('WEB', 'PHONE', 'EMAIL', 'WALK_IN');

-- CreateEnum
CREATE TYPE "ComplaintState" AS ENUM ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('EXCEEDANCE_CRITICAL', 'EXCEEDANCE_PREDICTED', 'COMPLAINT_ASSIGNED', 'COMPLAINT_HOTSPOT_ALERT', 'RENEWAL_DUE_30', 'RENEWAL_DUE_60', 'RENEWAL_DUE_90', 'INSPECTION_DUE', 'MAKER_CHECKER_PENDING', 'NOTICE_COMMITTED', 'ANOMALY_FLAG', 'FESTIVAL_PLANNER_REMINDER', 'BROADCAST', 'GENERAL');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "KnowledgeSourceType" AS ENUM ('ACT', 'RULE', 'SOP', 'ANNUAL_REPORT', 'CPCB_NORM', 'CETP_REPORT', 'FESTIVAL_MONITORING', 'FAQ');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "xgnId" TEXT,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "designation" TEXT,
    "region" TEXT,
    "profile" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sector" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Sector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Taluka" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,

    CONSTRAINT "Taluka_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GidcZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "districtId" TEXT,

    CONSTRAINT "GidcZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Norm" (
    "id" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "stream" "Stream" NOT NULL,
    "category" TEXT,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "regulator" TEXT NOT NULL,
    "source" TEXT NOT NULL,

    CONSTRAINT "Norm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Industry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ucNumber" TEXT NOT NULL,
    "category" "IndustryCategory" NOT NULL,
    "sectorId" TEXT,
    "districtId" TEXT,
    "talukaId" TEXT,
    "gidcZoneId" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "capacity" JSONB NOT NULL DEFAULT '{}',
    "classificationScheme" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Industry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentApplication" (
    "id" TEXT NOT NULL,
    "industryId" TEXT NOT NULL,
    "type" "ConsentType" NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validityFrom" TIMESTAMP(3),
    "validityTo" TIMESTAMP(3),
    "state" "ConsentState" NOT NULL DEFAULT 'DRAFT',
    "parameters" JSONB NOT NULL DEFAULT '{}',
    "feeStatus" TEXT,
    "makerId" TEXT,
    "checkerId" TEXT,
    "reviewerNotes" TEXT,
    "letterFileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "industryId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "inspectorId" TEXT,
    "completedAt" TIMESTAMP(3),
    "state" "InspectionState" NOT NULL DEFAULT 'SCHEDULED',
    "observations" JSONB NOT NULL DEFAULT '{}',
    "photos" JSONB NOT NULL DEFAULT '[]',
    "nextDueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Violation" (
    "id" TEXT NOT NULL,
    "industryId" TEXT NOT NULL,
    "inspectionId" TEXT,
    "source" "ViolationSource" NOT NULL,
    "parameter" TEXT NOT NULL,
    "observedValue" DOUBLE PRECISION,
    "normValue" DOUBLE PRECISION,
    "unit" TEXT,
    "severity" "ViolationSeverity" NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispositionState" "DispositionState" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Violation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoringStation" (
    "id" TEXT NOT NULL,
    "type" "MonitoringStationType" NOT NULL,
    "industryId" TEXT,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "parameters" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoringStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorReading" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "validity" "SensorValidity" NOT NULL DEFAULT 'VALID',

    CONSTRAINT "SensorReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exceedance" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "readingId" TEXT,
    "parameter" TEXT NOT NULL,
    "observedValue" DOUBLE PRECISION NOT NULL,
    "normValue" DOUBLE PRECISION NOT NULL,
    "breachMagnitude" DOUBLE PRECISION NOT NULL,
    "severity" "ViolationSeverity" NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispositionState" "DispositionState" NOT NULL DEFAULT 'PENDING',
    "dispositionActorId" TEXT,
    "dispositionAt" TIMESTAMP(3),
    "dispositionNotes" TEXT,

    CONSTRAINT "Exceedance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabSample" (
    "id" TEXT NOT NULL,
    "stationId" TEXT,
    "industryId" TEXT,
    "collectedAt" TIMESTAMP(3) NOT NULL,
    "parameters" JSONB NOT NULL DEFAULT '{}',
    "reportFileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cetp" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacityMld" DOUBLE PRECISION NOT NULL,
    "district" TEXT,
    "memberUnitsCount" INTEGER,
    "hasOnlineCeqms" BOOLEAN NOT NULL DEFAULT false,
    "spraydryerUnits" INTEGER,

    CONSTRAINT "Cetp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CetpMonitoringReport" (
    "id" TEXT NOT NULL,
    "cetpId" TEXT NOT NULL,
    "monthOf" TIMESTAMP(3) NOT NULL,
    "inletNorms" JSONB NOT NULL,
    "finalEffluentStds" JSONB NOT NULL,
    "observedInlet" JSONB NOT NULL,
    "observedFinal" JSONB NOT NULL,
    "bypassMld" DOUBLE PRECISION,
    "hazardousWasteStorageMt" DOUBLE PRECISION,
    "hazardousWasteDisposedMt" DOUBLE PRECISION,
    "reportFileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CetpMonitoringReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnforcementAction" (
    "id" TEXT NOT NULL,
    "industryId" TEXT NOT NULL,
    "type" "EnforcementActionType" NOT NULL,
    "draftedById" TEXT NOT NULL,
    "draftedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "violationIds" TEXT[],
    "state" "MakerCheckerState" NOT NULL DEFAULT 'DRAFT',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewerNotes" TEXT,
    "letterFileUrl" TEXT,
    "deliveryChannel" TEXT,
    "deliveryStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnforcementAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "channel" "ComplaintChannel" NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "complainant" JSONB NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "category" TEXT,
    "severity" "ViolationSeverity" NOT NULL DEFAULT 'MINOR',
    "description" TEXT NOT NULL,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "industryId" TEXT,
    "state" "ComplaintState" NOT NULL DEFAULT 'NEW',
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintResponse" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "respondedById" TEXT NOT NULL,
    "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message" TEXT NOT NULL,
    "action" TEXT,

    CONSTRAINT "ComplaintResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatThread" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceType" "KnowledgeSourceType" NOT NULL,
    "tags" TEXT[],
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkText" TEXT NOT NULL,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL,
    "sentById" TEXT NOT NULL,
    "audience" JSONB NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_xgnId_key" ON "User"("xgnId");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Sector_code_key" ON "Sector"("code");

-- CreateIndex
CREATE UNIQUE INDEX "District_code_key" ON "District"("code");

-- CreateIndex
CREATE INDEX "Taluka_districtId_idx" ON "Taluka"("districtId");

-- CreateIndex
CREATE UNIQUE INDEX "Norm_parameter_stream_category_regulator_key" ON "Norm"("parameter", "stream", "category", "regulator");

-- CreateIndex
CREATE UNIQUE INDEX "Industry_ucNumber_key" ON "Industry"("ucNumber");

-- CreateIndex
CREATE INDEX "Industry_category_idx" ON "Industry"("category");

-- CreateIndex
CREATE INDEX "Industry_districtId_talukaId_idx" ON "Industry"("districtId", "talukaId");

-- CreateIndex
CREATE INDEX "Industry_gidcZoneId_idx" ON "Industry"("gidcZoneId");

-- CreateIndex
CREATE INDEX "ConsentApplication_industryId_idx" ON "ConsentApplication"("industryId");

-- CreateIndex
CREATE INDEX "ConsentApplication_type_state_idx" ON "ConsentApplication"("type", "state");

-- CreateIndex
CREATE INDEX "ConsentApplication_validityTo_idx" ON "ConsentApplication"("validityTo");

-- CreateIndex
CREATE INDEX "Inspection_industryId_idx" ON "Inspection"("industryId");

-- CreateIndex
CREATE INDEX "Inspection_state_scheduledAt_idx" ON "Inspection"("state", "scheduledAt");

-- CreateIndex
CREATE INDEX "Violation_industryId_detectedAt_idx" ON "Violation"("industryId", "detectedAt");

-- CreateIndex
CREATE INDEX "Violation_severity_dispositionState_idx" ON "Violation"("severity", "dispositionState");

-- CreateIndex
CREATE INDEX "MonitoringStation_type_idx" ON "MonitoringStation"("type");

-- CreateIndex
CREATE INDEX "MonitoringStation_industryId_idx" ON "MonitoringStation"("industryId");

-- CreateIndex
CREATE INDEX "SensorReading_stationId_parameter_timestamp_idx" ON "SensorReading"("stationId", "parameter", "timestamp");

-- CreateIndex
CREATE INDEX "Exceedance_stationId_detectedAt_idx" ON "Exceedance"("stationId", "detectedAt");

-- CreateIndex
CREATE INDEX "Exceedance_dispositionState_severity_idx" ON "Exceedance"("dispositionState", "severity");

-- CreateIndex
CREATE INDEX "LabSample_stationId_collectedAt_idx" ON "LabSample"("stationId", "collectedAt");

-- CreateIndex
CREATE INDEX "CetpMonitoringReport_cetpId_monthOf_idx" ON "CetpMonitoringReport"("cetpId", "monthOf");

-- CreateIndex
CREATE INDEX "EnforcementAction_industryId_idx" ON "EnforcementAction"("industryId");

-- CreateIndex
CREATE INDEX "EnforcementAction_state_draftedAt_idx" ON "EnforcementAction"("state", "draftedAt");

-- CreateIndex
CREATE INDEX "Complaint_state_receivedAt_idx" ON "Complaint"("state", "receivedAt");

-- CreateIndex
CREATE INDEX "Complaint_industryId_idx" ON "Complaint"("industryId");

-- CreateIndex
CREATE INDEX "ComplaintResponse_complaintId_idx" ON "ComplaintResponse"("complaintId");

-- CreateIndex
CREATE INDEX "ChatThread_userId_lastMessageAt_idx" ON "ChatThread"("userId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ChatMessage_threadId_createdAt_idx" ON "ChatMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_documentId_idx" ON "KnowledgeChunk"("documentId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Broadcast_sentAt_idx" ON "Broadcast"("sentAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Taluka" ADD CONSTRAINT "Taluka_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Industry" ADD CONSTRAINT "Industry_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Industry" ADD CONSTRAINT "Industry_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Industry" ADD CONSTRAINT "Industry_talukaId_fkey" FOREIGN KEY ("talukaId") REFERENCES "Taluka"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Industry" ADD CONSTRAINT "Industry_gidcZoneId_fkey" FOREIGN KEY ("gidcZoneId") REFERENCES "GidcZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentApplication" ADD CONSTRAINT "ConsentApplication_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentApplication" ADD CONSTRAINT "ConsentApplication_makerId_fkey" FOREIGN KEY ("makerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentApplication" ADD CONSTRAINT "ConsentApplication_checkerId_fkey" FOREIGN KEY ("checkerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Violation" ADD CONSTRAINT "Violation_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Violation" ADD CONSTRAINT "Violation_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoringStation" ADD CONSTRAINT "MonitoringStation_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "MonitoringStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exceedance" ADD CONSTRAINT "Exceedance_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "MonitoringStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exceedance" ADD CONSTRAINT "Exceedance_readingId_fkey" FOREIGN KEY ("readingId") REFERENCES "SensorReading"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exceedance" ADD CONSTRAINT "Exceedance_dispositionActorId_fkey" FOREIGN KEY ("dispositionActorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabSample" ADD CONSTRAINT "LabSample_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "MonitoringStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabSample" ADD CONSTRAINT "LabSample_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CetpMonitoringReport" ADD CONSTRAINT "CetpMonitoringReport_cetpId_fkey" FOREIGN KEY ("cetpId") REFERENCES "Cetp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnforcementAction" ADD CONSTRAINT "EnforcementAction_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnforcementAction" ADD CONSTRAINT "EnforcementAction_draftedById_fkey" FOREIGN KEY ("draftedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnforcementAction" ADD CONSTRAINT "EnforcementAction_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintResponse" ADD CONSTRAINT "ComplaintResponse_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintResponse" ADD CONSTRAINT "ComplaintResponse_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatThread" ADD CONSTRAINT "ChatThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
