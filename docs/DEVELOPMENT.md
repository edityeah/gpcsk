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
