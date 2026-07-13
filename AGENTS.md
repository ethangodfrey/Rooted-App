# Vendorly Marketplace — Agent maintenance guide

You are maintaining **Vendorly Marketplace** (formerly Rooted), a local food marketplace monorepo. Work autonomously: fix bugs, improve reliability, and ship small safe improvements. Do not force-push, amend pushed commits, or commit secrets.

## Production deploy target

**All web production work deploys to Vercel project `Vendorly_Marketplace1` only.**

- Do not treat `vendorly-marketplace`, `vendorly_marketplace`, or `rooted-app` as production.
- Git branch: `main` → **Vendorly_Marketplace1** Production redeploy.
- Runbook: [`docs/VERCEL_PRODUCTION_PROJECT.md`](docs/VERCEL_PRODUCTION_PROJECT.md)

## Repo layout

| Path | What it is |
|------|------------|
| `web/` | Vite + React customer/vendor/admin web app |
| `tenant-web/` | Next.js edge multi-tenant routing gateway |
| `mobile/` | Expo React Native app (customer/vendor/chef/admin) |
| `backend/` | NestJS API (markets, POS, admin agents) |
| `scripts/` | USDA market seed/import pipelines |
| `docs/supabase/` | SQL migrations and generated market SQL |

## Vendorly migration

- Apply `docs/supabase/phase22_vendorly_marketplace.sql` after prior phase scripts
- Roles: `customer` (legacy `shopper` alias), `vendor`, `chef`, `admin`
- See `docs/VENDORLY_MIGRATION.md` for Phase 1 status

## Priority order each run

1. **Broken UX** — map pins, market detail links, auth bootstrap spinners, role routing
2. **Data quality** — market schedules, dead links, market classification
3. **TypeScript / lint** — `web`: `npm run build`, `tenant-web`: `npm run build --prefix tenant-web`, `mobile`: `npx tsc --noEmit`, `backend`: `npm run build`
4. **Small improvements** — performance, copy, missing null checks

## Workspace validation baseline (`main` @ `f4fd540+`)

Run from repo root **without manual `NODE_ENV` overrides** (shell may be `NODE_ENV=development`).

### Isolated compilation targets

| Command | Expected | Notes |
|---------|----------|-------|
| `npm run build:web` | PASS (exit 0) | 11 code-split lazy chunks → `web/dist/`; **decoupled** from tenant-web (`npm run build --prefix web` only) |
| `npm run build:tenant-web` | PASS (exit 0) | Edge API routes + static prerender; `NODE_ENV=production` pinned in scripts (PR #64) |

### Smoke suite (PR #63 auditors)

| Command | Expected | Notes |
|---------|----------|-------|
| `npm run smoke:ui-baseline` | PASS (exit 0) | 10/10 source checks, 9/9 production markers |
| `npm run smoke:settlement` | PASS_LAZY_CHUNK (exit 0*) | `api.vendorly.app` in lazy vendor/admin chunks; 6 settlement markers in production crawl |

\*UI segment checks report `BLOCKED_AUTH` when `SMOKE_VENDOR_EMAIL` / `SMOKE_VENDOR_PASSWORD` are unset — **expected**, not a regression.

See [`docs/VERCEL_MULTI_PROJECT.md`](docs/VERCEL_MULTI_PROJECT.md) for split-project topology.

## Key commands

```powershell
# Root — isolated builds (see baseline above)
npm run build:web
npm run build:tenant-web

# Root — smoke auditors
npm run smoke:ui-baseline
npm run smoke:settlement

# Root — market data
npm run markets:dedupe
npm run markets:links
npm run markets:classify -- --limit 5
npm run markets:usda:pipeline

# Supabase (manual): phase22 + phase23 + phase32 in docs/supabase/

# Backend (cd backend)
npm run start:dev
npm run markets:classify -- --limit 5

# Web (cd web)
npm run build

# Mobile (cd mobile)
npx tsc --noEmit
```

## Conventions

- Match existing code style; minimal diffs
- Preserve farmers market flows — Vendorly is additive
- Dedupe markets by normalized name + city + state
- Only create git commits when explicitly requested

## Off-LAN / cellular access

See [`docs/OFF_LAN_ACCESS.md`](docs/OFF_LAN_ACCESS.md) — Supabase flows work anywhere; POS/API needs public HTTPS URLs + Vercel deploy for web.

## Agent OS standards

Detailed, scannable conventions live in `agent-os/standards/` (see `agent-os/standards/index.yml`). Before non-trivial work, read the files for the relevant area (`global/`, `web/`, `backend/`, `mobile/`, `database/`, `deploy/`).

## Run summary (required)

End every run with: what you checked, what changed, commands run, what to do next.
