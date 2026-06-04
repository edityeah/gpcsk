# Gujarat Pollution Control Samiksha Kendra (GPCSK) — Design Spec

_Last updated: 2026-06-04_

## 1. Vision

**GPCSK** is an AI intelligence layer that sits on top of every data stream the Gujarat Pollution Control Board already produces — XGN consent and inspection records, OCEMS / CEQMS / AAQM / MINARS / GEMS / VOC sensor feeds, monthly CETP monitoring reports, citizen complaints, and self-reported industry audits. It shifts the four functional officer archetypes at GPCB HQ (Consent, Monitoring, Inspection & Enforcement, Complaints) and their Senior Reviewer / Member Secretary from **reactive triage** to **proactive, data-backed action**.

GPCSK does **not** replace XGN, OCEMS, or CPCB EDB. It is the *Samiksha* (review) tier that ingests from those systems, scores risk, surfaces anomalies, drafts enforcement actions, runs natural-language Q&A over the board's documents, and exposes everything via a chat-first canvas UI cloned 1:1 from KSK (Kaushal Samiksha Kendra).

## 2. Scope (v1)

- **Four pollution streams**: Air, Water, Hazardous Waste, Noise / Municipal Solid Waste.
- **Five actors**: Consent Officer, Monitoring Officer, Inspection & Enforcement Officer, Complaints Officer, Senior Reviewer / Member Secretary.
- **Maker-checker** on enforcement actions and consent decisions.
- **Languages**: English + Gujarati. Hindi deferred to v2.
- **Data posture**: Demo / pitch prototype — all data seeded, modelled after the real GPCB Annual Report 2022-23, CETP Feb-2026 reports, and Ganesh Utsav festival-monitoring data. Ingest adapters stubbed so a v2 real-XGN / real-OCEMS swap is one adapter-layer change; the Prisma schema does not change.
- **Hosting**: Zero recurring cost. Cloudflare Tunnel from a Mac running Docker Compose. OpenAI is the only paid dependency, paid from existing credits.

## 3. Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Vite + React 18 + Tailwind 3 + lucide-react + react-i18next | Same as KSK; no react-router (`AppContext.screen`) |
| Backend | Node 20 + Express + Prisma | Same as KSK |
| Database | Postgres 16 in Docker (pgvector extension) | Replaces KSK's SQLite; one container does both rows and embeddings |
| LLM | OpenAI gpt-4o (chat) + text-embedding-3-small (RAG) | User-supplied OpenAI key |
| Auth | JWT, mock XGN SSO (OTP `1234` / `123456`) | Real NIC XGN integration deferred to v2 |
| Tooling | pnpm workspaces — `apps/web`, `apps/api`, `packages/shared` | Mirrors the Mental Wellbeing repo layout |
| Hosting | Cloudflare Tunnel + Docker Compose on a Mac | `docker-compose.yml` for dev, `docker-compose.tunnel.yml` for prod |

## 4. Hosting topology

```
Internet ──HTTPS──► Cloudflare edge ──tunnel──► cloudflared on Mac
                                                      │
                          ┌───────────────────────────┼───────────────────────────┐
                          │                  Docker Compose                        │
                          │                                                        │
                          │  web   — Vite build served by nginx, 127.0.0.1:3000   │
                          │  api   — Node/Express, 127.0.0.1:8000                 │
                          │  db    — postgres:16-alpine + pgvector, internal      │
                          │                                                        │
                          └────────────────────────────────────────────────────────┘
```

All containers bind to `127.0.0.1` only — never directly LAN-exposed. Public URL provisioned via Cloudflare DNS pointing at the tunnel (e.g. `gpcsk.adityeah.ai`).

## 5. Actors

| # | Role | Login | Scope | Headline modules |
|---|---|---|---|---|
| 1 | **Consent Officer** | XGN SSO (mocked) / phone OTP | All consent applications statewide | Application Queue, CTE / CTO / HW-Auth Pipeline, Renewal Radar, Capacity-vs-Consent Analyser, Document Completeness AI Check |
| 2 | **Monitoring Officer** | XGN SSO / phone OTP | All sensor & lab streams | OCEMS / CEQMS Live Grid, AAQM Station Monitor, Exceedance Feed, Predicted-Exceedance Lab, VOC Cluster Monitor, CETP Scorecard, Festival Monitoring Planner |
| 3 | **Inspection & Enforcement Officer** | XGN SSO / phone OTP | Inspection cell jurisdiction | Inspection Prioritisation List, Scheduler, On-Site Checklist, Draft Notices (show-cause / closure), Violations Register |
| 4 | **Complaints Officer** | XGN SSO / phone OTP | Citizen complaint inbox | Complaint Inbox, Auto-Triage, Hotspot Map, Industry Correlation, Citizen Response Tracker |
| 5 | **Senior Reviewer / Member Secretary** | XGN SSO / phone OTP | Statewide, all streams, approver | 4 mega-dashboards (Pulse / Risk / Enforcement / Trend Lab), Maker-Checker Queue, Broadcasts, Anomaly Alerts |

