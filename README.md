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

Then open `http://127.0.0.1:3001`. Sign in with phone `9000000005` + OTP `1234` (Senior Reviewer), or use the demo role picker.

## Documentation

- Design spec: [docs/superpowers/specs/2026-06-04-gpcsk-design.md](docs/superpowers/specs/2026-06-04-gpcsk-design.md)
- Implementation plans: [docs/superpowers/plans/](docs/superpowers/plans/)
- Development guide: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- GPCB source materials: [docs/references/gpcb-sources/](docs/references/gpcb-sources/)

## License

Personal project. No license granted for commercial use, redistribution, or model training.
