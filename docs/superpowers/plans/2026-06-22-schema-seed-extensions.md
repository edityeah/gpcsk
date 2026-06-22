# Schema & Seed Extensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three Prisma migrations (StationUptimeStat, InspectionType+RiskBasedSuggestion, consent docVerification) and wire four new/extended seed files so `db:seed` populates all new tables with realistic deterministic data.

**Architecture:** Three independent migrations applied sequentially via `prisma migrate dev`. Seed files are independent modules imported by `apps/api/src/seed/index.ts`; new seeds (`uptime.ts`, `riskSuggestions.ts`) are added after the data they depend on is already seeded. Existing seeds (`inspections.ts`, `consents.ts`) are extended in-place using the idempotency guard that is already in every seed file (early-return if `count >= threshold`).

**Tech Stack:** Prisma 5.22.0, PostgreSQL with pgvector, TypeScript/tsx, Vitest + supertest for tests, pnpm workspaces (invoked as `npx -y pnpm@9.12.3`).

---

## File Map

| Action | Path |
|--------|------|
| Modify | `apps/api/prisma/schema.prisma` |
| Create | `apps/api/prisma/migrations/20260622000001_add_station_uptime_stat/migration.sql` |
| Create | `apps/api/prisma/migrations/20260622000002_add_inspection_type_and_risk_based_suggestions/migration.sql` |
| Create | `apps/api/prisma/migrations/20260622000003_add_doc_verification_to_consent/migration.sql` |
| Modify | `apps/api/src/seed/inspections.ts` |
| Modify | `apps/api/src/seed/consents.ts` |
| Create | `apps/api/src/seed/uptime.ts` |
| Create | `apps/api/src/seed/riskSuggestions.ts` |
| Modify | `apps/api/src/seed/index.ts` |

---

## Task 1: Update Prisma schema — all three additions at once

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Read the current schema** to locate insertion points.

  Open `apps/api/prisma/schema.prisma`. Key anchors:
  - `enum InspectionState` block (add `InspectionType` enum just after it)
  - `model MonitoringStation` block (add `uptimeStats StationUptimeStat[]` back-relation inside it)
  - `model Industry` block (add `riskBasedSuggestions RiskBasedSuggestion[]` back-relation)
  - `model User` block (add `riskBasedDecisions RiskBasedSuggestion[]` back-relation)
  - `model Inspection` block (add `inspectionType InspectionType @default(ROUTINE)` field)
  - `model ConsentApplication` block (add `docVerification Json @default("{}")` field)
  - After `model Broadcast` at the end: add `model StationUptimeStat` and `model RiskBasedSuggestion`

- [ ] **Step 2: Add `InspectionType` enum after `InspectionState` enum**

  In `apps/api/prisma/schema.prisma`, find:
  ```
  enum InspectionState {
    SCHEDULED
    COMPLETED
    CANCELLED
  }
  ```
  Add after it:
  ```prisma
  enum InspectionType {
    ROUTINE
    RISK_BASED
    COMPLAINT_DRIVEN
    AUTO_SENSOR_DROPOUT
    FOLLOWUP
  }
  ```

- [ ] **Step 3: Add `inspectionType` field to `Inspection` model**

  In the `model Inspection` block, find:
  ```
    state         InspectionState @default(SCHEDULED)
  ```
  Add directly below it:
  ```prisma
    inspectionType InspectionType  @default(ROUTINE)
  ```

- [ ] **Step 4: Add `docVerification` field to `ConsentApplication` model**

  In the `model ConsentApplication` block, find:
  ```
    parameters    Json         @default("{}")
  ```
  Add directly below it:
  ```prisma
    docVerification Json         @default("{}")
  ```

- [ ] **Step 5: Add `uptimeStats` back-relation to `MonitoringStation`**

  In `model MonitoringStation`, find:
  ```
    readings    SensorReading[]
  ```
  Add after the existing relation lines (before the `@@index` lines):
  ```prisma
    uptimeStats StationUptimeStat[]
  ```

- [ ] **Step 6: Add back-relations to `Industry` and `User`**

  In `model Industry`, find:
  ```
    labSamples   LabSample[]
  ```
  Add after it:
  ```prisma
    riskBasedSuggestions RiskBasedSuggestion[]
  ```

  In `model User`, find:
  ```
    broadcastsSent           Broadcast[]
  ```
  Add after it:
  ```prisma
    riskBasedDecisions RiskBasedSuggestion[]
  ```