All five actors share the same shell: top bar (bot / role / notifications / canvas / profile) → sidebar (chat history grouped by recency, plus bot tiles) → greeting + Ask AI panel → canvas-on-right (40-60% panel on desktop, full-screen overlay on mobile). All five use the full-width dashboard layout — no mobile-frame letterbox (officers work on desktops at GPCB HQ).

## 6. Maker-Checker State Machine

Applied to **enforcement actions** and **consent decisions**:

```
drafted_by_maker                  → state: draft
+ submitted_for_review             → state: pending_review
+ approved_by_checker              → state: committed
+ rejected_by_checker_with_notes   → state: returned_for_revision
recalled_by_maker                  → state: withdrawn
```

- **Enforcement** — Inspection / Enforcement Officer drafts show-cause or closure → Senior Reviewer approves → notice committed + delivery channel queued.
- **Consent** — Consent Officer recommends CTE / CTO / HW-Auth grant or refusal → Senior Reviewer approves → decision committed + auto-letter generated.
- **Sensor exceedance disposition** stays single-actor (Monitoring Officer marks `confirmed_violation` or `sensor_glitch` with audit log). If `confirmed_violation`, it auto-creates a pre-filled enforcement draft for the Inspection/Enforcement Officer.

Every transition stamps `actorId`, `timestamp`, `reason`, and writes to `AuditLog`.

## 7. Data Model (Prisma, simplified)

### 7.1 Identity & access
- `User` — id, role, xgnId, phone, name, email, designation, region, profile (JSON)
- `Session` — JWT issuance audit
- `AuditLog` — actor, entity, action, before / after (JSON), timestamp

### 7.2 Industry / regulatory
- `Industry` — id, name, ucNumber, category (Red / Orange / Green / White per CPCB), sector, gidcZone, district, taluka, lat / lng, capacity (JSON), classificationScheme
- `ConsentApplication` — id, industry (FK), type (CTE / CTO / HW_AUTH), submittedAt, validityFrom, validityTo, state (draft / under_review / recommended / approved / rejected / expired / renewed), parameters (JSON), feeStatus, makerId, checkerId
- `Inspection` — id, industry (FK), scheduledAt, inspectorId, completedAt, observations (JSON), photos (FK[]), violations (FK[]), nextDueAt
- `Violation` — id, industry (FK), inspection (FK?), source (sensor / inspection / complaint / audit), parameter, observedValue, normValue, severity (minor / major / critical), detectedAt, dispositionState

### 7.3 Sensor / monitoring streams
- `MonitoringStation` — id, type (OCEMS / CEQMS / AAQM / MINARS / GEMS / VOC), industry (FK?), location (lat / lng), parameters[], status (active / down / calibration)
- `SensorReading` — id, station (FK), parameter (PM10 / PM2.5 / SO2 / NOx / COD / BOD / pH / …), value, unit, timestamp, validity (valid / flagged / missing)
- `Exceedance` — id, station (FK), reading (FK), normValue, breachMagnitude, severity, detectedAt, dispositionState, dispositionActorId, dispositionAt
- `LabSample` — id, station (FK?), industry (FK?), collectedAt, parameters (JSON), reportFileUrl (for MINARS / GEMS PDFs)

### 7.4 CETP (modelled distinctly because the Feb-2026 PDF has a unique shape)
- `CETP` — id, name, capacityMld, district, memberUnitsCount, hasOnlineCeqms, spraydryerUnits
- `CETPMonitoringReport` — id, cetp (FK), monthOf, inletNorms (JSON), finalEffluentStds (JSON), observedInlet (JSON), observedFinal (JSON), bypassMld, hazardousWasteStorageMt, hazardousWasteDisposedMt, reportFileUrl

### 7.5 Enforcement
- `EnforcementAction` — id, industry (FK), type (show_cause / closure_direction / bank_guarantee_invocation / recovery / sealing), draftedBy, draftedAt, evidence (JSON), violations (FK[]), state (draft / pending_review / committed / returned / withdrawn), reviewedBy, reviewedAt, letterFileUrl, deliveryChannel, deliveryStatus

