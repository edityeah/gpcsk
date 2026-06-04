# GPCSK — Slice 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the GPCSK monorepo, Postgres + pgvector via Docker, full Prisma schema, mock-XGN-SSO + phone-OTP authentication, the React/Tailwind frontend cloned 1:1 from KSK with English + Gujarati i18n, and a working login flow that lands every role on an empty `SuperHomePage` shell.

**Architecture:** pnpm workspace monorepo with `apps/api` (Node 20 + Express + Prisma + TypeScript), `apps/web` (Vite + React 18 + Tailwind 3 + TypeScript), and `packages/shared` (cross-app TS types). Postgres 16 + pgvector run in a local Docker container; the schema covers every entity the spec lists so subsequent slices only add data + UI. Auth is JWT against seeded demo users with universal OTP `1234` and `123456`. The frontend has no router — `AppContext.screen` drives screen-by-screen rendering exactly like KSK.

**Tech Stack:** pnpm 9, Node 20, TypeScript 5.5, Express 4.21, Prisma 5.22, Postgres 16-alpine, pgvector 0.7, Vite 5.4, React 18.3, Tailwind 3.4, lucide-react 1.7, react-i18next 14, Vitest 2, @testing-library/react 16, supertest 7, jsonwebtoken 9, bcryptjs 2, zod 3, pino 9.

---

## File Structure

```
.
├── package.json                     Workspace root — scripts, devDeps shared across workspace
├── pnpm-workspace.yaml              Workspace declaration
├── .editorconfig                    Editor consistency
├── .env.example                     Template (committed) — secrets never committed
├── .nvmrc                           Node 20.x pin
├── tsconfig.base.json               Shared TS compiler options
├── docker-compose.yml               Local dev — postgres + pgvector only
├── docker-compose.tunnel.yml        Production — web + api + db bound to 127.0.0.1
├── docs/                            (already exists)
│
├── packages/
│   └── shared/
│       ├── package.json             Shared TS types package
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts             Barrel export
│           ├── roles.ts             Role enum + helpers
│           ├── streams.ts           Pollution stream enum (Air/Water/HW/Noise)
│           ├── severity.ts          Violation severity, maker-checker states
│           ├── consent-types.ts     CTE / CTO / HW_AUTH enum
│           └── parameters.ts        Sensor parameters (PM10, COD, …)
│
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── Dockerfile               Production container (used by tunnel compose)
│   │   ├── prisma/
│   │   │   ├── schema.prisma        FULL data model from spec §7
│   │   │   └── migrations/
│   │   └── src/
│   │       ├── index.ts             Server bootstrap
│   │       ├── app.ts               Express app composition (exported for tests)
│   │       ├── env.ts               Validated env (zod)
│   │       ├── logger.ts            Pino logger
│   │       ├── db.ts                Prisma client singleton
│   │       ├── auth/
│   │       │   ├── jwt.ts           Sign/verify
│   │       │   ├── jwt.test.ts
│   │       │   ├── otp.ts           Demo OTP validation (1234 / 123456)
│   │       │   ├── otp.test.ts
│   │       │   ├── router.ts        /api/auth/* routes
│   │       │   ├── router.test.ts
│   │       │   └── middleware.ts    requireAuth, requireRole
│   │       ├── audit/
│   │       │   ├── service.ts
│   │       │   └── service.test.ts
│   │       ├── users/
│   │       │   ├── router.ts        /api/me
│   │       │   └── router.test.ts
│   │       └── seed/
│   │           └── users.ts         One demo user per role
│   └── web/
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsconfig.node.json
│       ├── vite.config.ts
│       ├── tailwind.config.ts       Cloned 1:1 from KSK with GPCSK extras (Gujarati font)
│       ├── postcss.config.js
│       ├── index.html
│       ├── Dockerfile               Production build → nginx
│       ├── nginx.conf
│       └── src/
│           ├── main.tsx
│           ├── App.tsx              Screen router (no react-router)
│           ├── index.css            Cloned 1:1 from KSK + Gujarati font import
│           ├── i18n/
│           │   ├── index.ts
│           │   └── locales/
│           │       ├── en.json
│           │       └── gu.json
│           ├── context/
│           │   ├── AppContext.tsx   { screen, language, setScreen, setLanguage }
│           │   └── AuthContext.tsx  { user, token, login, logout }
│           ├── lib/
│           │   ├── api.ts           Typed fetch wrapper
│           │   └── api.test.ts
│           ├── components/
│           │   ├── Toast.tsx
│           │   ├── TricolorStrip.tsx
│           │   ├── shell/
│           │   │   ├── TopBar.tsx
│           │   │   ├── Sidebar.tsx
│           │   │   ├── AskAiPanel.tsx
│           │   │   └── CanvasPanel.tsx
│           │   └── ui/
│           │       ├── Button.tsx
│           │       └── Spinner.tsx
│           └── pages/
│               ├── SplashPage.tsx
│               ├── LanguagePage.tsx
│               ├── LoginPage.tsx
│               ├── PhoneEntryPage.tsx
│               ├── PhoneOtpPage.tsx
│               ├── XgnRedirectPage.tsx
│               ├── XgnVerifyingPage.tsx
│               ├── DemoRolePickerPage.tsx
│               └── SuperHomePage.tsx
```

Each file has one responsibility. The web side mirrors KSK's screen-driven structure verbatim so a KSK contributor can navigate it without explanation.

---

### Task 1: Workspace scaffold + root config

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.editorconfig`
- Create: `.env.example`
- Create: `.nvmrc`
- Create: `tsconfig.base.json`

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 2: Create `package.json` (workspace root)**

```json
{
  "name": "gpcsk",
  "private": true,
  "version": "0.1.0",
  "engines": { "node": ">=20", "pnpm": ">=9" },
  "packageManager": "pnpm@9.12.3",
  "scripts": {
    "dev": "pnpm -r --parallel run dev",
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "lint": "pnpm -r run lint",
    "typecheck": "pnpm -r run typecheck",
    "db:up": "docker compose up -d db",
    "db:down": "docker compose down",
    "db:reset": "docker compose down -v && docker compose up -d db"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "@types/node": "^20.14.10"
  }
}
```

- [ ] **Step 3: Create `.editorconfig`**

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 4: Create `.env.example`**

```bash
# === Database ===
DATABASE_URL=postgresql://gpcsk:gpcsk_dev@localhost:5433/gpcsk?schema=public

# === API ===
API_PORT=8000
API_JWT_SECRET=replace-me-in-prod-32-bytes-min
API_JWT_TTL_HOURS=24
CORS_ALLOWED_ORIGINS=http://localhost:3000

# === Web ===
VITE_API_URL=http://localhost:8000

# === OpenAI (Slice 7 — RAG + chat) ===
OPENAI_API_KEY=sk-...

# === Deployment (Slice 8 — Cloudflare Tunnel) ===
PUBLIC_HOSTNAME=gpcsk.example.com
```

- [ ] **Step 5: Create `.nvmrc`**

```
20.17.0
```

- [ ] **Step 6: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 7: Install root dev-dependencies**

Run: `pnpm install`
Expected: lockfile created at `pnpm-lock.yaml`, no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-workspace.yaml .editorconfig .env.example .nvmrc tsconfig.base.json pnpm-lock.yaml
git commit -m "feat(workspace): init pnpm monorepo with shared TS base"
```

---

### Task 2: Docker Compose — Postgres + pgvector

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    container_name: gpcsk-db
    environment:
      POSTGRES_USER: gpcsk
      POSTGRES_PASSWORD: gpcsk_dev
      POSTGRES_DB: gpcsk
    ports:
      - "5433:5432"
    volumes:
      - gpcsk-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U gpcsk -d gpcsk"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  gpcsk-pgdata:
```

- [ ] **Step 2: Bring the container up**

Run: `docker compose up -d db`
Expected: `[+] Running 1/1` then `Container gpcsk-db  Started`.

- [ ] **Step 3: Verify pgvector loads**

Run: `docker exec gpcsk-db psql -U gpcsk -d gpcsk -c "CREATE EXTENSION IF NOT EXISTS vector; SELECT extname FROM pg_extension WHERE extname='vector';"`
Expected: a single row `vector` printed; no error.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(infra): postgres 16 + pgvector via docker compose"
```

---

### Task 3: `packages/shared` — cross-app TS types

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/roles.ts`
- Create: `packages/shared/src/streams.ts`
- Create: `packages/shared/src/severity.ts`
- Create: `packages/shared/src/consent-types.ts`
- Create: `packages/shared/src/parameters.ts`

- [ ] **Step 1: `packages/shared/package.json`**

```json
{
  "name": "@gpcsk/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: `packages/shared/src/roles.ts`**

```ts
export const ROLES = [
  'CONSENT_OFFICER',
  'MONITORING_OFFICER',
  'INSPECTION_ENFORCEMENT_OFFICER',
  'COMPLAINTS_OFFICER',
  'SENIOR_REVIEWER',
] as const

export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, { en: string; gu: string }> = {
  CONSENT_OFFICER:                { en: 'Consent Officer',                gu: 'સંમતિ અધિકારી' },
  MONITORING_OFFICER:             { en: 'Monitoring Officer',             gu: 'દેખરેખ અધિકારી' },
  INSPECTION_ENFORCEMENT_OFFICER: { en: 'Inspection & Enforcement Officer', gu: 'નિરીક્ષણ અને અમલીકરણ અધિકારી' },
  COMPLAINTS_OFFICER:             { en: 'Complaints Officer',             gu: 'ફરિયાદ અધિકારી' },
  SENIOR_REVIEWER:                { en: 'Senior Reviewer',                gu: 'વરિષ્ઠ સમીક્ષક' },
}
```

- [ ] **Step 4: `packages/shared/src/streams.ts`**

```ts
export const STREAMS = ['AIR', 'WATER', 'HAZARDOUS_WASTE', 'NOISE_MSW'] as const
export type Stream = (typeof STREAMS)[number]

export const STREAM_LABELS: Record<Stream, { en: string; gu: string }> = {
  AIR:             { en: 'Air',                       gu: 'હવા' },
  WATER:           { en: 'Water',                     gu: 'પાણી' },
  HAZARDOUS_WASTE: { en: 'Hazardous Waste',           gu: 'જોખમી કચરો' },
  NOISE_MSW:       { en: 'Noise / Municipal Waste',   gu: 'અવાજ / મ્યુનિસિપલ કચરો' },
}
```

- [ ] **Step 5: `packages/shared/src/severity.ts`**

```ts
export const SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL'] as const
export type Severity = (typeof SEVERITIES)[number]

export const MAKER_CHECKER_STATES = [
  'DRAFT',
  'PENDING_REVIEW',
  'COMMITTED',
  'RETURNED_FOR_REVISION',
  'WITHDRAWN',
] as const
export type MakerCheckerState = (typeof MAKER_CHECKER_STATES)[number]
```

- [ ] **Step 6: `packages/shared/src/consent-types.ts`**

```ts
export const CONSENT_TYPES = ['CTE', 'CTO', 'HW_AUTH'] as const
export type ConsentType = (typeof CONSENT_TYPES)[number]

export const CONSENT_STATES = [
  'DRAFT',
  'UNDER_REVIEW',
  'RECOMMENDED',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'RENEWED',
] as const
export type ConsentState = (typeof CONSENT_STATES)[number]

export const INDUSTRY_CATEGORIES = ['RED', 'ORANGE', 'GREEN', 'WHITE'] as const
export type IndustryCategory = (typeof INDUSTRY_CATEGORIES)[number]
```

- [ ] **Step 7: `packages/shared/src/parameters.ts`**

```ts
export const AIR_PARAMETERS = [
  'PM10', 'PM2_5', 'SO2', 'NOx', 'NH3', 'O3', 'CO',
  'LEAD', 'ARSENIC', 'NICKEL', 'BENZENE', 'BENZO_A_PYRENE',
] as const
export type AirParameter = (typeof AIR_PARAMETERS)[number]

export const WATER_PARAMETERS = [
  'pH', 'DO', 'BOD', 'COD', 'SS', 'NH3_N',
  'PHENOLIC_COMPOUNDS', 'TURBIDITY', 'TDS', 'CONDUCTIVITY',
] as const
export type WaterParameter = (typeof WATER_PARAMETERS)[number]

export const VOC_PARAMETERS = [
  'METHANOL', 'ETHANOL', 'ACETONE', 'ISO_PROPYL_ALCOHOL',
  'METHYLENE_DI_CHLORIDE', 'BUTANOL', 'CHLOROFORM', 'CARBON_TETRA_CHLORIDE',
  'BENZENE', 'METHYL_ISOBUTYLKETONE', 'TOLUENE',
  'P_XYLENE', 'M_XYLENE', 'O_XYLENE',
  'ETHYL_METHYL_KETONE', 'BENZO_A_PYRENE',
] as const
export type VocParameter = (typeof VOC_PARAMETERS)[number]
```

- [ ] **Step 8: `packages/shared/src/index.ts`**

```ts
export * from './roles.js'
export * from './streams.js'
export * from './severity.js'
export * from './consent-types.js'
export * from './parameters.js'
```

- [ ] **Step 9: Install shared package**

Run: `pnpm install`
Expected: `@gpcsk/shared` linked into the workspace.

- [ ] **Step 10: Typecheck**

Run: `pnpm --filter @gpcsk/shared typecheck`
Expected: exit 0, no output.

- [ ] **Step 11: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): roles, streams, severity, consent, parameters enums"
```

---

### Task 4: `apps/api` scaffold — Express + TypeScript + Vitest

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/env.ts`
- Create: `apps/api/src/logger.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/vitest.config.ts`