- [ ] **Step 7: Add `StationUptimeStat` and `RiskBasedSuggestion` models at the end of the file**

  Append after `model Broadcast`:
  ```prisma
  // ── Station uptime longitudinal cache ──────────────────────────────────────

  model StationUptimeStat {
    id              String   @id @default(cuid())
    stationId       String
    date            DateTime @db.Date
    onlineMinutes   Int
    offlineMinutes  Int
    outageCount     Int

    station MonitoringStation @relation(fields: [stationId], references: [id], onDelete: Cascade)
    @@unique([stationId, date])
    @@index([stationId, date])
  }

  // ── Risk-based inspection suggestion queue ─────────────────────────────────

  model RiskBasedSuggestion {
    id             String    @id @default(cuid())
    industryId     String
    suggestedAt    DateTime  @default(now())
    riskScore      Float
    breakdown      Json
    state          String    @default("SUGGESTED")
    decidedById    String?
    decidedAt      DateTime?
    scheduledInspectionId String?

    industry   Industry    @relation(fields: [industryId], references: [id], onDelete: Cascade)
    decidedBy  User?       @relation(fields: [decidedById], references: [id], onDelete: SetNull)
    @@unique([industryId, state])
    @@index([state, suggestedAt])
  }
  ```

- [ ] **Step 8: Verify the schema file is syntactically valid**

  Run:
  ```bash
  cd /Users/adityeahspare/Documents/GPCB && npx -y pnpm@9.12.3 --filter @gpcsk/api exec prisma validate
  ```
  Expected: exits 0, prints "The schema at ... is valid".
  If it errors, read the error message and fix the schema (missing comma, wrong field order, etc.).

---

## Task 2: Migration 1 — StationUptimeStat

**Files:**
- Create: `apps/api/prisma/migrations/20260622000001_add_station_uptime_stat/migration.sql`

- [ ] **Step 1: Create the migration directory and SQL file**

  Create directory `apps/api/prisma/migrations/20260622000001_add_station_uptime_stat/` and write `migration.sql`:

  ```sql
  -- CreateTable
  CREATE TABLE "StationUptimeStat" (
      "id"             TEXT NOT NULL,
      "stationId"      TEXT NOT NULL,
      "date"           DATE NOT NULL,
      "onlineMinutes"  INTEGER NOT NULL,
      "offlineMinutes" INTEGER NOT NULL,
      "outageCount"    INTEGER NOT NULL,

      CONSTRAINT "StationUptimeStat_pkey" PRIMARY KEY ("id")
  );

  -- CreateIndex
  CREATE UNIQUE INDEX "StationUptimeStat_stationId_date_key"
      ON "StationUptimeStat"("stationId", "date");

  CREATE INDEX "StationUptimeStat_stationId_date_idx"
      ON "StationUptimeStat"("stationId", "date");

  -- AddForeignKey
  ALTER TABLE "StationUptimeStat"
      ADD CONSTRAINT "StationUptimeStat_stationId_fkey"
      FOREIGN KEY ("stationId") REFERENCES "MonitoringStation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  ```

- [ ] **Step 2: Apply the migration against the dev database**

  ```bash
  cd /Users/adityeahspare/Documents/GPCB && npx -y pnpm@9.12.3 --filter @gpcsk/api exec prisma migrate dev --name add_station_uptime_stat
  ```

  Expected output contains:
  ```
  Your database is now in sync with your schema.
  ```

  If Prisma says it needs to create a new migration (because it detects a diff), let it — it will overwrite the migration file you created with the correct auto-generated one. That is fine; the important thing is the migration applies cleanly.

---

## Task 3: Migration 2 — InspectionType enum + inspectionType field + RiskBasedSuggestion

**Files:**
- Create: `apps/api/prisma/migrations/20260622000002_add_inspection_type_and_risk_based_suggestions/migration.sql`

- [ ] **Step 1: Create the migration directory and SQL file**

  Create directory `apps/api/prisma/migrations/20260622000002_add_inspection_type_and_risk_based_suggestions/` and write `migration.sql`:

  ```sql
  -- CreateEnum
  CREATE TYPE "InspectionType" AS ENUM (
      'ROUTINE',
      'RISK_BASED',
      'COMPLAINT_DRIVEN',
      'AUTO_SENSOR_DROPOUT',
      'FOLLOWUP'
  );

  -- AlterTable: add inspectionType column with default ROUTINE
  ALTER TABLE "Inspection"
      ADD COLUMN "inspectionType" "InspectionType" NOT NULL DEFAULT 'ROUTINE';

  -- CreateTable: RiskBasedSuggestion
  CREATE TABLE "RiskBasedSuggestion" (
      "id"                     TEXT NOT NULL,
      "industryId"             TEXT NOT NULL,
      "suggestedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "riskScore"              DOUBLE PRECISION NOT NULL,
      "breakdown"              JSONB NOT NULL,
      "state"                  TEXT NOT NULL DEFAULT 'SUGGESTED',
      "decidedById"            TEXT,
      "decidedAt"              TIMESTAMP(3),
      "scheduledInspectionId"  TEXT,

      CONSTRAINT "RiskBasedSuggestion_pkey" PRIMARY KEY ("id")
  );

  -- CreateIndex
  CREATE UNIQUE INDEX "RiskBasedSuggestion_industryId_state_key"
      ON "RiskBasedSuggestion"("industryId", "state");

  CREATE INDEX "RiskBasedSuggestion_state_suggestedAt_idx"
      ON "RiskBasedSuggestion"("state", "suggestedAt");

  -- AddForeignKey
  ALTER TABLE "RiskBasedSuggestion"
      ADD CONSTRAINT "RiskBasedSuggestion_industryId_fkey"
      FOREIGN KEY ("industryId") REFERENCES "Industry"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;

  ALTER TABLE "RiskBasedSuggestion"
      ADD CONSTRAINT "RiskBasedSuggestion_decidedById_fkey"
      FOREIGN KEY ("decidedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  ```