### 7.6 Citizen interaction
- `Complaint` — id, channel (web / phone / email / walk-in), receivedAt, complainant (JSON: name, phone, email — PII-tagged), location (lat / lng), category (auto-classified), severity (auto), description, attachments (FK[]), industry (FK?), state (new / assigned / in_progress / resolved / closed / duplicate), assignedTo
- `ComplaintResponse` — id, complaint (FK), respondedBy, respondedAt, message, action

### 7.7 AI / chat
- `ChatThread` — id, user (FK), title, createdAt, lastMessageAt
- `ChatMessage` — id, thread (FK), role (user / assistant / system), content, toolCalls (JSON), createdAt
- `KnowledgeDocument` — id, title, sourceType (Act / Rule / SOP / AnnualReport / CPCBNorm / CETPReport / FestivalMonitoring), tags[], fileUrl
- `KnowledgeChunk` — id, document (FK), chunkText, embedding (vector(1536))

### 7.8 Notifications & ops
- `Notification` — id, user (FK), category (exceedance / complaint_assigned / renewal_due / inspection_due / maker_checker_pending / anomaly / broadcast), priority, payload (JSON), readAt
- `Broadcast` — id, audience (role[] / region[]), title, body, sentBy, sentAt

### 7.9 Reference / lookups
- `Norm` — parameter, stream, category, value, unit, regulator (CPCB / GPCB / State), source (Act / Notification)
- `Sector`, `Region`, `District`, `Taluka`, `GidcZone` — small reference tables

## 8. Screen graph

```
Splash → Language (en / gu) → Login (3 buttons)
  ├── Phone Entry → OTP → Home
  ├── XGN SSO Portal Redirect → Verifying → OK / Fail → Home
  └── Demo Role Picker (dev / demo only) → Home
```

`SuperHomePage.jsx` dispatches on `role` and renders the shared shell with role-specific sidebar tiles, greeting, and a default canvas.

## 9. Canvas modules

One file per module under `apps/web/src/canvas/modules/<role>/`.

### 9.1 Senior Reviewer / Member Secretary (the four mega-dashboards)
- `GujaratPollutionPulseCanvas` — Gujarat district heatmap by stream, live exceedance count, top-10 risk industries, breaking anomalies
- `IndustryRiskIndexCanvas` — composite risk score per unit (OCEMS exceedances + complaints + inspection history + consent gaps), ranked, filterable by district/sector/category
- `EnforcementPipelineCanvas` — show-cause notices, closures, bank guarantees, recoveries by stage; SLA timers
- `EnvironmentalTrendLabCanvas` — pick a river / AQ station / CETP / VOC cluster → period-over-period; festival event before/during/after comparison
- `MakerCheckerQueueCanvas` — pending enforcement + consent items for the reviewer; approve / return-with-notes
- `BroadcastCanvas` — compose + send to role / region

### 9.2 Consent Officer
- `ApplicationQueueCanvas`, `ConsentPipelineCanvas` (CTE / CTO / HW-Auth), `RenewalRadarCanvas` (30 / 60 / 90 day), `CapacityVsConsentCanvas`, `DocumentCompletenessCanvas` (AI-driven document checklist), `ConsentDraftCanvas` (maker)

### 9.3 Monitoring Officer
- `OcemsLiveGridCanvas`, `AaqmStationMonitorCanvas`, `ExceedanceFeedCanvas`, `PredictedExceedanceLabCanvas`, `VocClusterMonitorCanvas`, `CetpScorecardCanvas`, `FestivalMonitoringPlannerCanvas` (idol immersion before/during/after), `CalibrationAlertsCanvas`

### 9.4 Inspection & Enforcement Officer
- `InspectionPrioritisationCanvas` (AI-ranked), `InspectionSchedulerCanvas`, `OnSiteChecklistCanvas` (photo capture, parameter readings), `DraftNoticeCanvas` (AI-drafted show-cause / closure), `ViolationsRegisterCanvas`

### 9.5 Complaints Officer
- `ComplaintInboxCanvas`, `AutoTriageCanvas`, `ComplaintHotspotMapCanvas`, `IndustryCorrelationCanvas`, `CitizenResponseTrackerCanvas`

### 9.6 Shared
- `NotificationCanvas`, `ReportExportCanvas`, `IndustryDeepDiveCanvas` (linked from anywhere — composite view of one industry), `MapCanvas` (Gujarat base map used by Pulse, Hotspot, Risk Index)