- [ ] **Step 1: `apps/api/package.json`**

```json
{
  "name": "@gpcsk/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:reset": "prisma migrate reset --force"
  },
  "dependencies": {
    "@gpcsk/shared": "workspace:*",
    "@prisma/client": "5.22.0",
    "bcryptjs": "2.4.3",
    "cors": "2.8.5",
    "express": "4.21.1",
    "jsonwebtoken": "9.0.2",
    "pino": "9.5.0",
    "pino-http": "10.3.0",
    "zod": "3.23.8"
  },
  "devDependencies": {
    "@types/bcryptjs": "2.4.6",
    "@types/cors": "2.8.17",
    "@types/express": "5.0.0",
    "@types/jsonwebtoken": "9.0.7",
    "@types/supertest": "6.0.2",
    "prisma": "5.22.0",
    "supertest": "7.0.0",
    "tsx": "4.19.2",
    "typescript": "5.5.4",
    "vitest": "2.1.4"
  }
}
```

- [ ] **Step 2: `apps/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: `apps/api/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    pool: 'forks',
    testTimeout: 15000,
  },
})
```

- [ ] **Step 4: `apps/api/src/env.ts`**

```ts
import { z } from 'zod'

const Env = z.object({
  DATABASE_URL: z.string().url(),
  API_PORT: z.coerce.number().int().positive().default(8000),
  API_JWT_SECRET: z.string().min(16),
  API_JWT_TTL_HOURS: z.coerce.number().int().positive().default(24),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export const env = Env.parse(process.env)
export type Env = typeof env
```

- [ ] **Step 5: `apps/api/src/logger.ts`**

```ts
import pino from 'pino'
import { env } from './env.js'

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
      : undefined,
})
```

- [ ] **Step 6: `apps/api/src/app.ts`**

```ts
import express, { type Express } from 'express'
import cors from 'cors'
import pinoHttp from 'pino-http'
import { env } from './env.js'
import { logger } from './logger.js'

export function buildApp(): Express {
  const app = express()
  app.use(cors({ origin: env.CORS_ALLOWED_ORIGINS.split(',').map(s => s.trim()), credentials: true }))
  app.use(express.json({ limit: '2mb' }))
  app.use(pinoHttp({ logger }))

  app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }))

  return app
}
```

- [ ] **Step 7: `apps/api/src/index.ts`**

```ts
import { buildApp } from './app.js'
import { env } from './env.js'
import { logger } from './logger.js'

const app = buildApp()
app.listen(env.API_PORT, () => logger.info(`GPCSK API listening on :${env.API_PORT}`))
```

- [ ] **Step 8: Install api dependencies**

Run: `pnpm install`
Expected: `apps/api/node_modules/` populated, no peer-dep errors.

- [ ] **Step 9: Smoke-test the server boots**

Copy `.env.example` to project root `.env` first:
```bash
cp .env.example .env
```

Then run: `pnpm --filter @gpcsk/api dev`
Expected: `GPCSK API listening on :8000` within ~2 seconds.

In a second terminal, run: `curl -s http://localhost:8000/health | jq`
Expected: `{ "status": "ok", "ts": <number> }`

Stop the dev server with Ctrl-C.

- [ ] **Step 10: Commit**

```bash
git add apps/api .env
git restore --staged .env       # never commit .env
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): express scaffold with health endpoint, pino, zod env"
```

---

### Task 5: Prisma schema — full data model

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/db.ts`

- [ ] **Step 1: Write `apps/api/prisma/schema.prisma`**

```prisma
// Gujarat Pollution Control Samiksha Kendra — full data model.
// One model per entity in spec §7. Indexed for the access patterns each
// slice will exercise.

generator client {
  provider = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [vector]
}

// ── Enums ───────────────────────────────────────────────────────────────

enum Role {
  CONSENT_OFFICER
  MONITORING_OFFICER
  INSPECTION_ENFORCEMENT_OFFICER
  COMPLAINTS_OFFICER
  SENIOR_REVIEWER
}

enum Stream {
  AIR
  WATER
  HAZARDOUS_WASTE
  NOISE_MSW
}

enum IndustryCategory {
  RED
  ORANGE
  GREEN
  WHITE
}

enum ConsentType {
  CTE
  CTO
  HW_AUTH
}

enum ConsentState {
  DRAFT
  UNDER_REVIEW
  RECOMMENDED
  APPROVED
  REJECTED
  EXPIRED
  RENEWED
}

enum MakerCheckerState {
  DRAFT
  PENDING_REVIEW
  COMMITTED
  RETURNED_FOR_REVISION
  WITHDRAWN
}

enum ViolationSeverity {
  MINOR
  MAJOR
  CRITICAL
}

enum ViolationSource {
  SENSOR
  INSPECTION
  COMPLAINT
  AUDIT
}

enum DispositionState {
  PENDING
  CONFIRMED_VIOLATION
  SENSOR_GLITCH
  RESOLVED
}

enum MonitoringStationType {
  OCEMS
  CEQMS
  AAQM
  MINARS
  GEMS
  VOC
}

enum SensorValidity {
  VALID
  FLAGGED
  MISSING
}

enum EnforcementActionType {
  SHOW_CAUSE
  CLOSURE_DIRECTION
  BANK_GUARANTEE_INVOCATION
  RECOVERY
  SEALING
}

enum InspectionState {
  SCHEDULED
  COMPLETED
  CANCELLED
}

enum ComplaintChannel {
  WEB
  PHONE
  EMAIL
  WALK_IN
}

enum ComplaintState {
  NEW
  ASSIGNED
  IN_PROGRESS
  RESOLVED
  CLOSED
  DUPLICATE
}

enum NotificationCategory {
  EXCEEDANCE_CRITICAL
  EXCEEDANCE_PREDICTED
  COMPLAINT_ASSIGNED
  COMPLAINT_HOTSPOT_ALERT
  RENEWAL_DUE_30
  RENEWAL_DUE_60
  RENEWAL_DUE_90
  INSPECTION_DUE
  MAKER_CHECKER_PENDING
  NOTICE_COMMITTED
  ANOMALY_FLAG
  FESTIVAL_PLANNER_REMINDER
  BROADCAST
  GENERAL
}

enum NotificationPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum KnowledgeSourceType {
  ACT
  RULE
  SOP
  ANNUAL_REPORT
  CPCB_NORM
  CETP_REPORT
  FESTIVAL_MONITORING
  FAQ
}

// ── Identity ────────────────────────────────────────────────────────────

model User {
  id          String   @id @default(cuid())
  role        Role
  xgnId       String?  @unique
  phone       String   @unique
  name        String
  email       String?  @unique
  designation String?
  region      String?
  profile     Json     @default("{}")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  auditEvents              AuditLog[]
  draftedConsentApps       ConsentApplication[] @relation("ConsentMaker")
  reviewedConsentApps      ConsentApplication[] @relation("ConsentChecker")
  inspectionsLed           Inspection[]
  draftedEnforcement       EnforcementAction[]  @relation("EnforcementMaker")
  reviewedEnforcement      EnforcementAction[]  @relation("EnforcementChecker")
  assignedComplaints       Complaint[]
  complaintResponses       ComplaintResponse[]
  exceedanceDispositions   Exceedance[]
  chatThreads              ChatThread[]
  notifications            Notification[]
  broadcastsSent           Broadcast[]

  @@index([role])
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  issuedAt  DateTime @default(now())
  expiresAt DateTime
  revokedAt DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model AuditLog {
  id        String   @id @default(cuid())
  actorId   String
  entity    String
  entityId  String
  action    String
  before    Json?
  after     Json?
  reason    String?
  createdAt DateTime @default(now())

  actor User @relation(fields: [actorId], references: [id], onDelete: Restrict)

  @@index([entity, entityId])
  @@index([actorId, createdAt])
}

// ── Reference data ──────────────────────────────────────────────────────

model Sector {
  id   String @id @default(cuid())
  code String @unique
  name String

  industries Industry[]
}

model District {
  id   String @id @default(cuid())
  code String @unique
  name String

  talukas    Taluka[]
  industries Industry[]
}

model Taluka {
  id         String @id @default(cuid())
  name       String
  districtId String

  district   District   @relation(fields: [districtId], references: [id], onDelete: Cascade)
  industries Industry[]

  @@index([districtId])
}

model GidcZone {
  id         String  @id @default(cuid())
  name       String
  districtId String?

  industries Industry[]
}

model Norm {
  id         String @id @default(cuid())
  parameter  String
  stream     Stream
  category   String?
  value      Float
  unit       String
  regulator  String
  source     String

  @@unique([parameter, stream, category, regulator])
}

// ── Industry & regulatory workflow ─────────────────────────────────────

model Industry {
  id                  String           @id @default(cuid())
  name                String
  ucNumber            String           @unique
  category            IndustryCategory
  sectorId            String?
  districtId          String?
  talukaId            String?
  gidcZoneId          String?
  lat                 Float?
  lng                 Float?
  capacity            Json             @default("{}")
  classificationScheme String?
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt

  sector       Sector?              @relation(fields: [sectorId],     references: [id], onDelete: SetNull)
  district     District?            @relation(fields: [districtId],   references: [id], onDelete: SetNull)
  taluka       Taluka?              @relation(fields: [talukaId],     references: [id], onDelete: SetNull)
  gidcZone     GidcZone?            @relation(fields: [gidcZoneId],   references: [id], onDelete: SetNull)
  consents     ConsentApplication[]
  inspections  Inspection[]
  violations   Violation[]
  enforcement  EnforcementAction[]
  complaints   Complaint[]
  stations     MonitoringStation[]

  @@index([category])
  @@index([districtId, talukaId])
  @@index([gidcZoneId])
}

model ConsentApplication {
  id            String       @id @default(cuid())
  industryId    String
  type          ConsentType
  submittedAt   DateTime     @default(now())
  validityFrom  DateTime?
  validityTo    DateTime?
  state         ConsentState @default(DRAFT)
  parameters    Json         @default("{}")
  feeStatus     String?
  makerId       String?
  checkerId     String?
  reviewerNotes String?
  letterFileUrl String?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  industry Industry @relation(fields: [industryId], references: [id], onDelete: Cascade)
  maker    User?    @relation("ConsentMaker",   fields: [makerId],   references: [id], onDelete: SetNull)
  checker  User?    @relation("ConsentChecker", fields: [checkerId], references: [id], onDelete: SetNull)

  @@index([industryId])
  @@index([type, state])
  @@index([validityTo])
}

model Inspection {
  id            String          @id @default(cuid())
  industryId    String
  scheduledAt   DateTime
  inspectorId   String?
  completedAt   DateTime?
  state         InspectionState @default(SCHEDULED)
  observations  Json            @default("{}")
  photos        Json            @default("[]")
  nextDueAt     DateTime?
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  industry   Industry    @relation(fields: [industryId],  references: [id], onDelete: Cascade)
  inspector  User?       @relation(fields: [inspectorId], references: [id], onDelete: SetNull)
  violations Violation[]

  @@index([industryId])
  @@index([state, scheduledAt])
}

model Violation {
  id               String            @id @default(cuid())
  industryId       String
  inspectionId     String?
  source           ViolationSource
  parameter        String
  observedValue    Float?
  normValue        Float?
  unit             String?
  severity         ViolationSeverity
  detectedAt       DateTime          @default(now())
  dispositionState DispositionState  @default(PENDING)
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  industry   Industry    @relation(fields: [industryId],   references: [id], onDelete: Cascade)
  inspection Inspection? @relation(fields: [inspectionId], references: [id], onDelete: SetNull)

  @@index([industryId, detectedAt])
  @@index([severity, dispositionState])
}

// ── Monitoring streams ─────────────────────────────────────────────────

model MonitoringStation {
  id         String                @id @default(cuid())
  type       MonitoringStationType
  industryId String?
  name       String
  lat        Float?
  lng        Float?
  parameters String[]
  status     String                @default("active")
  createdAt  DateTime              @default(now())
  updatedAt  DateTime              @updatedAt

  industry    Industry?       @relation(fields: [industryId], references: [id], onDelete: SetNull)
  readings    SensorReading[]
  exceedances Exceedance[]
  labSamples  LabSample[]

  @@index([type])
  @@index([industryId])
}

model SensorReading {
  id        String         @id @default(cuid())
  stationId String
  parameter String
  value     Float
  unit      String
  timestamp DateTime
  validity  SensorValidity @default(VALID)

  station     MonitoringStation @relation(fields: [stationId], references: [id], onDelete: Cascade)
  exceedances Exceedance[]

  @@index([stationId, parameter, timestamp])
}

model Exceedance {
  id                  String           @id @default(cuid())
  stationId           String
  readingId           String?
  parameter           String
  observedValue       Float
  normValue           Float
  breachMagnitude     Float
  severity            ViolationSeverity
  detectedAt          DateTime         @default(now())
  dispositionState    DispositionState @default(PENDING)
  dispositionActorId  String?
  dispositionAt       DateTime?
  dispositionNotes    String?

  station          MonitoringStation @relation(fields: [stationId],          references: [id], onDelete: Cascade)
  reading          SensorReading?    @relation(fields: [readingId],          references: [id], onDelete: SetNull)
  dispositionActor User?             @relation(fields: [dispositionActorId], references: [id], onDelete: SetNull)

  @@index([stationId, detectedAt])
  @@index([dispositionState, severity])
}

model LabSample {
  id            String   @id @default(cuid())
  stationId     String?
  industryId    String?
  collectedAt   DateTime
  parameters    Json     @default("{}")
  reportFileUrl String?
  createdAt     DateTime @default(now())

  station MonitoringStation? @relation(fields: [stationId], references: [id], onDelete: SetNull)
  industry Industry?         @relation(fields: [industryId], references: [id], onDelete: SetNull, map: "LabSample_industry_fk")

  @@index([stationId, collectedAt])
}

// ── CETP ────────────────────────────────────────────────────────────────

model Cetp {
  id                String  @id @default(cuid())
  name              String
  capacityMld       Float
  district          String?
  memberUnitsCount  Int?
  hasOnlineCeqms    Boolean @default(false)
  spraydryerUnits   Int?

  reports CetpMonitoringReport[]
}

model CetpMonitoringReport {
  id                       String   @id @default(cuid())
  cetpId                   String
  monthOf                  DateTime
  inletNorms               Json
  finalEffluentStds        Json
  observedInlet            Json
  observedFinal            Json
  bypassMld                Float?
  hazardousWasteStorageMt  Float?
  hazardousWasteDisposedMt Float?
  reportFileUrl            String?
  createdAt                DateTime @default(now())

  cetp Cetp @relation(fields: [cetpId], references: [id], onDelete: Cascade)

  @@index([cetpId, monthOf])
}

// ── Enforcement ────────────────────────────────────────────────────────

model EnforcementAction {
  id              String                @id @default(cuid())
  industryId      String
  type            EnforcementActionType
  draftedById     String
  draftedAt       DateTime              @default(now())
  evidence        Json                  @default("{}")
  violationIds    String[]
  state           MakerCheckerState     @default(DRAFT)
  reviewedById    String?
  reviewedAt      DateTime?
  reviewerNotes   String?
  letterFileUrl   String?
  deliveryChannel String?
  deliveryStatus  String?
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt

  industry  Industry @relation(fields: [industryId],   references: [id], onDelete: Cascade)
  draftedBy User     @relation("EnforcementMaker",   fields: [draftedById], references: [id], onDelete: Restrict)
  reviewedBy User?   @relation("EnforcementChecker", fields: [reviewedById], references: [id], onDelete: SetNull)

  @@index([industryId])
  @@index([state, draftedAt])
}

// ── Citizen complaints ─────────────────────────────────────────────────

model Complaint {
  id           String           @id @default(cuid())
  channel      ComplaintChannel
  receivedAt   DateTime         @default(now())
  complainant  Json
  lat          Float?
  lng          Float?
  category     String?
  severity     ViolationSeverity @default(MINOR)
  description  String
  attachments  Json             @default("[]")
  industryId   String?
  state        ComplaintState   @default(NEW)
  assignedToId String?
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  industry   Industry?         @relation(fields: [industryId], references: [id], onDelete: SetNull)
  assignedTo User?             @relation(fields: [assignedToId], references: [id], onDelete: SetNull)
  responses  ComplaintResponse[]

  @@index([state, receivedAt])
  @@index([industryId])
}

model ComplaintResponse {
  id            String   @id @default(cuid())
  complaintId   String
  respondedById String
  respondedAt   DateTime @default(now())
  message       String
  action        String?

  complaint   Complaint @relation(fields: [complaintId],   references: [id], onDelete: Cascade)
  respondedBy User      @relation(fields: [respondedById], references: [id], onDelete: Restrict)

  @@index([complaintId])
}

// ── AI / chat / RAG ────────────────────────────────────────────────────

model ChatThread {
  id            String   @id @default(cuid())
  userId        String
  title         String?
  createdAt     DateTime @default(now())
  lastMessageAt DateTime @default(now())

  user     User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages ChatMessage[]

  @@index([userId, lastMessageAt])
}

model ChatMessage {
  id        String   @id @default(cuid())
  threadId  String
  role      String   // "user" | "assistant" | "system"
  content   String
  toolCalls Json     @default("[]")
  createdAt DateTime @default(now())

  thread ChatThread @relation(fields: [threadId], references: [id], onDelete: Cascade)

  @@index([threadId, createdAt])
}

model KnowledgeDocument {
  id         String              @id @default(cuid())
  title      String
  sourceType KnowledgeSourceType
  tags       String[]
  fileUrl    String?
  createdAt  DateTime            @default(now())

  chunks KnowledgeChunk[]
}

model KnowledgeChunk {
  id         String                       @id @default(cuid())
  documentId String
  chunkText  String
  // Vector column added via raw SQL in migration — Prisma cannot represent
  // pgvector natively yet. Embedding ops happen in raw queries (slice 7).

  document KnowledgeDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId])
}