- [ ] **Step 2: Apply migration 2**

  ```bash
  cd /Users/adityeahspare/Documents/GPCB && npx -y pnpm@9.12.3 --filter @gpcsk/api exec prisma migrate dev --name add_inspection_type_and_risk_based_suggestions
  ```

  Expected: exits 0, "Your database is now in sync."

---

## Task 4: Migration 3 — docVerification on ConsentApplication

**Files:**
- Create: `apps/api/prisma/migrations/20260622000003_add_doc_verification_to_consent/migration.sql`

- [ ] **Step 1: Create migration directory and SQL file**

  Create directory `apps/api/prisma/migrations/20260622000003_add_doc_verification_to_consent/` and write `migration.sql`:

  ```sql
  -- AlterTable: add docVerification JSON column defaulting to empty object
  ALTER TABLE "ConsentApplication"
      ADD COLUMN "docVerification" JSONB NOT NULL DEFAULT '{}';
  ```

- [ ] **Step 2: Apply migration 3**

  ```bash
  cd /Users/adityeahspare/Documents/GPCB && npx -y pnpm@9.12.3 --filter @gpcsk/api exec prisma migrate dev --name add_doc_verification_to_consent
  ```

  Expected: exits 0, "Your database is now in sync."

- [ ] **Step 3: Regenerate Prisma client after all three migrations**

  ```bash
  cd /Users/adityeahspare/Documents/GPCB && npx -y pnpm@9.12.3 --filter @gpcsk/api exec prisma generate
  ```

  Expected: "Generated Prisma Client ... to node_modules/@prisma/client"

---

## Task 5: Extend `inspections.ts` seed — add `inspectionType`

**Files:**
- Modify: `apps/api/src/seed/inspections.ts`

The seed already creates 200 COMPLETED + 50 SCHEDULED inspections. We extend the create calls to also set `inspectionType`. Distribution: 50% ROUTINE, 30% RISK_BASED, 15% COMPLAINT_DRIVEN, 5% AUTO_SENSOR_DROPOUT.

- [ ] **Step 1: Add the `InspectionType` import**

  At the top of `apps/api/src/seed/inspections.ts`, find:
  ```typescript
  import { Prisma, type PrismaClient, type ViolationSource, type ViolationSeverity, type DispositionState } from '@prisma/client'
  ```
  Replace with:
  ```typescript
  import { Prisma, type PrismaClient, type ViolationSource, type ViolationSeverity, type DispositionState, type InspectionType } from '@prisma/client'
  ```

- [ ] **Step 2: Add the inspection-type distribution array**

  After the `VIOLATION_DISPOSITIONS` constant (around line 129), add:
  ```typescript
  // InspectionType distribution: 50% ROUTINE, 30% RISK_BASED, 15% COMPLAINT_DRIVEN, 5% AUTO_SENSOR_DROPOUT
  const INSPECTION_TYPES = [
    'ROUTINE', 'ROUTINE', 'ROUTINE', 'ROUTINE', 'ROUTINE', 'ROUTINE', 'ROUTINE', 'ROUTINE', 'ROUTINE', 'ROUTINE',
    'RISK_BASED', 'RISK_BASED', 'RISK_BASED', 'RISK_BASED', 'RISK_BASED', 'RISK_BASED',
    'COMPLAINT_DRIVEN', 'COMPLAINT_DRIVEN', 'COMPLAINT_DRIVEN',
    'AUTO_SENSOR_DROPOUT',
  ] as const
  ```

- [ ] **Step 3: Update the COMPLETED inspections loop to set `inspectionType`**

  In the loop `for (let i = 0; i < 200; i++)`, find the `prisma.inspection.create` call's `data` object. It ends with:
  ```typescript
        observations: obsSet as unknown as Prisma.InputJsonValue,
        photos: [] as unknown as Prisma.InputJsonValue,
  ```
  Add `inspectionType` before the closing `}`:
  ```typescript
        observations: obsSet as unknown as Prisma.InputJsonValue,
        photos: [] as unknown as Prisma.InputJsonValue,
        inspectionType: pick(INSPECTION_TYPES, seed, 6) as InspectionType,
  ```

