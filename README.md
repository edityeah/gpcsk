# Gujarat Pollution Control Samiksha Kendra (GPCSK)

> AI-driven *Samiksha Kendra* (review centre) for the Gujarat Pollution Control Board — turns scattered XGN / OCEMS / CETP / complaint data into proactive officer-actionable insight.

**Live demo:** [https://gpcsk.adityeah.ai](https://gpcsk.adityeah.ai)

Forked design system from [KSK (Kaushal Samiksha Kendra)](https://github.com/edityeah/ksk) · powered by [SwiftChat by ConveGenius](https://swiftchat.in).

---

## Demo accounts

Sign in at the live URL with any of these — phone OTP `1234`, XGN SSO, or one-click "Demo role picker":

| Role | Phone | XGN ID | Officer |
|---|---|---|---|
| Senior Reviewer / Member Secretary | 9000000005 | XGN-SR-001 | Dr. K. Trivedi |
| Consent Officer | 9000000001 | XGN-CO-001 | Anjali Patel |
| Monitoring Officer | 9000000002 | XGN-MO-001 | Rohit Solanki |
| Inspection & Enforcement Officer | 9000000003 | XGN-IEO-001 | Mehul Joshi |
| Complaints Officer | 9000000004 | XGN-CMP-001 | Priya Shah |

---

## What's inside

### Home shell (KSK-cloned, retargeted to GPCSK)

- Two-column layout — sidebar (chat history + module tiles grouped by category) + main pane (greeting / chat / canvas overlay)
- "Open an App" card grid with War Room pinned at top, then Programs / Consent Management / Risk-Based Inspections / Complaints / Dashboards
- Half-width canvas overlay with Maximize ↔ Restore toggle and a back-stack breadcrumb (`Programs ▸ OCEMS Live Grid`)
- Embedded **Saathi chat panel** inside every canvas with role + canvas-specific "TRY ASKING" suggestion chips
- Sidebar profile pill at the bottom with sign-out

### Canvases (25+)

- **⭐ War Room** — live anomaly investigation board with a real Gujarat district heatmap (Leaflet + OSM tiles), 8 typed anomaly cards (confirmed exceedance clusters, CETP bypass, unconsented operation, complaint hotspots, SLA breaches, frequent sensor dropouts, norm-trend drift), and inline Escalate / Snooze / Resolve / "Investigate with Saathi" actions
- **🔬 Programs** — OCEMS / AAQM / Water Quality / VOC / CETP / Festival Monitoring + Noise & Hazardous Waste (v2 placeholders), each card opens its program's live grid
- **📝 Consent Management** — orchestrator with KPI strip, 5 tabs (Inbox / **AI Verification** / Pipeline / Renewals / Capacity-vs-Consent). AI Verification scans each consent application's uploaded documents and flags them BLANK / MISSING / BLURRED / UNCLEAR / UNSCANNED / OK before a human reviewer signs off
- **🔍 Risk-Based Inspections** — AI surfaces top-risk industries (composite score from exceedances + complaints + open inspections + consent gaps); IEO confirms / dismisses / schedules; confirmed ones land in the Inspection Scheduler with `inspectionType=RISK_BASED`
- **📞 Complaints** — inbox + auto-triage donut + hotspot map + industry correlation + citizen response tracker
- **📊 Senior Reviewer mega-dashboards** — Gujarat Pulse · Industry Risk Index · Enforcement Pipeline · Trend Lab · Maker-Checker Queue · Broadcast
- **🤖 AI Chat** — gpt-4o intent routing + RAG over Acts, CPCB norms, GPCB Annual Reports (incl. 80 OCR-extracted chunks from AR 2024-25), CETP Feb-2026 report, and Ganesh Utsav festival data. Renders **inline charts** (BAR / LINE / PIE / AREA) when asked for trends or top-N rankings. Cites sources back to the source document.
- **🎤 Voice calling** — OpenAI Realtime (gpt-realtime) over WebRTC with screen-share. Click the phone icon, ask "what am I looking at?", model sees the screen + answers grounded in the same RAG corpus. Pill sits in the top-right of the app shell during a call.

### Live data sources

| Stream | Source | Provenance badge |
|---|---|---|
| Air quality (AAQM) | **WAQI** (republishes CPCB CAAQMS hourly) — 12 live Gujarat stations including GIDC Ankleshwar, Chandkheda Ahmedabad, GIDC Nandesari, GIFT City, Vatva, Vapi, Bopal, Hansol, Sector-10 Gandhinagar, SAC ISRO, IIPHG Lekawada, Gyaspur | 🟢 **CPCB Live** |
| OCEMS / CEMS (effluent) | 50 real Gujarat industries — Adani Power Mundra, Reliance Jamnagar, Torrent Power, Deepak Nitrite Nandesari, etc. Names from GPCB AR; readings synthesised (no public CEMS API) | 🟡 **Real name · Synthetic readings** |
| Everything else (VOC / Hazardous Waste / Noise / MINARS-GEMS / synthetic OCEMS / synthetic AAQM fallback) | Deterministic seed with per-station compliance bands modelled against CPCB norms | ⚪ **Synthetic** |
| Knowledge base (RAG) | Water Act 1974 · Air Act 1981 · EPA 1986 + Rules · HW Rules 2016 · Noise Rules 2000 · CPCB NAAQS · CETP Effluent Standards · **GPCB AR 2022-23 + 2024-25** (full OCR ingest) · CETP Feb-2026 report · Festival Monitoring SOP | All real |

Live ingest runs hourly inside the API container; data lands in `MonitoringStation` + `SensorReading` with a `dataSource` and `lastIngestedAt` stamped on every row.

### Roles & maker-checker

5 functional officer archetypes with row-level RBAC. Enforcement actions and consent decisions flow through a **maker-checker state machine** (`DRAFT → PENDING_REVIEW → COMMITTED / RETURNED_FOR_REVISION / WITHDRAWN`) with every transition stamped to `AuditLog`.

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | Vite + React 18 + TS + Tailwind 3 + lucide-react + recharts + Leaflet + react-i18next (en + gu) |
| Backend | Node 20 + Express + Prisma + Zod + vitest |
| Database | Postgres 16 + pgvector (1536-dim embeddings via text-embedding-3-small) |
| LLM | OpenAI gpt-4o (chat + intent routing + chart spec generation) + gpt-realtime (voice + vision) |
| Live data | WAQI public API (Gujarat AAQM) · `node-cron` for hourly refresh |
| Auth | JWT — phone OTP / mock XGN SSO / demo role picker |
| Tooling | pnpm workspaces — `apps/web`, `apps/api`, `packages/shared` |
| Hosting | Render (Blueprint: web service + Postgres) · or Docker Compose on a Mac → Cloudflare Tunnel |

```
Internet ──HTTPS──► Cloudflare edge ──tunnel──► cloudflared on Mac
                                                      │
                          ┌───────────────────────────┴─────────────────────────┐
                          │                  Docker Compose                      │
                          │  web   — Vite build served by nginx, 127.0.0.1:3002 │
                          │  api   — Node/Express, 127.0.0.1:8002               │
                          │  db    — postgres:16 + pgvector, 127.0.0.1:5435     │
                          └──────────────────────────────────────────────────────┘
```

All containers bind to `127.0.0.1` — only Cloudflare's tunnel daemon reaches the services. Dev stack runs on its own ports (`:5434 / :8001 / :3001`) and coexists with prod.

---

## Local development

```bash
# 1. Prerequisites
nvm use                                   # honours .nvmrc (Node 20)
# pnpm 9.12.3 is bundled via corepack — no global install needed

# 2. Boot Postgres + pgvector
pnpm db:up

# 3. Install + configure
pnpm install
cp .env.example .env                      # paste your OPENAI_API_KEY + WAQI_TOKEN

# 4. Schema + seed
pnpm --filter @gpcsk/api exec prisma migrate dev
pnpm --filter @gpcsk/api run db:seed

# 5. Ingest the GPCB AR + CETP + festival PDFs into the RAG corpus
pnpm --filter @gpcsk/api run rag:ingest-pdfs
pnpm --filter @gpcsk/api run rag:ingest

# 6. Pull live AAQM data once
pnpm --filter @gpcsk/api run ingest:aaqm

# 7. Run web + api in parallel
pnpm dev
```

Open `http://127.0.0.1:3001` and sign in as Senior Reviewer (phone `9000000005` + OTP `1234`).

### Useful commands

```bash
pnpm test                                 # run all api + web vitest suites
pnpm typecheck                            # workspace-wide tsc --noEmit
pnpm db:reset                             # wipe + reseed dev DB
pnpm --filter @gpcsk/api run ingest:aaqm  # manual WAQI refresh
pnpm --filter @gpcsk/api run ingest:cems  # manual CEMS refresh (currently fallback)
```

---

## Production deployment

### Render (one-click Blueprint)

[`render.yaml`](render.yaml) provisions a single **web service** (`gpcsk` — Express API that also serves the built SPA on the same origin) plus a **Postgres 16 + pgvector** database (`gpcsk-db`), both in Singapore.

1. Render dashboard → **New +** → **Blueprint** → connect `github.com/edityeah/gpcsk` → **Apply**.
2. On the `gpcsk` service → **Environment**, set `OPENAI_API_KEY` and `WAQI_TOKEN` (both marked `sync: false` so they never live in git).
3. First boot runs [`scripts/render-start.mjs`](scripts/render-start.mjs): `prisma migrate deploy` → seed demo data (empty DB only) → start the API → chunk the GPCB PDFs and embed them with OpenAI in the background. Nothing to run by hand.
4. Open `https://gpcsk.onrender.com` and sign in as Senior Reviewer (phone `9000000005` + OTP `1234`).
5. **Custom domain:** service → Settings → Custom Domains → add `gpcsk.adityeah.ai`, then in Cloudflare DNS point `gpcsk` at `gpcsk.onrender.com` (CNAME) and remove the `gpcsk.adityeah.ai/*` Worker route so the offline-guard no longer proxies to the tunnel.

Build = [`scripts/render-build.sh`](scripts/render-build.sh) (shared → prisma generate → api → web with `VITE_API_URL=""`). The API serves `apps/web/dist` whenever `WEB_DIST_DIR` is set, so the same image works for Docker too.

Free-tier caveats: the service sleeps after 15 min idle (first hit then takes ~30-60 s and the hourly ingest cron only fires while awake), and Render's free Postgres has a limited lifetime — upgrade `gpcsk-db` if the demo must persist.

### Docker Compose + Cloudflare Tunnel (self-hosted)

`docker-compose.tunnel.yml` + `.env.production` + Cloudflare Tunnel. See [docs/DEMO.md](docs/DEMO.md) for the demo flow and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the deploy runbook.

```bash
docker compose --project-name gpcsk-prod --env-file .env.production -f docker-compose.tunnel.yml up -d --build
```

A launchd agent (`ai.adityeah.gpcsk-tunnel`) keeps the Cloudflare Tunnel alive across reboots.

### Offline fallback

Because the demo runs on a personal laptop, there will be windows where the Mac is asleep and Cloudflare can't reach the tunnel. A small **Cloudflare Worker** (`infra/cloudflare-worker/`) sits on `gpcsk.adityeah.ai/*`, proxies healthy traffic straight through to the tunnel, and — if the origin errors or times out — serves a branded "owner's laptop is asleep" page with a mailto link and 60-second auto-retry, instead of Cloudflare's default 502/1033 error. Deploy with:

```bash
cd infra/cloudflare-worker
npx wrangler login          # one-time browser OAuth
npx wrangler deploy
```

Free Workers plan — stays inside the zero-recurring-cost budget.

---

## Documentation

- [Design spec](docs/superpowers/specs/2026-06-04-gpcsk-design.md) — vision, scope, data model, screens, AI orchestrator
- [Implementation plans](docs/superpowers/plans/) — slice-by-slice execution plans
- [Demo walkthrough](docs/DEMO.md) — 6-step Senior-Reviewer → Inspection-Officer maker-checker round-trip
- [Development runbook](docs/DEVELOPMENT.md) — local dev + ops commands
- [GPCB source materials](docs/references/gpcb-sources/) — committed PDFs and OCR text

---

## License

Personal project. No license granted for commercial use, redistribution, or model training. Contact the maintainer for collaboration.
