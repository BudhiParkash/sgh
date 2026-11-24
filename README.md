# Shivanshi Gaming Hub

Independent BGMI & PUBG Mobile information platform: tournaments, sensitivity settings, guides and news.
Owner: Shivanshi Tripathi · https://shivanshigaming.com

## Repository
| Path | What |
|---|---|
| `frontend/` | Next.js 16 (App Router) — public site and `/admin` |
| `backend/` | Express API (from milestone M3) |
| `shared/` | `@sgh/shared` — enums, constants, Zod schemas, API types |
| `brand/` | original logo files and brand guide |
| `docs/architecture/` | approved architecture (start at `00-README.md`) |
| `docs/CHECKLIST.md` | development checklist and milestone reports |

## Status
Phase 1 is complete and tested (see `docs/CHECKLIST.md` and `docs/QA-REPORT.md`). Going live: `infrastructure/runbooks/go-live.md`.

## Getting started
Requires Node ≥ 22.13 and pnpm 10 (`npm i -g pnpm@10`, or prefix commands with `npx pnpm@10`).

Local services: MongoDB 8 and Redis 7 (e.g. `brew install mongodb-community redis`).

```bash
pnpm install
cp .env.example frontend/.env.local
cp backend/.env.example backend/.env          # fill the three secrets (commands are in the file)
pnpm --filter @sgh/backend seed               # reference data only (roles, games, scopes, categories, legal drafts)
pnpm --filter @sgh/backend create-super-admin -- --email you@example.com --name "Your Name"
pnpm --filter @sgh/backend dev                # API  http://localhost:4000/api/v1  (docs: /api/v1/docs)
pnpm --filter @sgh/backend dev:worker         # scheduled publishing + retention
pnpm dev                 # http://localhost:3000  (component gallery: /ui-kit)
pnpm lint && pnpm typecheck && pnpm test
pnpm test:e2e            # clean build + Playwright against a disposable MongoDB/Redis/API stack
```