- [ ] **Step 4: Update the SCHEDULED inspections loop to set `inspectionType`**

  In the loop `for (let i = 0; i < 50; i++)`, find the SCHEDULED inspection's `prisma.inspection.create` `data` object. It ends with:
  ```typescript
        state: 'SCHEDULED',
        observations: {},
        photos: [] as unknown as Prisma.InputJsonValue,
  ```
  Add:
  ```typescript
        state: 'SCHEDULED',
        observations: {},
        photos: [] as unknown as Prisma.InputJsonValue,
        inspectionType: pick(INSPECTION_TYPES, seed, 4) as InspectionType,
  ```

- [ ] **Step 5: Typecheck the file**

  ```bash
  cd /Users/adityeahspare/Documents/GPCB && npx -y pnpm@9.12.3 --filter @gpcsk/api run typecheck
  ```

  Expected: exits 0 with no errors. If there are `InspectionType` type errors, ensure the Prisma client was regenerated in Task 4 Step 3.

---

## Task 6: Extend `consents.ts` seed — add `docVerification`

**Files:**
- Modify: `apps/api/src/seed/consents.ts`

We add a `buildDocVerification(key: string)` helper and call it in the `prisma.consentApplication.create` data object.

- [ ] **Step 1: Add the `buildDocVerification` helper function**

  In `apps/api/src/seed/consents.ts`, after the `hwAuthParameters` function (around line 136), insert:

  ```typescript
  // ── AI document verification builder ─────────────────────────────────────────

  type DocStatus = 'OK' | 'BLANK' | 'MISSING' | 'BLURRED' | 'UNCLEAR' | 'UNSCANNED'

  interface DocEntry {
    name: string
    status: DocStatus
    aiNote?: string
  }

  const DOC_NAMES = [
    'Layout Plan',
    'CA Certificate',
    'EIA Report',
    'Fee Receipt',
    'Site Photograph',
    'NOC Local Body',
    'Process Flowchart',
  ] as const

  const ISSUE_STATUSES: DocStatus[] = ['BLANK', 'MISSING', 'BLURRED', 'UNCLEAR', 'UNSCANNED']
  const ISSUE_NOTES: Record<DocStatus, string[]> = {
    BLANK:    ['Document page appears completely blank', 'Blank sheet uploaded instead of document'],
    MISSING:  ['Document not attached', 'Required document missing from submission'],
    BLURRED:  ['Image resolution too low to verify content', 'Scan quality insufficient'],
    UNCLEAR:  ['Document content not legible', 'Poor photocopy quality'],
    UNSCANNED: ['Physical document not yet scanned', 'Upload pending'],
    OK:       [],
  }

  function buildDocVerification(key: string): Record<string, unknown> {
    const f = seededFloat(key)

    // Determine how many docs have issues based on distribution:
    // ~60% all OK, ~25% 1-2 issues, ~10% 4+ issues, ~5% minor
    let issueCount: number
    if (f < 0.60) {
      issueCount = 0
    } else if (f < 0.85) {
      issueCount = Math.floor(seededFloat(key + '-ic') * 2) + 1 // 1 or 2
    } else if (f < 0.95) {
      issueCount = Math.floor(seededFloat(key + '-ic') * 3) + 4 // 4, 5, or 6
    } else {
      issueCount = 1 // minor: exactly 1 issue
    }

    // Shuffle doc names deterministically to decide which ones get issues
    const shuffled = [...DOC_NAMES] as string[]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = seededInt(seededFloat(key + `-sh${i}`), i + 1)
      const tmp = shuffled[i] as string
      shuffled[i] = shuffled[j] as string
      shuffled[j] = tmp
    }

    const issueSet = new Set(shuffled.slice(0, issueCount))

    const documents: DocEntry[] = DOC_NAMES.map((name) => {
      if (!issueSet.has(name)) return { name, status: 'OK' as DocStatus }
      const status = ISSUE_STATUSES[seededInt(seededFloat(key + name), ISSUE_STATUSES.length)] as DocStatus
      const notes = ISSUE_NOTES[status]
      const aiNote = notes.length > 0
        ? notes[seededInt(seededFloat(key + name + '-note'), notes.length)] as string
        : undefined
      return { name, status, ...(aiNote ? { aiNote } : {}) }
    })

    const allOk = documents.every(d => d.status === 'OK')
    const humanReviewStatus = allOk
      ? (seededFloat(key + '-hr') < 0.7 ? 'APPROVED' : 'PENDING_REVIEW')
      : 'PENDING_REVIEW'

    const aiConfidence = allOk
      ? parseFloat((0.85 + seededFloat(key + '-conf') * 0.14).toFixed(2))
      : parseFloat((0.45 + seededFloat(key + '-conf') * 0.40).toFixed(2))

    const reviewedAt = new Date()
    reviewedAt.setDate(reviewedAt.getDate() - Math.floor(seededFloat(key + '-rat') * 30))

    return {
      documents,
      aiReviewedAt: reviewedAt.toISOString(),
      humanReviewStatus,
      aiConfidence,
    }
  }
  ```