// ── Notifications & broadcasts ─────────────────────────────────────────

model Notification {
  id        String               @id @default(cuid())
  userId    String
  category  NotificationCategory
  priority  NotificationPriority @default(MEDIUM)
  payload   Json                 @default("{}")
  readAt    DateTime?
  createdAt DateTime             @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, readAt])
}

model Broadcast {
  id        String   @id @default(cuid())
  sentById  String
  audience  Json     // { roles?: Role[], regions?: string[] }
  title     String
  body      String
  sentAt    DateTime @default(now())

  sentBy User @relation(fields: [sentById], references: [id], onDelete: Restrict)

  @@index([sentAt])
}
```

- [ ] **Step 2: Create `apps/api/src/db.ts`**

```ts
import { PrismaClient } from '@prisma/client'
import { env } from './env.js'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (env.NODE_ENV !== 'production') globalThis.__prisma = prisma
```

- [ ] **Step 3: Generate the Prisma client**

Run: `pnpm --filter @gpcsk/api exec prisma generate`
Expected: `✔ Generated Prisma Client (5.22.0) to ./node_modules/@prisma/client`.

- [ ] **Step 4: Create the initial migration**

Run: `pnpm --filter @gpcsk/api exec prisma migrate dev --name init`
Expected: migration applied, files written under `apps/api/prisma/migrations/<timestamp>_init/`.

- [ ] **Step 5: Add the pgvector column via raw SQL migration**

Run: `pnpm --filter @gpcsk/api exec prisma migrate dev --name knowledge_chunk_embedding --create-only`

Then open the newly created migration file and replace its contents with:

```sql
-- Add 1536-dim pgvector column to KnowledgeChunk (text-embedding-3-small)
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "KnowledgeChunk"
  ADD COLUMN "embedding" vector(1536);

CREATE INDEX "KnowledgeChunk_embedding_idx"
  ON "KnowledgeChunk"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

Then apply it:

Run: `pnpm --filter @gpcsk/api exec prisma migrate dev`
Expected: migration applied, no error.

- [ ] **Step 6: Verify the schema in the DB**

Run: `docker exec gpcsk-db psql -U gpcsk -d gpcsk -c "\dt"`
Expected: `User`, `Industry`, `ConsentApplication`, `MonitoringStation`, `SensorReading`, `Cetp`, `EnforcementAction`, `Complaint`, `ChatThread`, `KnowledgeChunk`, `Notification`, etc. all listed.

Run: `docker exec gpcsk-db psql -U gpcsk -d gpcsk -c "\d \"KnowledgeChunk\""`
Expected: an `embedding` column of type `vector(1536)`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma apps/api/src/db.ts
git commit -m "feat(api): prisma schema + initial migration + pgvector embedding column"
```

---

### Task 6: JWT utilities (TDD)

**Files:**
- Create: `apps/api/src/auth/jwt.ts`
- Create: `apps/api/src/auth/jwt.test.ts`

- [ ] **Step 1: Write the failing test `apps/api/src/auth/jwt.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { signToken, verifyToken } from './jwt.js'

const SECRET = 'test-secret-at-least-sixteen-bytes'

describe('jwt', () => {
  it('signs and verifies a token round-trip', () => {
    const token = signToken({ sub: 'user_123', role: 'SENIOR_REVIEWER' }, { secret: SECRET, ttlHours: 1 })
    const decoded = verifyToken(token, SECRET)
    expect(decoded.sub).toBe('user_123')
    expect(decoded.role).toBe('SENIOR_REVIEWER')
  })

  it('rejects a token signed with a different secret', () => {
    const token = signToken({ sub: 'u', role: 'CONSENT_OFFICER' }, { secret: SECRET, ttlHours: 1 })
    expect(() => verifyToken(token, 'other-secret-bytes-here-32')).toThrow()
  })

  it('rejects an expired token', () => {
    const token = signToken({ sub: 'u', role: 'CONSENT_OFFICER' }, { secret: SECRET, ttlHours: -1 })
    expect(() => verifyToken(token, SECRET)).toThrow()
  })
})
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `pnpm --filter @gpcsk/api test src/auth/jwt.test.ts`
Expected: error "Cannot find module './jwt.js'".

- [ ] **Step 3: Implement `apps/api/src/auth/jwt.ts`**

```ts
import jwt from 'jsonwebtoken'
import type { Role } from '@gpcsk/shared'

export interface TokenPayload {
  sub: string
  role: Role
}

export interface SignOptions {
  secret: string
  ttlHours: number
}

export function signToken(payload: TokenPayload, opts: SignOptions): string {
  return jwt.sign(payload, opts.secret, {
    expiresIn: `${opts.ttlHours}h`,
    algorithm: 'HS256',
  })
}

export function verifyToken(token: string, secret: string): TokenPayload {
  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as jwt.JwtPayload
  if (typeof decoded.sub !== 'string' || typeof decoded.role !== 'string') {
    throw new Error('invalid_token_payload')
  }
  return { sub: decoded.sub, role: decoded.role as Role }
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `pnpm --filter @gpcsk/api test src/auth/jwt.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/jwt.ts apps/api/src/auth/jwt.test.ts
git commit -m "feat(api): jwt sign/verify utilities with TDD"
```

---

### Task 7: OTP validator (TDD)

**Files:**
- Create: `apps/api/src/auth/otp.ts`
- Create: `apps/api/src/auth/otp.test.ts`

- [ ] **Step 1: Write the failing test `apps/api/src/auth/otp.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { isValidDemoOtp } from './otp.js'

describe('isValidDemoOtp', () => {
  it.each(['1234', '123456'])('accepts %s', (otp) => {
    expect(isValidDemoOtp(otp)).toBe(true)
  })

  it.each(['0000', '12345', 'abcd', '', '1234 '])('rejects %s', (otp) => {
    expect(isValidDemoOtp(otp)).toBe(false)
  })
})
```

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm --filter @gpcsk/api test src/auth/otp.test.ts`
Expected: failure — module not found.

- [ ] **Step 3: Implement `apps/api/src/auth/otp.ts`**

```ts
const VALID = new Set(['1234', '123456'])

export function isValidDemoOtp(otp: string): boolean {
  return VALID.has(otp)
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `pnpm --filter @gpcsk/api test src/auth/otp.test.ts`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/otp.ts apps/api/src/auth/otp.test.ts
git commit -m "feat(api): demo OTP validator"
```

---

### Task 8: Auth router — phone OTP + mock XGN SSO + demo role pick (TDD)

**Files:**
- Create: `apps/api/src/auth/router.ts`
- Create: `apps/api/src/auth/router.test.ts`
- Create: `apps/api/src/seed/users.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Create `apps/api/src/seed/users.ts`**

```ts
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
```

- [ ] **Step 2: Write the failing test `apps/api/src/auth/router.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { buildApp } from '../app.js'
import { prisma } from '../db.js'
import { seedDemoUsers } from '../seed/users.js'

const app = buildApp()