## 10. AI orchestrator layer

Direct fork of KSK's pipeline.

### 10.1 Files
- `actionRegistry.js` — `OPEN_GUJARAT_PULSE`, `OPEN_INDUSTRY_RISK_INDEX`, `OPEN_ENFORCEMENT_PIPELINE`, `OPEN_TREND_LAB`, `OPEN_APPLICATION_QUEUE`, `OPEN_CONSENT_PIPELINE`, `OPEN_RENEWAL_RADAR`, `OPEN_OCEMS_LIVE_GRID`, `OPEN_EXCEEDANCE_FEED`, `OPEN_PREDICTED_EXCEEDANCE`, `OPEN_VOC_CLUSTER_MONITOR`, `OPEN_CETP_SCORECARD`, `OPEN_FESTIVAL_PLANNER`, `OPEN_INSPECTION_PRIORITISATION`, `OPEN_DRAFT_NOTICE`, `OPEN_VIOLATIONS_REGISTER`, `OPEN_COMPLAINT_INBOX`, `OPEN_COMPLAINT_HOTSPOT_MAP`, `OPEN_MAKER_CHECKER_QUEUE`, `OPEN_INDUSTRY_DEEP_DIVE`, `CREATE_BROADCAST`, `CREATE_REMINDER`, etc.
- `moduleRegistry.js` — module ids with `allowedRoles`, multilingual aliases (en + gu), canvas view.
- `localPatterns.js` — regex fallback for high-frequency intents (e.g. "show risk index", "consent renewals due", "exceedances today", "complaints in Vatva").
- `permissionGuard.js` — role-gated.
- `globalIntentRouter.js` — directive emitter (trigger / canvas / reply / notification / clarify / confirm / denied / answer).
- Backend `/api/ai/message` — orchestrator; classifies action OR runs RAG.

### 10.2 RAG knowledge base
Markdown-chunked and embedded (text-embedding-3-small, 1536-dim, stored in pgvector):
- Water (Prevention and Control of Pollution) Act 1974
- Air (Prevention and Control of Pollution) Act 1981
- Environment (Protection) Act 1986 + EPA Rules
- Hazardous and Other Wastes (Management and Transboundary Movement) Rules 2016
- Solid Waste Management Rules 2016
- Noise Pollution (Regulation and Control) Rules 2000
- CPCB ambient air / water / noise norms (industry-category-wise)
- GPCB Annual Report 2022-23 (chunked from the source PDF)
- CETP monitoring reports (one chunk per CETP per month, Feb-2026 onward)
- Ganesh Utsav / Diwali / Navratri festival monitoring data
- GPCB SOPs for consent, inspection, enforcement (synthesised v1)
- Role-action matrix and product FAQ

## 11. Seed data strategy

All seed data is shaped from the user-provided source PDFs (now in `docs/references/gpcb-sources/`) plus public references from `https://gpcb.gujarat.gov.in/`.

- **Industries** — ~250 seeded, drawn from real GIDC clusters: Ankleshwar, Vatva, Naroda, Sachin (Surat), Vapi, Panoli, Jhagadia, Dahej, Pandesara, Hazira, Morbi (ceramics + ship-breaking at Alang).
- **OCEMS / CEQMS readings** — 30-day rolling history for ~80 OCEMS-equipped industries; minute-granularity, with seeded exceedances and one "predicted-exceedance" trend per cluster.
- **AAQM readings** — 62 stations (38 NAMP + 24 SAMP from the AR), monthly averages, 12 months back; PM10, PM2.5, SO2, NOx, NH3, O3, CO, Pb, As, Ni, Benzene, Benzo(a)Pyrene.
- **MINARS / GEMS** — 152 stations as in the AR; pH / DO / BOD / COD quarterly readings; real station names (Sabarmati at Vasna-Narol, Mahi at Vasad, Narmada at Garudeshwar, etc).
- **VOC clusters** — 25 clusters with the 15 parameters from the AR table.
- **CETPs** — five real CETPs from the Feb-2026 PDF (AHSPA, Gujarat Vepari, Naroda Enviro, Narol Dyestuff, Odhav Enviro) plus ~10 synthesised; one report per month for 12 months back.
- **Consent applications** — ~600 across CTE / CTO / HW-Auth, varied states; ~50 expiring in the next 90 days to drive Renewal Radar.
- **Inspections** — ~400 historical + ~40 scheduled.
- **Complaints** — ~300, location-tagged across Gujarat, varied categories; hotspot clustering around real industrial estates.
- **Festival monitoring** — full Ganesh Utsav Sabarmati before / during / after dataset from the source PDF.