- [ ] **Step 2: Pass `docVerification` in the `prisma.consentApplication.create` call**

  In the `if (!existing)` block, find:
  ```typescript
        parameters: parameters as Prisma.InputJsonValue,
  ```
  Add directly below it:
  ```typescript
        docVerification: buildDocVerification(key) as Prisma.InputJsonValue,
  ```

- [ ] **Step 3: Typecheck**

  ```bash
  cd /Users/adityeahspare/Documents/GPCB && npx -y pnpm@9.12.3 --filter @gpcsk/api run typecheck
  ```

  Expected: exits 0.

---

## Task 7: Create `apps/api/src/seed/uptime.ts`

**Files:**
- Create: `apps/api/src/seed/uptime.ts`

- [ ] **Step 1: Write the uptime seed file**

  Create `apps/api/src/seed/uptime.ts` with this content:

  ```typescript
  /**
   * StationUptimeStat seed: one row per MonitoringStation per day for the last 90 days.
   * Distribution per station-day (deterministic via per-station band):
   *   ~85%  → 1440 onlineMinutes, 0 offlineMinutes, 0 outages
   *   ~10%  → 1 outage: 60-300 offlineMinutes
   *   ~5%   → 2-3 outages: longer offline windows
   * Total target: ~170 stations × 90 days = ~15 300 rows
   */
  import type { PrismaClient } from '@prisma/client'

  // ── Deterministic PRNG ────────────────────────────────────────────────────────

  function mulberry32(seed: number): () => number {
    let s = seed | 0
    return () => {
      s = (s + 0x6d2b79f5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff
    }
  }

  function strHash(str: string): number {
    let h = 0x811c9dc5
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) | 0
    }
    return h >>> 0
  }

  // ── Main seed function ─────────────────────────────────────────────────────────

  export async function seedStationUptime(prisma: PrismaClient): Promise<number> {
    // Idempotent: skip if we already have uptime stats
    const existing = await prisma.stationUptimeStat.count()
    if (existing >= 10_000) return existing

    const stations = await prisma.monitoringStation.findMany({ select: { id: true } })
    if (stations.length === 0) {
      throw new Error('seedStationUptime: no stations found — run seedSensors first')
    }

    const now = new Date()
    // Midnight UTC of today
    const todayMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

    const DAYS = 90
    let inserted = 0

    for (const station of stations) {
      const stationRng = mulberry32(strHash(station.id))

      // Per-station baseline: controls how "healthy" this station is overall
      // Higher baseline → fewer outage days
      const baseline = stationRng()

      for (let d = 0; d < DAYS; d++) {
        const dayDate = new Date(todayMidnight.getTime() - d * 86_400_000)
        const dayRng = mulberry32(strHash(station.id + '-' + d))
        const roll = dayRng()

        let onlineMinutes: number
        let offlineMinutes: number
        let outageCount: number

        if (roll < 0.85) {
          // ~85%: perfect uptime
          onlineMinutes = 1440
          offlineMinutes = 0
          outageCount = 0
        } else if (roll < 0.95) {
          // ~10%: single outage, 60–300 min offline
          const outage = Math.floor(60 + dayRng() * 240)
          offlineMinutes = outage
          onlineMinutes = 1440 - outage
          outageCount = 1
        } else {
          // ~5%: 2–3 outages, longer windows
          const numOutages = Math.floor(dayRng() * 2) + 2 // 2 or 3
          // Each outage: 120–480 min, but total capped at 1200
          let totalOffline = 0
          for (let o = 0; o < numOutages; o++) {
            const dur = Math.floor(120 + dayRng() * 360)
            totalOffline = Math.min(totalOffline + dur, 1200)
          }
          offlineMinutes = totalOffline
          onlineMinutes = 1440 - totalOffline
          outageCount = numOutages
        }

        // Adjust slightly by per-station baseline: very healthy stations shift roll up
        // (already baked into the roll threshold; baseline is used only for station-level jitter)
        if (baseline > 0.92) {
          // Extra-healthy: force all outage days into the single-outage tier
          if (outageCount > 1) {
            const outage = Math.floor(60 + dayRng() * 120)
            offlineMinutes = outage
            onlineMinutes = 1440 - outage
            outageCount = 1
          }
        }

        await prisma.stationUptimeStat.create({
          data: {
            stationId: station.id,
            date: dayDate,
            onlineMinutes,
            offlineMinutes,
            outageCount,
          },
        })
        inserted++
      }
    }

    return inserted
  }
  ```

- [ ] **Step 2: Typecheck**

  ```bash
  cd /Users/adityeahspare/Documents/GPCB && npx -y pnpm@9.12.3 --filter @gpcsk/api run typecheck
  ```

  Expected: exits 0.

---

## Task 8: Create `apps/api/src/seed/riskSuggestions.ts`

**Files:**
- Create: `apps/api/src/seed/riskSuggestions.ts`

This seed re-uses the same SQL logic as `/api/stats/risk-index` to compute scores in-process, picks the top 20, and inserts `RiskBasedSuggestion` rows.