beforeAll(async () => {
  await seedDemoUsers(prisma)
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('POST /api/auth/phone/request-otp', () => {
  it('returns ok for a known demo phone', async () => {
    const res = await request(app).post('/api/auth/phone/request-otp').send({ phone: '9000000001' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'sent' })
  })

  it('returns ok even for an unknown phone (no enumeration)', async () => {
    const res = await request(app).post('/api/auth/phone/request-otp').send({ phone: '9999999999' })
    expect(res.status).toBe(200)
  })

  it('rejects malformed phone', async () => {
    const res = await request(app).post('/api/auth/phone/request-otp').send({ phone: 'abc' })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/phone/verify-otp', () => {
  it('issues a JWT for valid phone + OTP', async () => {
    const res = await request(app).post('/api/auth/phone/verify-otp').send({ phone: '9000000005', otp: '1234' })
    expect(res.status).toBe(200)
    expect(res.body.token).toMatch(/^eyJ/)
    expect(res.body.user.role).toBe('SENIOR_REVIEWER')
  })

  it('rejects an invalid OTP', async () => {
    const res = await request(app).post('/api/auth/phone/verify-otp').send({ phone: '9000000005', otp: '0000' })
    expect(res.status).toBe(401)
  })

  it('rejects an unknown phone', async () => {
    const res = await request(app).post('/api/auth/phone/verify-otp').send({ phone: '9999999999', otp: '1234' })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/auth/xgn/callback (mock SSO)', () => {
  it('issues a JWT for a known xgnId', async () => {
    const res = await request(app).post('/api/auth/xgn/callback').send({ xgnId: 'XGN-MO-001' })
    expect(res.status).toBe(200)
    expect(res.body.token).toMatch(/^eyJ/)
    expect(res.body.user.role).toBe('MONITORING_OFFICER')
  })

  it('rejects an unknown xgnId', async () => {
    const res = await request(app).post('/api/auth/xgn/callback').send({ xgnId: 'XGN-UNKNOWN' })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/auth/demo-login', () => {
  it('issues a JWT for a known role (development only)', async () => {
    const res = await request(app).post('/api/auth/demo-login').send({ role: 'CONSENT_OFFICER' })
    expect(res.status).toBe(200)
    expect(res.body.user.role).toBe('CONSENT_OFFICER')
  })

  it('rejects an unknown role', async () => {
    const res = await request(app).post('/api/auth/demo-login').send({ role: 'GHOST_ROLE' })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 3: Run the test, confirm failure**

Run: `pnpm --filter @gpcsk/api test src/auth/router.test.ts`
Expected: 404s on all routes (router not mounted yet).

- [ ] **Step 4: Implement `apps/api/src/auth/router.ts`**

```ts
import { Router } from 'express'
import { z } from 'zod'
import { ROLES, type Role } from '@gpcsk/shared'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { isValidDemoOtp } from './otp.js'
import { signToken } from './jwt.js'

const PhoneRequestSchema = z.object({ phone: z.string().regex(/^\d{10}$/) })
const PhoneVerifySchema  = z.object({ phone: z.string().regex(/^\d{10}$/), otp: z.string() })
const XgnCallbackSchema  = z.object({ xgnId: z.string().min(3) })
const DemoLoginSchema    = z.object({ role: z.enum(ROLES) })

export const authRouter = Router()

function issue(userId: string, role: Role): string {
  return signToken({ sub: userId, role }, { secret: env.API_JWT_SECRET, ttlHours: env.API_JWT_TTL_HOURS })
}

authRouter.post('/phone/request-otp', (req, res) => {
  const parsed = PhoneRequestSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_phone' })
  // Demo: always 'sent'. Real SMS rail deferred to v2.
  return res.json({ status: 'sent' })
})

authRouter.post('/phone/verify-otp', async (req, res) => {
  const parsed = PhoneVerifySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' })
  if (!isValidDemoOtp(parsed.data.otp)) return res.status(401).json({ error: 'invalid_otp' })
  const user = await prisma.user.findUnique({ where: { phone: parsed.data.phone } })
  if (!user) return res.status(404).json({ error: 'user_not_found' })
  return res.json({ token: issue(user.id, user.role), user: { id: user.id, name: user.name, role: user.role, region: user.region } })
})

authRouter.post('/xgn/callback', async (req, res) => {
  const parsed = XgnCallbackSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' })
  const user = await prisma.user.findUnique({ where: { xgnId: parsed.data.xgnId } })
  if (!user) return res.status(404).json({ error: 'user_not_found' })
  return res.json({ token: issue(user.id, user.role), user: { id: user.id, name: user.name, role: user.role, region: user.region } })
})

authRouter.post('/demo-login', async (req, res) => {
  if (env.NODE_ENV === 'production') return res.status(404).json({ error: 'not_found' })
  const parsed = DemoLoginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_role' })
  const user = await prisma.user.findFirst({ where: { role: parsed.data.role } })
  if (!user) return res.status(404).json({ error: 'no_user_for_role' })
  return res.json({ token: issue(user.id, user.role), user: { id: user.id, name: user.name, role: user.role, region: user.region } })
})
```

- [ ] **Step 5: Mount the router in `apps/api/src/app.ts`**

Replace the file contents with:

```ts
import express, { type Express } from 'express'
import cors from 'cors'
import pinoHttp from 'pino-http'
import { env } from './env.js'
import { logger } from './logger.js'
import { authRouter } from './auth/router.js'

export function buildApp(): Express {
  const app = express()
  app.use(cors({ origin: env.CORS_ALLOWED_ORIGINS.split(',').map(s => s.trim()), credentials: true }))
  app.use(express.json({ limit: '2mb' }))
  app.use(pinoHttp({ logger }))

  app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }))
  app.use('/api/auth', authRouter)

  return app
}
```

- [ ] **Step 6: Run the test, confirm pass**

Run: `pnpm --filter @gpcsk/api test src/auth/router.test.ts`
Expected: 11 passed.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/auth/router.ts apps/api/src/auth/router.test.ts apps/api/src/app.ts apps/api/src/seed/users.ts
git commit -m "feat(api): auth router — phone OTP, mock XGN SSO, demo-login + demo users seed"
```

---

### Task 9: Auth middleware + `/api/me` endpoint (TDD)

**Files:**
- Create: `apps/api/src/auth/middleware.ts`
- Create: `apps/api/src/users/router.ts`
- Create: `apps/api/src/users/router.test.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Write the failing test `apps/api/src/users/router.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { buildApp } from '../app.js'
import { prisma } from '../db.js'
import { seedDemoUsers } from '../seed/users.js'
import { signToken } from '../auth/jwt.js'
import { env } from '../env.js'

const app = buildApp()

let token = ''
let userId = ''

beforeAll(async () => {
  await seedDemoUsers(prisma)
  const u = await prisma.user.findUnique({ where: { phone: '9000000001' } })
  if (!u) throw new Error('seed missing')
  userId = u.id
  token = signToken({ sub: u.id, role: u.role }, { secret: env.API_JWT_SECRET, ttlHours: 1 })
})

afterAll(async () => prisma.$disconnect())

describe('GET /api/me', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/me')
    expect(res.status).toBe(401)
  })

  it('returns the current user with a valid token', async () => {
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(userId)
    expect(res.body.role).toBe('CONSENT_OFFICER')
  })

  it('returns 401 with a malformed token', async () => {
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer garbage')
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm --filter @gpcsk/api test src/users/router.test.ts`
Expected: 404 on the route.

- [ ] **Step 3: Implement `apps/api/src/auth/middleware.ts`**

```ts
import type { Request, Response, NextFunction } from 'express'
import { ROLES, type Role } from '@gpcsk/shared'
import { verifyToken, type TokenPayload } from './jwt.js'
import { env } from '../env.js'

declare module 'express-serve-static-core' {
  interface Request {
    auth?: TokenPayload
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? ''
  const match = /^Bearer (.+)$/.exec(header)
  if (!match) {
    res.status(401).json({ error: 'missing_token' })
    return
  }
  try {
    const payload = verifyToken(match[1]!, env.API_JWT_SECRET)
    if (!ROLES.includes(payload.role)) {
      res.status(401).json({ error: 'invalid_role' })
      return
    }
    req.auth = payload
    next()
  } catch {
    res.status(401).json({ error: 'invalid_token' })
  }
}

export function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'unauthenticated' })
      return
    }
    if (!allowed.includes(req.auth.role)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    next()
  }
}
```

- [ ] **Step 4: Implement `apps/api/src/users/router.ts`**

```ts
import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../auth/middleware.js'

export const usersRouter = Router()

usersRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } })
  if (!user) return res.status(404).json({ error: 'user_not_found' })
  return res.json({
    id: user.id, name: user.name, role: user.role, designation: user.designation, region: user.region, phone: user.phone,
  })
})
```

- [ ] **Step 5: Mount in `apps/api/src/app.ts`**

Add the import and the `app.use` line:

```ts
import { usersRouter } from './users/router.js'
// ... inside buildApp() after authRouter mount:
app.use('/api', usersRouter)
```

- [ ] **Step 6: Run, confirm pass**

Run: `pnpm --filter @gpcsk/api test src/users/router.test.ts`
Expected: 3 passed.

- [ ] **Step 7: Run all api tests**

Run: `pnpm --filter @gpcsk/api test`
Expected: all green, no warnings.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/auth/middleware.ts apps/api/src/users apps/api/src/app.ts
git commit -m "feat(api): requireAuth/requireRole middleware + /api/me endpoint"
```

---

### Task 10: AuditLog service (TDD)

**Files:**
- Create: `apps/api/src/audit/service.ts`
- Create: `apps/api/src/audit/service.test.ts`

- [ ] **Step 1: Write the failing test `apps/api/src/audit/service.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../db.js'
import { seedDemoUsers } from '../seed/users.js'
import { writeAudit } from './service.js'

beforeAll(async () => {
  await seedDemoUsers(prisma)
})

afterAll(async () => prisma.$disconnect())

describe('writeAudit', () => {
  it('persists an audit row with before/after JSON', async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { role: 'SENIOR_REVIEWER' } })
    const row = await writeAudit({
      actorId: user.id,
      entity: 'ConsentApplication',
      entityId: 'cons_test_1',
      action: 'APPROVED',
      before: { state: 'PENDING_REVIEW' },
      after:  { state: 'COMMITTED' },
      reason: 'docs in order',
    })
    expect(row.id).toBeTruthy()
    const persisted = await prisma.auditLog.findUniqueOrThrow({ where: { id: row.id } })
    expect(persisted.action).toBe('APPROVED')
    expect((persisted.after as { state: string }).state).toBe('COMMITTED')
  })
})
```

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm --filter @gpcsk/api test src/audit/service.test.ts`
Expected: module not found.

- [ ] **Step 3: Implement `apps/api/src/audit/service.ts`**

```ts
import { prisma } from '../db.js'
import type { Prisma } from '@prisma/client'

export interface AuditInput {
  actorId: string
  entity: string
  entityId: string
  action: string
  before?: Prisma.InputJsonValue
  after?: Prisma.InputJsonValue
  reason?: string
}

export async function writeAudit(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      actorId:  input.actorId,
      entity:   input.entity,
      entityId: input.entityId,
      action:   input.action,
      before:   input.before ?? Prisma.JsonNull,
      after:    input.after  ?? Prisma.JsonNull,
      reason:   input.reason,
    },
  })
}
```

(NB: `Prisma.JsonNull` import — fix the import at the top of the file:)

```ts
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
```

- [ ] **Step 4: Run, confirm pass**

Run: `pnpm --filter @gpcsk/api test src/audit/service.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/audit
git commit -m "feat(api): writeAudit service with JSON before/after diff"
```

---

### Task 11: API seed runner CLI

**Files:**
- Create: `apps/api/src/seed/index.ts`
- Modify: `apps/api/package.json`

- [ ] **Step 1: Create `apps/api/src/seed/index.ts`**

```ts
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
```

- [ ] **Step 2: Add `db:seed` script to `apps/api/package.json`**

Add to the `scripts` block:

```json
"db:seed": "tsx src/seed/index.ts"
```

- [ ] **Step 3: Run the seed**

Run: `pnpm --filter @gpcsk/api run db:seed`
Expected: `seeding demo users…` then `done. users now: 5`.

- [ ] **Step 4: Verify in psql**

Run: `docker exec gpcsk-db psql -U gpcsk -d gpcsk -c "SELECT role, name FROM \"User\" ORDER BY role;"`
Expected: 5 rows — one per role.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/seed/index.ts apps/api/package.json
git commit -m "feat(api): db:seed CLI for demo users"
```

---

### Task 12: `apps/web` scaffold — Vite + React + Tailwind cloned from KSK

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tsconfig.node.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/index.css`
- Create: `apps/web/src/vite-env.d.ts`

- [ ] **Step 1: `apps/web/package.json`**

```json
{
  "name": "@gpcsk/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview --port 3000",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@gpcsk/shared": "workspace:*",
    "i18next": "23.16.4",
    "lucide-react": "0.454.0",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "react-i18next": "15.1.1",
    "recharts": "2.13.3"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "6.6.3",
    "@testing-library/react": "16.0.1",
    "@types/react": "18.3.12",
    "@types/react-dom": "18.3.1",
    "@vitejs/plugin-react": "4.3.3",
    "autoprefixer": "10.4.20",
    "jsdom": "25.0.1",
    "postcss": "8.4.49",
    "tailwindcss": "3.4.14",
    "typescript": "5.5.4",
    "vite": "5.4.10",
    "vitest": "2.1.4"
  }
}
```

- [ ] **Step 2: `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "noEmit": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: `apps/web/tsconfig.node.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "noEmit": false,
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: `apps/web/vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, host: '127.0.0.1' },
  preview: { port: 3000, host: '127.0.0.1' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
```

- [ ] **Step 5: `apps/web/postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 6: `apps/web/tailwind.config.ts` (cloned 1:1 from KSK with Gujarati font added)**

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'Inter', 'Noto Sans Gujarati', 'Noto Sans Devanagari', 'system-ui', 'sans-serif'],
        native: ['Noto Sans Gujarati', 'Noto Sans Devanagari', 'Noto Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#386AF6', dark: '#2755E3', light: '#EEF2FF', 50: '#F4F6FA',
        },
        surface: { DEFAULT: '#FFFFFF', secondary: '#F5F7FA', chat: '#F0F4FF', page: '#F4F6FA' },
        txt:     { primary: '#1A1F36', secondary: '#7383A5', tertiary: '#B8C0CC' },
        bdr:     { DEFAULT: '#CFD8E6', light: '#E2E8F0', strong: '#B5C2D5' },
        ok:      { DEFAULT: '#4CAF50', light: '#E8F5E9' },
        warn:    { DEFAULT: '#FFB300', light: '#FFF8E1' },
        danger:  { DEFAULT: '#E53935', light: '#FFEBEE' },
        flag:    { DEFAULT: '#7C3AED', light: '#EDE9FE' },
      },
      borderRadius: { pill: '50px', card: '16px', xl: '12px' },
      boxShadow: {
        card:   '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
        modal:  '0 4px 14px rgba(56, 106, 246, 0.18)',
        bottom: '0 -4px 24px rgba(56, 106, 246, 0.10)',
        canvas: '-8px 0 30px rgba(15, 23, 42, 0.10)',
      },
      keyframes: {
        'slide-in':    { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        'fade-in':     { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'bubble-in':   { '0%': { transform: 'translateY(4px) scale(0.98)', opacity: '0' }, '100%': { transform: 'translateY(0) scale(1)', opacity: '1' } },
        'canvas-slide':{ '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } },
        'typing':      { '0%, 60%, 100%': { opacity: '0.3' }, '30%': { opacity: '1' } },
        'pulse-ring':  { '0%': { transform: 'scale(0.95)', opacity: '0.7' }, '100%': { transform: 'scale(1.6)', opacity: '0' } },
      },
      animation: {
        'slide-in':     'slide-in 240ms ease-out',
        'fade-in':      'fade-in 200ms ease-out',
        'bubble-in':    'bubble-in 200ms ease-out',
        'canvas-slide': 'canvas-slide 300ms ease-out',
        'typing':       'typing 1.2s infinite',
        'pulse-ring':   'pulse-ring 1.6s ease-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 7: `apps/web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Gujarat Pollution Control Samiksha Kendra</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@400;500;600;700&family=Noto+Sans+Gujarati:wght@400;500;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: `apps/web/src/index.css` (cloned 1:1 from KSK with Gujarati typography)**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { font-family: 'Inter', 'Noto Sans Gujarati', 'Noto Sans Devanagari', system-ui, sans-serif; }

/* Scrollbar — subtle */
*::-webkit-scrollbar { width: 8px; height: 8px; }
*::-webkit-scrollbar-thumb { background: rgba(15, 23, 42, 0.18); border-radius: 8px; }
*::-webkit-scrollbar-track { background: transparent; }

.tricolor-strip { background: linear-gradient(to right, #FF9933 33%, #FFFFFF 33% 66%, #138808 66%); height: 4px; }

.badge { @apply inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-xs font-medium; }
.badge-ok    { @apply bg-ok-light text-ok; }
.badge-warn  { @apply bg-warn-light text-warn; }
.badge-danger{ @apply bg-danger-light text-danger; }
.badge-flag  { @apply bg-flag-light text-flag; }
.badge-info  { @apply bg-primary-light text-primary; }

.chat-bubble-user { @apply bg-primary text-white rounded-2xl rounded-br-md px-3 py-2 max-w-[80%] self-end animate-bubble-in; }
.chat-bubble-bot  { @apply bg-slate-100 text-txt-primary rounded-2xl rounded-bl-md px-3 py-2 max-w-[85%] self-start animate-bubble-in; }
.chip { @apply inline-flex items-center px-3 py-1.5 rounded-pill bg-primary-light text-primary text-sm font-medium border border-bdr-light hover:bg-primary-50 cursor-pointer; }
```

- [ ] **Step 9: `apps/web/src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.js'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 10: `apps/web/src/App.tsx` (placeholder until later tasks)**

```tsx
export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-page text-txt-primary">
      <div className="text-center">
        <div className="tricolor-strip mb-8 w-48 mx-auto rounded" />
        <h1 className="text-2xl font-semibold">Gujarat Pollution Control Samiksha Kendra</h1>
        <p className="text-txt-secondary mt-2">Foundation slice running.</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 11: `apps/web/src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

- [ ] **Step 12: Install web deps**

Run: `pnpm install`
Expected: `apps/web/node_modules/` populated.

- [ ] **Step 13: Run the web dev server**

Run: `pnpm --filter @gpcsk/web dev`
Expected: Vite prints `Local: http://127.0.0.1:3000`. Visit it in a browser — see the tricolor strip + heading + "Foundation slice running." subtitle.

Stop the dev server with Ctrl-C.

- [ ] **Step 14: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): vite + react + tailwind scaffold with KSK design tokens"
```

---

### Task 13: i18n setup — en + gu bundles

**Files:**
- Create: `apps/web/src/i18n/index.ts`
- Create: `apps/web/src/i18n/locales/en.json`
- Create: `apps/web/src/i18n/locales/gu.json`
- Create: `apps/web/src/test-setup.ts`
- Create: `apps/web/src/i18n/i18n.test.tsx`
- Modify: `apps/web/src/main.tsx`

- [ ] **Step 1: `apps/web/src/i18n/locales/en.json`**

```json
{
  "appName": "Gujarat Pollution Control Samiksha Kendra",
  "appNameShort": "GPCSK",
  "language": {
    "title": "Choose your language",
    "english": "English",
    "gujarati": "ગુજરાતી (Gujarati)"
  },
  "splash": {
    "tagline": "Proactive pollution oversight, powered by AI"
  },
  "login": {
    "title": "Sign in",
    "subtitle": "Welcome to GPCSK",
    "phone": "Continue with Phone",
    "xgn": "Sign in with XGN",
    "demo": "Demo: pick a role"
  },
  "phone": {
    "enterTitle": "Enter your registered phone",
    "enterPlaceholder": "10-digit phone number",
    "sendOtp": "Send OTP",
    "otpTitle": "Enter the OTP",
    "otpSubtitle": "We've sent a 4-digit code (demo: 1234)",
    "verify": "Verify",
    "invalidOtp": "Invalid OTP",
    "userNotFound": "No GPCSK account for this phone"
  },
  "xgn": {
    "redirecting": "Redirecting to XGN portal…",
    "verifying": "Verifying your XGN session…",
    "selectId": "Demo XGN ID",
    "continue": "Continue"
  },
  "demo": {
    "title": "Demo Role Picker",
    "subtitle": "Pick a role to sign in as. This is only available in development."
  },
  "roles": {
    "CONSENT_OFFICER": "Consent Officer",
    "MONITORING_OFFICER": "Monitoring Officer",
    "INSPECTION_ENFORCEMENT_OFFICER": "Inspection & Enforcement Officer",
    "COMPLAINTS_OFFICER": "Complaints Officer",
    "SENIOR_REVIEWER": "Senior Reviewer"
  },
  "home": {
    "greeting": "Namaste, {{name}}",
    "askAi": "Ask me about pollution data, exceedances, complaints, consent applications…",
    "placeholder": "Type a message in English or Gujarati"
  },
  "common": {
    "back": "Back",
    "next": "Next",
    "loading": "Loading…",
    "signOut": "Sign out"
  }
}
```

- [ ] **Step 2: `apps/web/src/i18n/locales/gu.json`**

```json
{
  "appName": "ગુજરાત પ્રદૂષણ નિયંત્રણ સમીક્ષા કેન્દ્ર",
  "appNameShort": "GPCSK",
  "language": {
    "title": "તમારી ભાષા પસંદ કરો",
    "english": "English",
    "gujarati": "ગુજરાતી"
  },
  "splash": {
    "tagline": "AI-સંચાલિત સક્રિય પ્રદૂષણ દેખરેખ"
  },
  "login": {
    "title": "સાઇન ઇન કરો",
    "subtitle": "GPCSK માં તમારું સ્વાગત છે",
    "phone": "ફોન વડે ચાલુ રાખો",
    "xgn": "XGN વડે સાઇન ઇન કરો",
    "demo": "ડેમો: ભૂમિકા પસંદ કરો"
  },
  "phone": {
    "enterTitle": "તમારો નોંધાયેલ ફોન દાખલ કરો",
    "enterPlaceholder": "10-અંકનો ફોન નંબર",
    "sendOtp": "OTP મોકલો",
    "otpTitle": "OTP દાખલ કરો",
    "otpSubtitle": "અમે 4-અંકનો કોડ મોકલ્યો છે (ડેમો: 1234)",
    "verify": "ચકાસો",
    "invalidOtp": "અમાન્ય OTP",
    "userNotFound": "આ ફોન માટે કોઈ GPCSK ખાતું મળ્યું નથી"
  },
  "xgn": {
    "redirecting": "XGN પોર્ટલ પર રીડાયરેક્ટ થઈ રહ્યું છે…",
    "verifying": "તમારું XGN સત્ર ચકાસી રહ્યા છે…",
    "selectId": "ડેમો XGN ID",
    "continue": "ચાલુ રાખો"
  },
  "demo": {
    "title": "ડેમો ભૂમિકા પસંદગીકાર",
    "subtitle": "સાઇન ઇન કરવા માટે ભૂમિકા પસંદ કરો. ફક્ત વિકાસ દરમિયાન જ ઉપલબ્ધ છે."
  },
  "roles": {
    "CONSENT_OFFICER": "સંમતિ અધિકારી",
    "MONITORING_OFFICER": "દેખરેખ અધિકારી",
    "INSPECTION_ENFORCEMENT_OFFICER": "નિરીક્ષણ અને અમલીકરણ અધિકારી",
    "COMPLAINTS_OFFICER": "ફરિયાદ અધિકારી",
    "SENIOR_REVIEWER": "વરિષ્ઠ સમીક્ષક"
  },
  "home": {
    "greeting": "નમસ્તે, {{name}}",
    "askAi": "પ્રદૂષણ ડેટા, ઉલ્લંઘનો, ફરિયાદો, સંમતિ અરજીઓ વિશે પૂછો…",
    "placeholder": "અંગ્રેજી અથવા ગુજરાતીમાં સંદેશ લખો"
  },
  "common": {
    "back": "પાછળ",
    "next": "આગળ",
    "loading": "લોડ થઈ રહ્યું છે…",
    "signOut": "સાઇન આઉટ"
  }
}
```

- [ ] **Step 3: `apps/web/src/i18n/index.ts`**

```ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import gu from './locales/gu.json'

const KEY = 'gpcsk:lang'

export type Lang = 'en' | 'gu'

const stored = (typeof window !== 'undefined' && (localStorage.getItem(KEY) as Lang | null)) || null

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    gu: { translation: gu },
  },
  lng: stored ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export function setLanguage(lang: Lang) {
  i18n.changeLanguage(lang)
  if (typeof window !== 'undefined') localStorage.setItem(KEY, lang)
}

export default i18n
```

- [ ] **Step 4: Wire i18n into `apps/web/src/main.tsx`**

Replace the file with:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.js'
import './i18n/index.js'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 5: `apps/web/src/test-setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 6: Write `apps/web/src/i18n/i18n.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import i18n, { setLanguage } from './index.js'

function Probe() {
  const { t } = useTranslation()
  return <span>{t('appName')}</span>
}

describe('i18n', () => {
  beforeEach(() => setLanguage('en'))

  it('renders English by default', () => {
    render(<Probe />)
    expect(screen.getByText('Gujarat Pollution Control Samiksha Kendra')).toBeInTheDocument()
  })

  it('switches to Gujarati on setLanguage("gu")', async () => {
    setLanguage('gu')
    await i18n.changeLanguage('gu')
    render(<Probe />)
    expect(screen.getByText('ગુજરાત પ્રદૂષણ નિયંત્રણ સમીક્ષા કેન્દ્ર')).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: Run the test**

Run: `pnpm --filter @gpcsk/web test src/i18n/i18n.test.tsx`
Expected: 2 passed.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/i18n apps/web/src/test-setup.ts apps/web/src/main.tsx
git commit -m "feat(web): react-i18next with en + gu bundles, language toggle persisted to localStorage"
```

---

### Task 14: AppContext + screen router

**Files:**
- Create: `apps/web/src/context/AppContext.tsx`
- Create: `apps/web/src/context/AppContext.test.tsx`

- [ ] **Step 1: Write the failing test `apps/web/src/context/AppContext.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AppProvider, useApp } from './AppContext.js'

function Probe() {
  const { screen: s, setScreen } = useApp()
  return (
    <div>
      <span data-testid="screen">{s}</span>
      <button onClick={() => setScreen('login')}>go</button>
    </div>
  )
}

describe('AppContext', () => {
  it('defaults to splash', () => {
    render(<AppProvider><Probe /></AppProvider>)
    expect(screen.getByTestId('screen')).toHaveTextContent('splash')
  })

  it('transitions screens via setScreen', () => {
    render(<AppProvider><Probe /></AppProvider>)
    act(() => screen.getByText('go').click())
    expect(screen.getByTestId('screen')).toHaveTextContent('login')
  })
})
```

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm --filter @gpcsk/web test src/context/AppContext.test.tsx`
Expected: module not found.

- [ ] **Step 3: Implement `apps/web/src/context/AppContext.tsx`**

```tsx
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type Screen =
  | 'splash'
  | 'language'
  | 'login'
  | 'phone_entry'
  | 'phone_otp'
  | 'xgn_redirect'
  | 'xgn_verifying'
  | 'demo_role_picker'
  | 'home'

interface AppContextValue {
  screen: Screen
  setScreen: (s: Screen) => void
}

const Ctx = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>('splash')
  const value = useMemo(() => ({ screen, setScreen }), [screen])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp called outside AppProvider')
  return v
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `pnpm --filter @gpcsk/web test src/context/AppContext.test.tsx`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/context/AppContext.tsx apps/web/src/context/AppContext.test.tsx
git commit -m "feat(web): AppContext with screen router state (no react-router)"
```

---

### Task 15: API client + AuthContext (TDD)

**Files:**
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/lib/api.test.ts`
- Create: `apps/web/src/context/AuthContext.tsx`

- [ ] **Step 1: Write the failing test `apps/web/src/lib/api.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { api, ApiError } from './api.js'

const ORIGINAL_FETCH = global.fetch

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  global.fetch = ORIGINAL_FETCH
})

describe('api', () => {
  it('GET parses JSON body on 200', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    )
    const out = await api<{ status: string }>('/health')
    expect(out.status).toBe('ok')
  })

  it('POST sends JSON and attaches bearer token when provided', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce(new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }))
    await api('/api/auth/phone/verify-otp', { method: 'POST', body: { phone: '9000000005', otp: '1234' }, token: 'tkn' })
    const [, init] = fetchMock.mock.calls[0]
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tkn')
    expect(init.body).toBe(JSON.stringify({ phone: '9000000005', otp: '1234' }))
  })

  it('throws ApiError with status on non-2xx', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'invalid_otp' }), { status: 401, headers: { 'content-type': 'application/json' } }),
    )
    await expect(api('/api/auth/phone/verify-otp', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 401,
      code: 'invalid_otp',
    } satisfies Partial<ApiError>)
  })
})
```

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm --filter @gpcsk/web test src/lib/api.test.ts`
Expected: module not found.

- [ ] **Step 3: Implement `apps/web/src/lib/api.ts`**

```ts
export interface ApiError {
  status: number
  code?: string
  message: string
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string
}

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const method = opts.method ?? 'GET'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })

  const ct = res.headers.get('content-type') ?? ''
  const parsed = ct.includes('application/json') ? await res.json().catch(() => ({})) : {}

  if (!res.ok) {
    const err: ApiError = { status: res.status, code: parsed.error, message: parsed.message ?? res.statusText }
    throw err
  }
  return parsed as T
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `pnpm --filter @gpcsk/web test src/lib/api.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Implement `apps/web/src/context/AuthContext.tsx`**

```tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Role } from '@gpcsk/shared'
import { api } from '../lib/api.js'

export interface AuthUser {
  id: string
  name: string
  role: Role
  region?: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  loading: boolean
  setSession: (token: string, user: AuthUser) => void
  signOut: () => void
}

const Ctx = createContext<AuthContextValue | null>(null)
const KEY = 'gpcsk:auth'

interface Stored { token: string; user: AuthUser }

function readStored(): Stored | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as Stored } catch { return null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser]   = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = readStored()
    if (!stored) { setLoading(false); return }
    api<AuthUser>('/api/me', { token: stored.token })
      .then((me) => { setToken(stored.token); setUser(me) })
      .catch(() => localStorage.removeItem(KEY))
      .finally(() => setLoading(false))
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user, token, loading,
    setSession: (t, u) => {
      setToken(t); setUser(u)
      localStorage.setItem(KEY, JSON.stringify({ token: t, user: u }))
    },
    signOut: () => {
      setToken(null); setUser(null)
      localStorage.removeItem(KEY)
    },
  }), [user, token, loading])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib apps/web/src/context/AuthContext.tsx
git commit -m "feat(web): typed api client + AuthContext with localStorage persistence"
```

---

### Task 16: Splash + Language pages

**Files:**
- Create: `apps/web/src/components/TricolorStrip.tsx`
- Create: `apps/web/src/pages/SplashPage.tsx`
- Create: `apps/web/src/pages/LanguagePage.tsx`
- Create: `apps/web/src/pages/SplashPage.test.tsx`

- [ ] **Step 1: `apps/web/src/components/TricolorStrip.tsx`**

```tsx
export function TricolorStrip({ className = '' }: { className?: string }) {
  return <div className={`tricolor-strip ${className}`} aria-hidden />
}
```

- [ ] **Step 2: `apps/web/src/pages/SplashPage.tsx`**

```tsx
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext.js'
import { TricolorStrip } from '../components/TricolorStrip.js'

export function SplashPage() {
  const { t } = useTranslation()
  const { setScreen } = useApp()

  useEffect(() => {
    const id = setTimeout(() => setScreen('language'), 1500)
    return () => clearTimeout(id)
  }, [setScreen])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface-page text-txt-primary">
      <TricolorStrip className="w-48 mb-8 rounded" />
      <h1 className="text-2xl md:text-3xl font-semibold text-center px-6">{t('appName')}</h1>
      <p className="text-txt-secondary mt-3 text-center px-6">{t('splash.tagline')}</p>
    </div>
  )
}
```

- [ ] **Step 3: `apps/web/src/pages/LanguagePage.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { setLanguage, type Lang } from '../i18n/index.js'
import { useApp } from '../context/AppContext.js'
import { TricolorStrip } from '../components/TricolorStrip.js'

export function LanguagePage() {
  const { t } = useTranslation()
  const { setScreen } = useApp()

  function pick(lang: Lang) {
    setLanguage(lang)
    setScreen('login')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface-page px-6">
      <TricolorStrip className="w-40 mb-8 rounded" />
      <h2 className="text-xl font-semibold mb-6 text-txt-primary text-center">{t('language.title')}</h2>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button onClick={() => pick('en')} className="w-full rounded-card bg-primary text-white py-3 font-medium shadow-card hover:bg-primary-dark">
          {t('language.english')}
        </button>
        <button onClick={() => pick('gu')} className="w-full rounded-card bg-white border border-bdr text-txt-primary py-3 font-medium shadow-card hover:bg-surface-secondary">
          {t('language.gujarati')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: `apps/web/src/pages/SplashPage.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AppProvider, useApp } from '../context/AppContext.js'
import { SplashPage } from './SplashPage.js'

function ScreenWatcher() {
  const { screen: s } = useApp()
  return <span data-testid="watcher">{s}</span>
}

describe('SplashPage', () => {
  it('renders the app name and transitions to language after 1.5s', () => {
    vi.useFakeTimers()
    render(
      <AppProvider>
        <SplashPage />
        <ScreenWatcher />
      </AppProvider>,
    )
    expect(screen.getByText('Gujarat Pollution Control Samiksha Kendra')).toBeInTheDocument()
    expect(screen.getByTestId('watcher')).toHaveTextContent('splash')
    act(() => { vi.advanceTimersByTime(1600) })
    expect(screen.getByTestId('watcher')).toHaveTextContent('language')
    vi.useRealTimers()
  })
})
```

- [ ] **Step 5: Run the test, confirm pass**

Run: `pnpm --filter @gpcsk/web test src/pages/SplashPage.test.tsx`
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/TricolorStrip.tsx apps/web/src/pages/SplashPage.tsx apps/web/src/pages/LanguagePage.tsx apps/web/src/pages/SplashPage.test.tsx
git commit -m "feat(web): Splash and Language picker pages with KSK styling"
```

---

### Task 17: Login + sub-screens (Phone OTP, XGN, Demo Role)

**Files:**
- Create: `apps/web/src/pages/LoginPage.tsx`
- Create: `apps/web/src/pages/PhoneEntryPage.tsx`
- Create: `apps/web/src/pages/PhoneOtpPage.tsx`
- Create: `apps/web/src/pages/XgnRedirectPage.tsx`
- Create: `apps/web/src/pages/XgnVerifyingPage.tsx`
- Create: `apps/web/src/pages/DemoRolePickerPage.tsx`

- [ ] **Step 1: `apps/web/src/pages/LoginPage.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { Phone, Building2, FlaskConical } from 'lucide-react'
import { useApp } from '../context/AppContext.js'
import { TricolorStrip } from '../components/TricolorStrip.js'

export function LoginPage() {
  const { t } = useTranslation()
  const { setScreen } = useApp()

  const buttons = [
    { icon: Phone,         label: t('login.phone'), onClick: () => setScreen('phone_entry') },
    { icon: Building2,     label: t('login.xgn'),   onClick: () => setScreen('xgn_redirect') },
    { icon: FlaskConical,  label: t('login.demo'),  onClick: () => setScreen('demo_role_picker') },
  ] as const

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface-page px-6">
      <TricolorStrip className="w-40 mb-8 rounded" />
      <h2 className="text-2xl font-semibold text-txt-primary text-center">{t('login.title')}</h2>
      <p className="text-txt-secondary mt-2 mb-8 text-center">{t('login.subtitle')}</p>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        {buttons.map(({ icon: Icon, label, onClick }) => (
          <button key={label} onClick={onClick} className="w-full flex items-center gap-3 rounded-card bg-white border border-bdr px-4 py-3 text-left shadow-card hover:bg-surface-secondary">
            <Icon className="w-5 h-5 text-primary" />
            <span className="font-medium text-txt-primary">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `apps/web/src/pages/PhoneEntryPage.tsx`**

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { useApp } from '../context/AppContext.js'
import { api } from '../lib/api.js'

const PHONE_KEY = 'gpcsk:pending-phone'

export function PhoneEntryPage() {
  const { t } = useTranslation()
  const { setScreen } = useApp()
  const [phone, setPhone] = useState('')
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState<string | null>(null)

  async function submit() {
    if (!/^\d{10}$/.test(phone)) { setErr('Enter a 10-digit phone'); return }
    setBusy(true); setErr(null)
    try {
      await api('/api/auth/phone/request-otp', { method: 'POST', body: { phone } })
      sessionStorage.setItem(PHONE_KEY, phone)
      setScreen('phone_otp')
    } catch {
      setErr('Could not send OTP. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-page">
      <header className="px-6 py-4">
        <button onClick={() => setScreen('login')} className="flex items-center gap-2 text-txt-secondary hover:text-txt-primary">
          <ArrowLeft className="w-4 h-4" /> {t('common.back')}
        </button>
      </header>
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-semibold text-txt-primary mb-1">{t('phone.enterTitle')}</h2>
          <p className="text-txt-secondary mb-6 text-sm">{t('phone.otpSubtitle')}</p>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder={t('phone.enterPlaceholder')}
            className="w-full rounded-card border border-bdr px-4 py-3 text-lg tracking-wider focus:outline-none focus:ring-2 focus:ring-primary"
            inputMode="numeric"
          />
          {err && <p className="text-danger text-sm mt-2">{err}</p>}
          <button onClick={submit} disabled={busy} className="mt-6 w-full rounded-card bg-primary text-white py-3 font-medium shadow-card hover:bg-primary-dark disabled:opacity-50">
            {busy ? t('common.loading') : t('phone.sendOtp')}
          </button>
        </div>
      </main>
    </div>
  )
}

export { PHONE_KEY }
```

- [ ] **Step 3: `apps/web/src/pages/PhoneOtpPage.tsx`**

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { useApp } from '../context/AppContext.js'
import { useAuth, type AuthUser } from '../context/AuthContext.js'
import { api } from '../lib/api.js'
import { PHONE_KEY } from './PhoneEntryPage.js'

export function PhoneOtpPage() {
  const { t } = useTranslation()
  const { setScreen } = useApp()
  const { setSession } = useAuth()
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    const phone = sessionStorage.getItem(PHONE_KEY) ?? ''
    if (!phone) { setScreen('phone_entry'); return }
    setBusy(true); setErr(null)
    try {
      const { token, user } = await api<{ token: string; user: AuthUser }>('/api/auth/phone/verify-otp', { method: 'POST', body: { phone, otp } })
      setSession(token, user)
      sessionStorage.removeItem(PHONE_KEY)
      setScreen('home')
    } catch (e) {
      const code = (e as { code?: string }).code
      setErr(code === 'invalid_otp' ? t('phone.invalidOtp') : t('phone.userNotFound'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-page">
      <header className="px-6 py-4">
        <button onClick={() => setScreen('phone_entry')} className="flex items-center gap-2 text-txt-secondary hover:text-txt-primary">
          <ArrowLeft className="w-4 h-4" /> {t('common.back')}
        </button>
      </header>
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-semibold mb-1">{t('phone.otpTitle')}</h2>
          <p className="text-txt-secondary text-sm mb-6">{t('phone.otpSubtitle')}</p>
          <input
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••"
            className="w-full rounded-card border border-bdr px-4 py-3 text-2xl tracking-[0.5em] text-center focus:outline-none focus:ring-2 focus:ring-primary"
            inputMode="numeric"
          />
          {err && <p className="text-danger text-sm mt-2">{err}</p>}
          <button onClick={submit} disabled={busy || otp.length < 4} className="mt-6 w-full rounded-card bg-primary text-white py-3 font-medium shadow-card hover:bg-primary-dark disabled:opacity-50">
            {busy ? t('common.loading') : t('phone.verify')}
          </button>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 4: `apps/web/src/pages/XgnRedirectPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext.js'

const DEMO_XGN_IDS = [
  { id: 'XGN-CO-001',  label: 'Consent Officer' },
  { id: 'XGN-MO-001',  label: 'Monitoring Officer' },
  { id: 'XGN-IEO-001', label: 'Inspection & Enforcement Officer' },
  { id: 'XGN-CMP-001', label: 'Complaints Officer' },
  { id: 'XGN-SR-001',  label: 'Senior Reviewer' },
] as const

export function XgnRedirectPage() {
  const { t } = useTranslation()
  const { setScreen } = useApp()
  const [chosen, setChosen] = useState<string>('XGN-SR-001')
  const [auto, setAuto] = useState(false)

  useEffect(() => {
    if (!auto) return
    const id = setTimeout(() => {
      sessionStorage.setItem('gpcsk:pending-xgn', chosen)
      setScreen('xgn_verifying')
    }, 1200)
    return () => clearTimeout(id)
  }, [auto, chosen, setScreen])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface-page px-6">
      <h2 className="text-xl font-semibold mb-2 text-txt-primary">{t('xgn.redirecting')}</h2>
      <p className="text-txt-secondary text-sm mb-6">{t('xgn.selectId')}</p>
      <div className="w-full max-w-sm flex flex-col gap-2">
        {DEMO_XGN_IDS.map(({ id, label }) => (
          <label key={id} className={`flex items-center gap-3 border rounded-card px-4 py-3 cursor-pointer ${chosen === id ? 'border-primary bg-primary-light' : 'border-bdr bg-white'}`}>
            <input type="radio" checked={chosen === id} onChange={() => setChosen(id)} />
            <div>
              <div className="font-mono text-sm text-txt-primary">{id}</div>
              <div className="text-xs text-txt-secondary">{label}</div>
            </div>
          </label>
        ))}
        <button onClick={() => setAuto(true)} className="mt-3 w-full rounded-card bg-primary text-white py-3 font-medium shadow-card hover:bg-primary-dark">
          {t('xgn.continue')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: `apps/web/src/pages/XgnVerifyingPage.tsx`**

```tsx
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext.js'
import { useAuth, type AuthUser } from '../context/AuthContext.js'
import { api } from '../lib/api.js'

export function XgnVerifyingPage() {
  const { t } = useTranslation()
  const { setScreen } = useApp()
  const { setSession } = useAuth()

  useEffect(() => {
    const xgnId = sessionStorage.getItem('gpcsk:pending-xgn')
    if (!xgnId) { setScreen('login'); return }
    api<{ token: string; user: AuthUser }>('/api/auth/xgn/callback', { method: 'POST', body: { xgnId } })
      .then(({ token, user }) => {
        setSession(token, user)
        sessionStorage.removeItem('gpcsk:pending-xgn')
        setScreen('home')
      })
      .catch(() => setScreen('login'))
  }, [setSession, setScreen])

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-page">
      <p className="text-txt-secondary animate-pulse">{t('xgn.verifying')}</p>
    </div>
  )
}
```

- [ ] **Step 6: `apps/web/src/pages/DemoRolePickerPage.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { ROLES, type Role } from '@gpcsk/shared'
import { useApp } from '../context/AppContext.js'
import { useAuth, type AuthUser } from '../context/AuthContext.js'
import { api } from '../lib/api.js'

export function DemoRolePickerPage() {
  const { t } = useTranslation()
  const { setScreen } = useApp()
  const { setSession } = useAuth()

  async function pick(role: Role) {
    try {
      const { token, user } = await api<{ token: string; user: AuthUser }>('/api/auth/demo-login', { method: 'POST', body: { role } })
      setSession(token, user)
      setScreen('home')
    } catch {
      setScreen('login')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-page">
      <header className="px-6 py-4">
        <button onClick={() => setScreen('login')} className="flex items-center gap-2 text-txt-secondary hover:text-txt-primary">
          <ArrowLeft className="w-4 h-4" /> {t('common.back')}
        </button>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <h2 className="text-xl font-semibold mb-1">{t('demo.title')}</h2>
        <p className="text-txt-secondary text-sm mb-6 text-center">{t('demo.subtitle')}</p>
        <div className="w-full max-w-sm flex flex-col gap-2">
          {ROLES.map(role => (
            <button key={role} onClick={() => pick(role)} className="rounded-card bg-white border border-bdr px-4 py-3 text-left shadow-card hover:bg-surface-secondary">
              <div className="font-medium text-txt-primary">{t(`roles.${role}`)}</div>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/LoginPage.tsx apps/web/src/pages/PhoneEntryPage.tsx apps/web/src/pages/PhoneOtpPage.tsx apps/web/src/pages/XgnRedirectPage.tsx apps/web/src/pages/XgnVerifyingPage.tsx apps/web/src/pages/DemoRolePickerPage.tsx
git commit -m "feat(web): login + phone OTP + mock XGN SSO + demo role picker pages"
```

---

### Task 18: SuperHomePage shell (stub)

**Files:**
- Create: `apps/web/src/components/shell/TopBar.tsx`
- Create: `apps/web/src/components/shell/Sidebar.tsx`
- Create: `apps/web/src/components/shell/AskAiPanel.tsx`
- Create: `apps/web/src/components/shell/CanvasPanel.tsx`
- Create: `apps/web/src/pages/SuperHomePage.tsx`

- [ ] **Step 1: `apps/web/src/components/shell/TopBar.tsx`**

```tsx
import { Bell, LayoutDashboard, MessageSquare, User, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext.js'
import { useApp } from '../../context/AppContext.js'

export function TopBar() {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const { setScreen } = useApp()
  if (!user) return null

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-bdr-light bg-white">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-primary" />
        <span className="font-semibold text-txt-primary">{t('appNameShort')}</span>
        <span className="hidden md:inline text-txt-secondary text-sm">· {t(`roles.${user.role}`)}</span>
      </div>
      <div className="flex items-center gap-1">
        <button className="p-2 rounded-card hover:bg-surface-secondary" title="Notifications"><Bell className="w-5 h-5 text-txt-secondary" /></button>
        <button className="p-2 rounded-card hover:bg-surface-secondary" title="Canvas"><LayoutDashboard className="w-5 h-5 text-txt-secondary" /></button>
        <button className="p-2 rounded-card hover:bg-surface-secondary" title="Profile"><User className="w-5 h-5 text-txt-secondary" /></button>
        <button onClick={() => { signOut(); setScreen('login') }} className="p-2 rounded-card hover:bg-surface-secondary" title={t('common.signOut')}>
          <LogOut className="w-5 h-5 text-txt-secondary" />
        </button>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: `apps/web/src/components/shell/Sidebar.tsx`**

```tsx
export function Sidebar() {
  return (
    <aside className="w-60 border-r border-bdr-light bg-white p-3 hidden md:flex md:flex-col">
      <div className="text-xs uppercase tracking-wider text-txt-tertiary px-2 mb-2">Today</div>
      <ul className="space-y-1 text-sm text-txt-primary">
        <li className="px-2 py-1 rounded-card hover:bg-surface-secondary cursor-pointer">New conversation</li>
      </ul>
      <div className="text-xs uppercase tracking-wider text-txt-tertiary px-2 mb-2 mt-4">Modules</div>
      <ul className="space-y-1 text-sm text-txt-secondary">
        <li className="px-2 py-1 rounded-card text-txt-tertiary">Coming in next slice…</li>
      </ul>
    </aside>
  )
}
```

- [ ] **Step 3: `apps/web/src/components/shell/AskAiPanel.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { Send } from 'lucide-react'

export function AskAiPanel() {
  const { t } = useTranslation()
  return (
    <div className="flex-1 flex flex-col items-stretch p-6">
      <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col justify-end">
        <div className="text-txt-secondary text-sm mb-3">{t('home.askAi')}</div>
        <div className="flex items-center gap-2 rounded-card border border-bdr bg-white shadow-card px-3 py-2">
          <input
            placeholder={t('home.placeholder')}
            className="flex-1 bg-transparent focus:outline-none text-txt-primary"
          />
          <button className="p-2 rounded-card bg-primary text-white hover:bg-primary-dark" title="Send">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: `apps/web/src/components/shell/CanvasPanel.tsx`**

```tsx
export function CanvasPanel() {
  return (
    <section className="w-[40%] border-l border-bdr-light bg-surface-secondary hidden lg:block">
      <div className="h-full flex items-center justify-center text-txt-tertiary text-sm p-6 text-center">
        Canvas panel — domain modules land here from slice 2 onwards.
      </div>
    </section>
  )
}
```

- [ ] **Step 5: `apps/web/src/pages/SuperHomePage.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext.js'
import { TopBar } from '../components/shell/TopBar.js'
import { Sidebar } from '../components/shell/Sidebar.js'
import { AskAiPanel } from '../components/shell/AskAiPanel.js'
import { CanvasPanel } from '../components/shell/CanvasPanel.js'

export function SuperHomePage() {
  const { t } = useTranslation()
  const { user } = useAuth()

  return (
    <div className="min-h-screen flex flex-col bg-surface-page">
      <TopBar />
      <div className="flex-1 flex">
        <Sidebar />
        <main className="flex-1 flex">
          <div className="flex-1 flex flex-col">
            <div className="px-6 pt-6">
              <h1 className="text-2xl font-semibold text-txt-primary">
                {t('home.greeting', { name: user?.name ?? '' })}
              </h1>
            </div>
            <AskAiPanel />
          </div>
          <CanvasPanel />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/shell apps/web/src/pages/SuperHomePage.tsx
git commit -m "feat(web): SuperHomePage shell with TopBar, Sidebar, AskAi panel, Canvas placeholder"
```

---

### Task 19: Wire the screen router in `App.tsx`

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/main.tsx`

- [ ] **Step 1: Rewrite `apps/web/src/App.tsx`**

```tsx
import { useEffect, type ReactElement } from 'react'
import { useApp, type Screen } from './context/AppContext.js'
import { useAuth } from './context/AuthContext.js'
import { SplashPage } from './pages/SplashPage.js'
import { LanguagePage } from './pages/LanguagePage.js'
import { LoginPage } from './pages/LoginPage.js'
import { PhoneEntryPage } from './pages/PhoneEntryPage.js'
import { PhoneOtpPage } from './pages/PhoneOtpPage.js'
import { XgnRedirectPage } from './pages/XgnRedirectPage.js'
import { XgnVerifyingPage } from './pages/XgnVerifyingPage.js'
import { DemoRolePickerPage } from './pages/DemoRolePickerPage.js'
import { SuperHomePage } from './pages/SuperHomePage.js'

const ROUTES: Record<Screen, ReactElement> = {
  splash:           <SplashPage />,
  language:         <LanguagePage />,
  login:            <LoginPage />,
  phone_entry:      <PhoneEntryPage />,
  phone_otp:        <PhoneOtpPage />,
  xgn_redirect:     <XgnRedirectPage />,
  xgn_verifying:    <XgnVerifyingPage />,
  demo_role_picker: <DemoRolePickerPage />,
  home:             <SuperHomePage />,
}

export default function App() {
  const { screen, setScreen } = useApp()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (user && screen !== 'home') setScreen('home')
  }, [loading, user, screen, setScreen])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-page">
        <div className="text-txt-secondary">Loading…</div>
      </div>
    )
  }
  return ROUTES[screen]
}
```

- [ ] **Step 2: Wrap `App` with providers in `apps/web/src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.js'
import { AppProvider } from './context/AppContext.js'
import { AuthProvider } from './context/AuthContext.js'
import './i18n/index.js'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </AppProvider>
  </React.StrictMode>,
)
```

- [ ] **Step 3: Typecheck both apps**

Run: `pnpm typecheck`
Expected: every workspace package returns exit 0.

- [ ] **Step 4: Run all tests across the workspace**

Run: `pnpm test`
Expected: api tests + web tests all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/main.tsx
git commit -m "feat(web): wire screen router with AppProvider + AuthProvider"
```

---

### Task 20: End-to-end smoke test

**Files:** None — verification only.

- [ ] **Step 1: Ensure DB is up and seeded**

Run: `docker compose up -d db && pnpm --filter @gpcsk/api run db:seed`
Expected: 5 users in DB.

- [ ] **Step 2: Start the API**

In terminal A: `pnpm --filter @gpcsk/api dev`
Expected: `GPCSK API listening on :8000`.

- [ ] **Step 3: Start the web**

In terminal B: `pnpm --filter @gpcsk/web dev`
Expected: `Local: http://127.0.0.1:3000`.

- [ ] **Step 4: Walk the phone OTP path**

1. Open `http://127.0.0.1:3000`.
2. See the Splash for ~1.5s → Language picker.
3. Click "English".
4. Click "Continue with Phone".
5. Enter `9000000005`, click "Send OTP".
6. Enter `1234`, click "Verify".
7. Expected landing: SuperHomePage with greeting "Namaste, Dr. K. Trivedi" and the role label "Senior Reviewer" in the top bar.

- [ ] **Step 5: Walk the XGN SSO path**

1. Sign out (top right LogOut icon).
2. Click "Sign in with XGN".
3. Select `XGN-MO-001` (Monitoring Officer).
4. Click "Continue".
5. After "Verifying your XGN session…" momentary screen, land on the home with name "Rohit Solanki".

- [ ] **Step 6: Walk the Gujarati path**

1. Sign out.
2. On Language picker, click "ગુજરાતી".
3. Confirm every screen now shows Gujarati strings (heading "સાઇન ઇન કરો", placeholder "10-અંકનો ફોન નંબર", greeting on home as "નમસ્તે, …").

- [ ] **Step 7: Walk the Demo Role Picker path**

1. Sign out.
2. Click "Demo: pick a role".
3. Click each of the 5 roles in turn; for each, confirm the top bar role label matches.

- [ ] **Step 8: Verify auth persistence**

1. Sign in via any path.
2. Refresh the browser.
3. Confirm the home page reappears immediately (no re-login required) and `/api/me` is called once on boot — visible in the API terminal logs.

- [ ] **Step 9: No commit needed — purely verification.**

If any step fails, fix and re-run before moving on. Then:

```bash
git status
```

Expected: working tree clean.

---

### Task 21: Production Dockerfiles + tunnel compose

**Files:**
- Create: `apps/api/Dockerfile`
- Create: `apps/web/Dockerfile`
- Create: `apps/web/nginx.conf`
- Create: `docker-compose.tunnel.yml`
- Modify: `.gitignore` (already covers `.env` — verify)

- [ ] **Step 1: `apps/api/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages packages
COPY apps/api apps/api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @gpcsk/api exec prisma generate
RUN pnpm --filter @gpcsk/api build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
COPY --from=build /repo/pnpm-workspace.yaml /repo/package.json /repo/pnpm-lock.yaml ./
COPY --from=build /repo/packages packages
COPY --from=build /repo/apps/api/package.json apps/api/package.json
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/prisma apps/api/prisma
COPY --from=build /repo/apps/api/node_modules apps/api/node_modules
EXPOSE 8000
CMD ["node", "apps/api/dist/index.js"]
```

- [ ] **Step 2: `apps/web/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS build
WORKDIR /repo
RUN corepack enable
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages packages
COPY apps/web apps/web
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @gpcsk/web build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
```

- [ ] **Step 3: `apps/web/nginx.conf`**

```nginx
server {
  listen 3000;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location ~* \.(?:css|js|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico)$ {
    expires 30d;
    access_log off;
    add_header Cache-Control "public";
  }
}
```

- [ ] **Step 4: `docker-compose.tunnel.yml`**

```yaml
# Cloudflare Tunnel production deployment.
# Bind every service to 127.0.0.1 — only cloudflared on the host can reach them.
# Usage:
#   docker compose -f docker-compose.tunnel.yml up -d --build
#
# Secrets come from the project-root .env.

services:
  db:
    image: pgvector/pgvector:pg16
    restart: unless-stopped
    environment:
      POSTGRES_USER: gpcsk
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}
      POSTGRES_DB: gpcsk
    volumes:
      - gpcsk-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U gpcsk -d gpcsk"]
      interval: 10s
      timeout: 5s
      retries: 10
    networks: [gpcsk]

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    restart: unless-stopped
    depends_on:
      db: { condition: service_healthy }
    ports:
      - "127.0.0.1:8000:8000"
    environment:
      DATABASE_URL: postgresql://gpcsk:${POSTGRES_PASSWORD}@db:5432/gpcsk?schema=public
      API_PORT: "8000"
      API_JWT_SECRET: ${API_JWT_SECRET:?set API_JWT_SECRET in .env}
      API_JWT_TTL_HOURS: "24"
      CORS_ALLOWED_ORIGINS: ${CORS_ALLOWED_ORIGINS:?set CORS_ALLOWED_ORIGINS in .env}
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
      NODE_ENV: production
    networks: [gpcsk]

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      args:
        VITE_API_URL: ${VITE_API_URL:?set VITE_API_URL in .env}
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    networks: [gpcsk]

volumes:
  gpcsk-pgdata:

networks:
  gpcsk:
    driver: bridge
```

- [ ] **Step 5: Sanity-build the images (no need to run them yet — full tunnel wiring is slice 8)**

Run: `docker compose -f docker-compose.tunnel.yml build`
Expected: `api` and `web` images build successfully. If any TS error surfaces, fix it before continuing — production must build clean.

- [ ] **Step 6: Commit**

```bash
git add apps/api/Dockerfile apps/web/Dockerfile apps/web/nginx.conf docker-compose.tunnel.yml
git commit -m "feat(infra): production Dockerfiles + Cloudflare-Tunnel-ready compose"
```

---

### Task 22: README + DEVELOPMENT docs

**Files:**
- Modify: `README.md`
- Create: `docs/DEVELOPMENT.md`

- [ ] **Step 1: Replace `README.md`**

```markdown
# Gujarat Pollution Control Samiksha Kendra (GPCSK)

> AI intelligence layer for the Gujarat Pollution Control Board's review tier — a *Samiksha Kendra* that turns scattered XGN / OCEMS / CETP / complaint data into proactive, officer-actionable insight.

Forked design from [KSK (Kaushal Samiksha Kendra)](https://github.com/edityeah/ksk).

## Quickstart

```bash
# 1. Prerequisites: Node 20, pnpm 9, Docker Desktop.
nvm use   # honours .nvmrc

# 2. Install workspace dependencies.
pnpm install

# 3. Start Postgres + pgvector.
pnpm db:up

# 4. Configure environment.
cp .env.example .env   # then edit OPENAI_API_KEY if needed for slice 7

# 5. Run database migrations.
pnpm --filter @gpcsk/api exec prisma migrate dev

# 6. Seed demo users.
pnpm --filter @gpcsk/api run db:seed

# 7. Launch both apps in parallel.
pnpm dev
```

Then open `http://127.0.0.1:3000`. Sign in with phone `9000000005` + OTP `1234` (Senior Reviewer), or use the demo role picker.

## Documentation

- Design spec: [docs/superpowers/specs/2026-06-04-gpcsk-design.md](docs/superpowers/specs/2026-06-04-gpcsk-design.md)
- Implementation plans: [docs/superpowers/plans/](docs/superpowers/plans/)
- Development guide: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- GPCB source materials: [docs/references/gpcb-sources/](docs/references/gpcb-sources/)

## License

Personal project. No license granted for commercial use, redistribution, or model training.
```

- [ ] **Step 2: Create `docs/DEVELOPMENT.md`**

```markdown
# Development

## Workspace layout

This repo is a pnpm workspace.

- `apps/api` — Node 20 + Express + Prisma + TypeScript backend.
- `apps/web` — Vite + React 18 + Tailwind 3 + TypeScript frontend.
- `packages/shared` — Cross-app TS enums and types.

## Common commands

| Command | Effect |
|---|---|
| `pnpm dev` | Run both apps in parallel. |
| `pnpm --filter @gpcsk/api dev` | API only. |
| `pnpm --filter @gpcsk/web dev` | Web only. |
| `pnpm test` | Run all unit + integration tests across the workspace. |
| `pnpm typecheck` | Strict TypeScript check across the workspace. |
| `pnpm --filter @gpcsk/api exec prisma migrate dev --name <slug>` | Author a new migration. |
| `pnpm --filter @gpcsk/api run db:seed` | (Re-)seed demo users. |
| `pnpm db:up` / `pnpm db:down` / `pnpm db:reset` | Docker Postgres lifecycle. |

## Demo accounts

| Phone | XGN ID | Role |
|---|---|---|
| 9000000001 | XGN-CO-001 | Consent Officer |
| 9000000002 | XGN-MO-001 | Monitoring Officer |
| 9000000003 | XGN-IEO-001 | Inspection & Enforcement Officer |
| 9000000004 | XGN-CMP-001 | Complaints Officer |
| 9000000005 | XGN-SR-001 | Senior Reviewer / Member Secretary |

OTP: `1234` or `123456`.

## Adding a slice

1. Brainstorm the slice if it touches the data model (use `superpowers:brainstorming`).
2. Write the implementation plan to `docs/superpowers/plans/YYYY-MM-DD-<slice-name>.md`.
3. Execute task-by-task via `superpowers:subagent-driven-development` or `superpowers:executing-plans`.
4. Each task ends in a passing test + commit. No exceptions.

## Tests

API tests use vitest + supertest against a real Postgres (the same Docker container). Web tests use vitest + Testing Library + jsdom.

To run a single API test file:

```bash
pnpm --filter @gpcsk/api test src/auth/router.test.ts
```

## Production

`docker-compose.tunnel.yml` builds and runs production-grade containers bound to `127.0.0.1`. A Cloudflare Tunnel reaches them. Slice 8 documents the tunnel handshake; until then, the compose file is buildable but not booted.
```

- [ ] **Step 3: Commit**

```bash
git add README.md docs/DEVELOPMENT.md
git commit -m "docs: README quickstart + DEVELOPMENT runbook with demo creds"
```

---

## Self-Review

**Spec coverage** (cross-checked against `docs/superpowers/specs/2026-06-04-gpcsk-design.md`):

- §1 Vision — captured in README and design spec; the foundation does not implement Vision-level features yet, which is correct for slice 1.
- §2 Scope — all four streams + five roles + maker-checker states represented in `packages/shared` enums and the Prisma schema (Task 3, Task 5).
- §3 Stack — every layer in the table appears in Task 1 (root tooling), Task 2 (Postgres + pgvector), Task 4 (Express + TS), Task 12 (Vite + React + Tailwind + lucide), Task 13 (react-i18next). OpenAI not exercised in this slice (slice 7); env var documented.
- §4 Hosting topology — `docker-compose.yml` (Task 2) for dev, `docker-compose.tunnel.yml` (Task 21) for prod, with all services bound to `127.0.0.1`.
- §5 Actors — all five present in `seed/users.ts` (Task 8) and `packages/shared/roles.ts` (Task 3).
- §6 Maker-Checker — state enum present in shared + Prisma (Tasks 3, 5); engine itself lands in slice 4.
- §7 Data model — Prisma schema in Task 5 covers §7.1–§7.9 verbatim. KnowledgeChunk has the `vector(1536)` column added via raw-SQL migration.
- §8 Screen graph — implemented across Tasks 14–19 (Splash → Language → Login → 3 paths → Home).
- §9 Canvas modules — only the shell (TopBar / Sidebar / AskAi / Canvas placeholder) lands here; module canvases are slice 2–6.
- §10 AI orchestrator — slice 7, intentionally absent.
- §11 Seed strategy — only demo users this slice (Task 8); domain seeds land per slice from 2 onwards.
- §12 Notifications — model present in schema; UI in slice 8.
- §13 i18n — react-i18next with `en` + `gu` (Task 13). All login/auth/home strings translated.
- §14 Out of scope — respected (no SMS, no real XGN, no PostGIS, no Hindi).
- §15 Build sequence — Tasks 1–22 cover steps 1–3 of the spec's build sequence; later slices pick up steps 4+.
- §16 Repository layout — matches the structure in Task 5+ Task 12.

**Placeholder scan** — no `TBD`, `TODO`, or "fill in" markers. Every code block is complete and runnable.

**Type consistency** — `Role`, `Stream`, `MakerCheckerState`, `ConsentType` etc. are defined exactly once in `packages/shared` and re-exported. Prisma's enums mirror the same values in `SCREAMING_SNAKE_CASE`. The `Screen` union is defined once in `AppContext.tsx` and referenced from `App.tsx`. `AuthUser` is defined once in `AuthContext.tsx` and reused by `api()` callers and pages.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-04-gpcsk-slice-1-foundation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

**Which approach?**
