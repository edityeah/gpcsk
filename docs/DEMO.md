# GPCSK — Demo Runbook

End-to-end demo of the Gujarat Pollution Control Samiksha Kendra: sign in,
explore Senior Reviewer dashboards, ask the AI a grounded RAG question,
approve an enforcement action through the maker-checker queue, draft a new
notice as an Inspection Officer, and watch the round trip land back in the
Senior Reviewer queue.

---

## Prerequisites

1. **Node 20 + pnpm 9** (workspace pinned to `pnpm@9.12.3`).
2. **Docker Desktop** running (Postgres 16 + pgvector container).
3. **Working directory:** repo root (`/Users/adityeahspare/Documents/GPCB`).
4. **Branch:** `slice-1-foundation`.
5. **.env at repo root.** Loaded by `dotenv-cli` for API scripts and by Vitest.
   Minimum keys (see `.env.example`):
   - `DATABASE_URL=postgresql://gpcsk:gpcsk@localhost:5434/gpcsk?schema=public`
   - `API_JWT_SECRET=<32+ char secret>`
   - `OPENAI_API_KEY=<sk-...>` (optional — leave placeholder for offline demo)
6. **Postgres up + schema applied + seeded:**
   ```bash
   npx -y pnpm@9.12.3 db:up
   npx -y pnpm@9.12.3 --filter @gpcsk/api exec prisma migrate deploy
   npx -y pnpm@9.12.3 --filter @gpcsk/api run db:seed
   npx -y pnpm@9.12.3 --filter @gpcsk/api run rag:ingest   # populates pgvector embeddings (skipped if no key)
   ```
7. **Launch both apps:**
   ```bash
   npx -y pnpm@9.12.3 dev
   # API → http://localhost:8001
   # Web → http://localhost:3001
   ```

---

## Demo accounts

All accounts unlock with OTP **`1234`**. The role picker on the Demo page maps
1:1 to these XGN IDs.

| Phone        | XGN ID       | Role                                  |
| ------------ | ------------ | ------------------------------------- |
| 9000000001   | XGN-CO-001   | CONSENT_OFFICER                        |
| 9000000002   | MO-001       | MONITORING_OFFICER                     |
| 9000000003   | IEO-001      | INSPECTION_ENFORCEMENT_OFFICER         |
| 9000000004   | CMP-001      | COMPLAINTS_PUBLIC_OFFICER              |
| 9000000005   | SR-001       | SENIOR_REVIEWER                         |

---

## Demo script (6 steps)

### 1. Sign in as Senior Reviewer
- Open `http://localhost:3001`.
- Pick language → choose **Senior Reviewer** on the Demo Role picker (or sign
  in with phone `9000000005`, OTP `1234`).
- Land on SuperHomePage shell. Note the four mega-dashboard tiles in the
  sidebar.

### 2. Gujarat Pulse
- Sidebar → **Gujarat Pulse**.
- Live exceedance counter (last 24h) ticks, district stream stacked-area chart
  renders, "Breaking anomalies" list shows top 10 CRITICAL exceedances.
- Confirm the canvas opens in the right pane.

### 3. Drill into an industry
- Click the top "Top risk industries" row (Clariant Chemicals India – Ankleshwar).
- Industry detail canvas opens — consent timeline, sensor sparklines,
  inspection history, open enforcement actions, all stitched into one view.

### 4. Ask the AI — "BOD limit for CETPs?"
- Open the **Ask AI** chat panel (left rail).
- Type: `BOD limit for CETPs?`
- With a real `OPENAI_API_KEY`, the assistant returns a grounded RAG answer
  with inline citations (Knowledge document snippets — CPCB CETP standards).
- With a placeholder key, the assistant returns the graceful offline message:
  `AI is offline — set OPENAI_API_KEY in .env and restart.`

### 5. Maker-Checker Queue → Approve a SHOW_CAUSE
- Sidebar → **Maker-Checker Queue**.
- Filter `type = SHOW_CAUSE`, `state = PENDING_REVIEW`.
- Open the first item. Review evidence and notes.
- Click **Approve** → modal asks for reviewer notes → confirm.
- The item moves out of the queue. Sidebar → **Enforcement Pipeline** → the
  same action now shows under **COMMITTED**. Audit log appended.

### 6. Round trip — IEO draft → SR queue
- Sign out → demo login as **Inspection Officer** (XGN-CO-001 → IEO-001).
- Sidebar → **Draft Notice** canvas.
- Pick an industry with confirmed violations, type = `CLOSURE_DIRECTION`,
  fill rationale + evidence, click **Submit for Review**.
- Sign out → demo login back as **Senior Reviewer**.
- Sidebar → **Maker-Checker Queue** — the new draft appears at the top of the
  PENDING_REVIEW list with `draftedBy = IEO-001`.

That's the full maker-checker round-trip.

---

## Seed counts (current snapshot)

| Entity              | Count   |
| ------------------- | ------: |
| industries          |     150 |
| consents            |   1,188 |
| stations            |     170 |
| readings            |  89,648 |
| exceedances         |   5,052 |
| cetps               |      15 |
| cetp_reports        |     180 |
| inspections         |     322 |
| violations          |     168 |
| enforcement         |     541 |
| complaints          |       4 |
| knowledge_docs      |      18 |
| knowledge_chunks    |      69 |
| chunks_embedded     | 0 (set OPENAI_API_KEY then `rag:ingest`) |

---

## Known limitations (slice 1 scope)

- **No live CDN map** — Gujarat district choropleth is rendered with seeded
  centroids only. Real GeoJSON tile layer is post-MVP.
- **No SSE streaming** — Pulse counters refresh on poll, not push.
- **No Cloudflare Tunnel deploy yet** — `docker-compose.tunnel.yml` exists
  but is unverified end-to-end against a live tunnel.
- **No SMS / email delivery** — OTPs are seeded to `1234` for demo; production
  delivery channel deferred.
- **Embeddings empty until OPENAI_API_KEY is set** — the RAG answer path
  falls back to the offline message. Re-run `rag:ingest` after configuring the
  key.

---

## Reset

```bash
npx -y pnpm@9.12.3 db:reset                            # tears down + brings up empty Postgres
npx -y pnpm@9.12.3 --filter @gpcsk/api exec prisma migrate deploy
npx -y pnpm@9.12.3 --filter @gpcsk/api run db:seed
npx -y pnpm@9.12.3 --filter @gpcsk/api run rag:ingest  # only if OPENAI_API_KEY is set
```