- [ ] **Step 1: Write the riskSuggestions seed file**

  Create `apps/api/src/seed/riskSuggestions.ts`:

  ```typescript
  /**
   * RiskBasedSuggestion seed:
   *   - Top 20 industries by risk score → state='SUGGESTED'
   *   - 5 additional → state='DISMISSED' (dismissed history)
   *   - 8 additional → state='CONFIRMED', linked to existing RISK_BASED inspections
   * Total target: 33 rows.
   *
   * Risk score formula mirrors /api/stats/risk-index:
   *   score = clamp(0,100, 30*(exc30d/10) + 15*(comp30d/5) + 10*(openInsp/3) + 20*(consentGapDays>0))
   */
  import type { PrismaClient } from '@prisma/client'

  function clamp(min: number, val: number, max: number): number {
    return Math.max(min, Math.min(max, val))
  }

  // Minimal deterministic hash for stable ordering tie-breaking
  function strHash(str: string): number {
    let h = 0x811c9dc5
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) | 0
    }
    return h >>> 0
  }

  export async function seedRiskSuggestions(prisma: PrismaClient): Promise<number> {
    // Idempotent: skip if already seeded
    const existing = await prisma.riskBasedSuggestion.count()
    if (existing >= 20) return existing

    const now = new Date()
    const since30d = new Date(now.getTime() - 30 * 86_400_000)

    // Fetch the same raw metrics the risk-index endpoint uses
    const rows = await prisma.$queryRaw<
      Array<{
        industryId: string
        name: string
        exceedance30d: bigint
        complaints30d: bigint
        openInspections: bigint
        consentGapDays: number | null
      }>
    >`
      SELECT
        i.id                                   AS "industryId",
        i.name,
        COALESCE(ex30.cnt, 0)                  AS "exceedance30d",
        COALESCE(comp30.cnt, 0)                AS "complaints30d",
        COALESCE(insp.cnt, 0)                  AS "openInspections",
        CASE
          WHEN cons.max_validity IS NULL THEN NULL
          WHEN cons.max_validity < ${now} THEN
            EXTRACT(EPOCH FROM (${now}::timestamp - cons.max_validity)) / 86400.0
          ELSE NULL
        END AS "consentGapDays"
      FROM "Industry" i
      LEFT JOIN (
        SELECT ms."industryId", COUNT(*)::bigint AS cnt
        FROM   "Exceedance" ex2
        JOIN   "MonitoringStation" ms ON ms.id = ex2."stationId"
        WHERE  ex2."detectedAt" >= ${since30d}
        GROUP  BY ms."industryId"
      ) ex30 ON ex30."industryId" = i.id
      LEFT JOIN (
        SELECT "industryId", COUNT(*)::bigint AS cnt
        FROM   "Complaint"
        WHERE  "receivedAt" >= ${since30d} AND "industryId" IS NOT NULL
        GROUP  BY "industryId"
      ) comp30 ON comp30."industryId" = i.id
      LEFT JOIN (
        SELECT "industryId", COUNT(*)::bigint AS cnt
        FROM   "Inspection"
        WHERE  state = 'SCHEDULED'
        GROUP  BY "industryId"
      ) insp ON insp."industryId" = i.id
      LEFT JOIN (
        SELECT "industryId", MAX("validityTo") AS max_validity
        FROM   "ConsentApplication"
        WHERE  state IN ('APPROVED','RENEWED') AND "validityTo" IS NOT NULL
        GROUP  BY "industryId"
      ) cons ON cons."industryId" = i.id
      ORDER BY i.id
    `

    // Score each row
    const scored = rows.map(r => {
      const exc = Number(r.exceedance30d)
      const comp = Number(r.complaints30d)
      const openInsp = Number(r.openInspections)
      const consentGapDays = r.consentGapDays != null ? Number(r.consentGapDays) : 0

      const excRate = Math.min(exc / 10, 1)
      const compRate = Math.min(comp / 5, 1)
      const inspRate = Math.min(openInsp / 3, 1)
      const consentFlag = consentGapDays > 0 ? 1 : 0

      const riskScore = clamp(0, 100, 30 * excRate + 15 * compRate + 10 * inspRate + 20 * consentFlag)

      return {
        industryId: r.industryId,
        name: r.name,
        riskScore: Math.round(riskScore * 10) / 10,
        breakdown: {
          exceedance30d: exc,
          complaints30d: comp,
          openInspections: openInsp,
          consentGapDays: Math.round(consentGapDays),
        },
      }
    })

    // Sort descending by score, use strHash for stable tie-breaking
    scored.sort((a, b) =>
      b.riskScore !== a.riskScore
        ? b.riskScore - a.riskScore
        : strHash(a.industryId) - strHash(b.industryId)
    )

    // Take top 33 (20 SUGGESTED + 5 DISMISSED + 8 CONFIRMED)
    const top33 = scored.slice(0, 33)
    if (top33.length < 33) {
      // Pad with lower-scored industries if needed (edge case when DB has very few industries)
      const rest = scored.slice(top33.length)
      while (top33.length < 33 && rest.length > 0) {
        top33.push(rest.shift()!)
      }
    }

    // Fetch a user to be the decider for DISMISSED/CONFIRMED rows
    const decider = await prisma.user.findFirst({ where: { role: 'SENIOR_REVIEWER' } })
    const decidedById = decider?.id ?? null

    // Fetch RISK_BASED COMPLETED inspections to link to CONFIRMED suggestions
    const riskBasedInspections = await prisma.inspection.findMany({
      where: { inspectionType: 'RISK_BASED', state: 'COMPLETED' },
      select: { id: true, industryId: true },
      take: 8,
    })

    let inserted = 0

    // 1. Top 20 → SUGGESTED
    for (let i = 0; i < Math.min(20, top33.length); i++) {
      const entry = top33[i]!
      await prisma.riskBasedSuggestion.upsert({
        where: { industryId_state: { industryId: entry.industryId, state: 'SUGGESTED' } },
        update: {},
        create: {
          industryId: entry.industryId,
          riskScore: entry.riskScore,
          breakdown: entry.breakdown,
          state: 'SUGGESTED',
        },
      })
      inserted++
    }

    // 2. Next 5 → DISMISSED
    for (let i = 20; i < Math.min(25, top33.length); i++) {
      const entry = top33[i]!
      await prisma.riskBasedSuggestion.upsert({
        where: { industryId_state: { industryId: entry.industryId, state: 'DISMISSED' } },
        update: {},
        create: {
          industryId: entry.industryId,
          riskScore: entry.riskScore,
          breakdown: entry.breakdown,
          state: 'DISMISSED',
          decidedById,
          decidedAt: new Date(now.getTime() - (i - 19) * 3 * 86_400_000),
        },
      })
      inserted++
    }

    // 3. Next 8 → CONFIRMED, linked to RISK_BASED inspections
    for (let i = 25; i < Math.min(33, top33.length); i++) {
      const entry = top33[i]!
      const inspection = riskBasedInspections[i - 25]
      await prisma.riskBasedSuggestion.upsert({
        where: { industryId_state: { industryId: entry.industryId, state: 'CONFIRMED' } },
        update: {},
        create: {
          industryId: entry.industryId,
          riskScore: entry.riskScore,
          breakdown: entry.breakdown,
          state: 'CONFIRMED',
          decidedById,
          decidedAt: new Date(now.getTime() - (i - 24) * 2 * 86_400_000),
          scheduledInspectionId: inspection?.id ?? null,
        },
      })
      inserted++
    }

    return inserted
  }
  ```