Seed scripts under `apps/api/prisma/seed/<entity>.ts`, idempotent, re-runnable. Seed-data generation uses small helper functions; *no* OpenAI calls during seeding to keep it deterministic and free.

## 12. Notifications

Same shape as KSK. Categories specific to GPCSK:
`exceedance_critical`, `exceedance_predicted`, `complaint_assigned`, `complaint_hotspot_alert`, `renewal_due_30`, `renewal_due_60`, `renewal_due_90`, `inspection_due`, `maker_checker_pending`, `notice_committed`, `anomaly_flag`, `festival_planner_reminder`, `broadcast`, `general`.

Persisted server-side + localStorage mirror for offline-read state.

## 13. i18n

- `react-i18next` with `en` and `gu` JSON bundles per module.
- All UI strings, intent aliases, and notification templates have Gujarati translations.
- Chat NLP accepts Gujarati script and Gu-Eng code-switching ("Vatva ma exceedance કેટલા છે this week?").
- LLM system prompts include language-mirroring instruction: respond in whatever language the user used.

## 14. Out of scope for v1

- Real XGN, OCEMS, MoEFCC, EDB integrations (all mocked / seeded).
- Real SMS / email / WhatsApp delivery — notifications are in-app only.
- Production-grade auth (JWT, no refresh tokens, no MFA, no real XGN SSO).
- Multi-tenant region isolation — single demo workspace.
- Real legal-letter generation pipelines (PDF templates exist, but no DSC / e-sign).
- Native mobile apps — desktop-first; mobile reflow via responsive Tailwind only.
- Real spatial DB queries (PostGIS) — lat/lng stored as floats, hotspot clustering done in app code.
- Hindi i18n.

## 15. Build sequence (top-down)

1. Repo scaffold — pnpm workspaces, Docker Compose (web + api + postgres + pgvector), Cloudflare Tunnel compose file, env templates
2. Backend Prisma schema + migrations + base auth + AuditLog
3. Frontend scaffold + AppContext + screen router + login flow + i18n (en + gu) + theme cloned from KSK
4. Reference + lookup data seed (sectors, districts, GIDC zones, CPCB norms)
5. Industries + ConsentApplications seed → Consent Officer canvases end-to-end
6. Monitoring stations + sensor readings + exceedances seed → Monitoring Officer canvases
7. CETPs + CETP monitoring reports seed → CETP Scorecard
8. Inspections + Violations + EnforcementActions seed → Inspection & Enforcement Officer canvases + Maker-Checker queue
9. Complaints seed → Complaints Officer canvases + Hotspot Map
10. Senior Reviewer mega-dashboards (Pulse, Risk Index, Enforcement Pipeline, Trend Lab)
11. AI orchestrator — actionRegistry, moduleRegistry, localPatterns, permissionGuard, intent router, `/api/ai/message`
12. RAG ingestion — chunk + embed the Acts, CPCB norms, GPCB AR 2022-23, CETP reports, festival data, SOPs
13. Notifications + Broadcasts + Report Export
14. End-to-end demo script across 3 browser windows (Consent / Monitoring / Senior Reviewer) showing the Industry Risk Index → drill-down → enforcement draft → maker-checker approval loop
15. Cloudflare Tunnel deployment + public URL hand-off

## 16. Repository layout

```
.
├── apps/
│   ├── api/                Node + Express + Prisma backend
│   │   ├── src/            Routers, services, ai orchestrator, rag, seed
│   │   └── prisma/         Schema, migrations, seed scripts
│   └── web/                Vite + React + Tailwind frontend
│       └── src/
│           ├── canvas/     Canvas modules per role
│           ├── components/ Shared shell, chat, sidebar, top bar
│           ├── context/    AppContext, AuthContext
│           ├── nlp/        actionRegistry, moduleRegistry, localPatterns
│           ├── i18n/       en + gu bundles
│           └── pages/      Splash, Language, Login, SuperHomePage
├── packages/
│   └── shared/             Cross-app TS types, norms, role definitions
├── docs/
│   ├── references/         GPCB source PDFs (AR 2022-23, CETP, festival)
│   └── superpowers/
│       ├── specs/          This file and future specs
│       └── plans/          Implementation plans (next step)
├── docker-compose.yml          Local dev — postgres + pgvector
├── docker-compose.tunnel.yml   Production — web + api + db, all bound to 127.0.0.1
├── .env.example
├── package.json                pnpm workspace root
├── pnpm-workspace.yaml
└── README.md
```