- [ ] **Step 2: Typecheck**

  ```bash
  cd /Users/adityeahspare/Documents/GPCB && npx -y pnpm@9.12.3 --filter @gpcsk/api run typecheck
  ```

  Expected: exits 0.

---

## Task 9: Wire new seeds into `apps/api/src/seed/index.ts`

**Files:**
- Modify: `apps/api/src/seed/index.ts`

- [ ] **Step 1: Add imports for new seed functions**

  At the top of `apps/api/src/seed/index.ts`, after the existing imports, add:
  ```typescript
  import { seedStationUptime } from './uptime.js'
  import { seedRiskSuggestions } from './riskSuggestions.js'
  ```

- [ ] **Step 2: Call `seedStationUptime` after `seedSensors`**

  After the sensors block:
  ```typescript
  logger.info(
    `sensors done: ${stationCount} stations, ${readingCount} readings, ` +
    `${exceedanceCount} exceedances seeded`
  )
  ```
  Add:
  ```typescript
  logger.info('seeding station uptime stats…')
  const uptimeCount = await seedStationUptime(prisma)
  logger.info(`station uptime done: ${uptimeCount} StationUptimeStat rows seeded`)
  ```

- [ ] **Step 3: Call `seedRiskSuggestions` after `seedEnforcementActions` (after all inspection/industry data is present)**

  After the enforcement block:
  ```typescript
  logger.info(`enforcement done: ${enforcementCount} enforcement actions, ${auditCount} total audit log entries seeded`)
  ```
  Add:
  ```typescript
  logger.info('seeding risk-based suggestion queue…')
  const riskSuggestionCount = await seedRiskSuggestions(prisma)
  logger.info(`risk suggestions done: ${riskSuggestionCount} RiskBasedSuggestion rows seeded`)
  ```

- [ ] **Step 4: Typecheck**

  ```bash
  cd /Users/adityeahspare/Documents/GPCB && npx -y pnpm@9.12.3 --filter @gpcsk/api run typecheck
  ```

  Expected: exits 0.

---

## Task 10: Run full migration + seed verification

- [ ] **Step 1: Run migrations on dev DB**

  ```bash
  cd /Users/adityeahspare/Documents/GPCB && npx -y pnpm@9.12.3 --filter @gpcsk/api exec prisma migrate dev
  ```

  Expected: "Your database is now in sync with your schema." (may say "No pending migrations" if Task 2-4 already ran them; that is fine).

- [ ] **Step 2: Reset and re-seed (clean slate)**

  ```bash
  cd /Users/adityeahspare/Documents/GPCB && npx -y pnpm@9.12.3 --filter @gpcsk/api run db:seed
  ```

  Watch the logs. Expected new lines:
  ```
  seeding station uptime stats…
  station uptime done: <N> StationUptimeStat rows seeded     ← expect ~15 000–15 300
  seeding risk-based suggestion queue…
  risk suggestions done: 33 RiskBasedSuggestion rows seeded  ← or fewer if <33 industries have scores
  ```

  If the seed crashes with a Prisma unique constraint on `RiskBasedSuggestion_industryId_state_key`, it means you are running seed twice without resetting. That is expected — the idempotency guard will skip it on the second run.

- [ ] **Step 3: Run test suite**

  ```bash
  cd /Users/adityeahspare/Documents/GPCB && npx -y pnpm@9.12.3 --filter @gpcsk/api run test
  ```

  Expected: all existing 192+ tests pass. No regressions. New seed files do not have separate unit tests (they are integration-tested via the full seed run in Step 2).

- [ ] **Step 4: Full typecheck across all packages**

  ```bash
  cd /Users/adityeahspare/Documents/GPCB && npx -y pnpm@9.12.3 -r run typecheck
  ```

  Expected: exits 0 across all packages.

---

## Task 11: Commit and push

- [ ] **Step 1: Stage all changed files**

  ```bash
  cd /Users/adityeahspare/Documents/GPCB && git add \
    apps/api/prisma/schema.prisma \
    apps/api/prisma/migrations/20260622000001_add_station_uptime_stat/ \
    apps/api/prisma/migrations/20260622000002_add_inspection_type_and_risk_based_suggestions/ \
    apps/api/prisma/migrations/20260622000003_add_doc_verification_to_consent/ \
    apps/api/src/seed/uptime.ts \
    apps/api/src/seed/riskSuggestions.ts \
    apps/api/src/seed/inspections.ts \
    apps/api/src/seed/consents.ts \
    apps/api/src/seed/index.ts
  ```

- [ ] **Step 2: Commit**

  ```bash
  cd /Users/adityeahspare/Documents/GPCB && git commit -m "feat(schema): StationUptimeStat + RiskBasedSuggestion + inspectionType + consent docVerification + seeds"
  ```

- [ ] **Step 3: Push to both remotes**

  ```bash
  cd /Users/adityeahspare/Documents/GPCB && git push origin slice-1-foundation && git push origin slice-1-foundation:main
  ```

  Expected: both pushes succeed.

---

## Self-Review Checklist

**Spec coverage:**
- [x] StationUptimeStat model with all fields and back-relation → Task 1 + Task 2
- [x] Migration name `add_station_uptime_stat` → Task 2
- [x] InspectionType enum with 5 values → Task 1 + Task 3
- [x] `inspectionType` field on Inspection with ROUTINE default → Task 1 + Task 3
- [x] RiskBasedSuggestion model with all fields → Task 1 + Task 3
- [x] Back-relations on Industry + User → Task 1
- [x] Migration name `add_inspection_type_and_risk_based_suggestions` → Task 3
- [x] `docVerification Json @default("{}")` on ConsentApplication → Task 1 + Task 4
- [x] Migration name `add_doc_verification_to_consent` → Task 4
- [x] `uptime.ts` seed: 90 days, deterministic, ~85/10/5 distribution → Task 7
- [x] `consents.ts` extended with docVerification → Task 6
- [x] `inspections.ts` extended with inspectionType (50/30/15/5) → Task 5
- [x] `riskSuggestions.ts`: top 20 SUGGESTED, 5 DISMISSED, 8 CONFIRMED → Task 8
- [x] `index.ts` wired in correct order → Task 9
- [x] typecheck + tests → Task 10
- [x] Commit + push → Task 11

**Potential issues to watch:**
- The `@@unique([industryId, state])` on RiskBasedSuggestion means each industry can only have ONE row per state. The upsert in `riskSuggestions.ts` uses `{ where: { industryId_state: {...} } }` which relies on Prisma generating this compound unique name. If Prisma generates a different name, update the upsert `where` to match what Prisma generated (visible in the generated client types).
- The migration files have manually set timestamps (`20260622000001`, etc.). If Prisma's `migrate dev` detects a drift and generates its own migration, the auto-generated file is authoritative — delete the manual file and use Prisma's output.
- The `inspections.ts` idempotency guard is `existing >= 200`. After this change, the guard will skip re-seeding if 200+ inspections exist, meaning `inspectionType` is only populated on a fresh seed. This is acceptable behavior for a dev seed.
