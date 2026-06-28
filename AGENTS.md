# Vendorly Marketplace — Agent maintenance guide

You are maintaining **Vendorly Marketplace** (formerly Rooted), a local food marketplace monorepo. Work autonomously: fix bugs, improve reliability, and ship small safe improvements. Do not force-push, amend pushed commits, or commit secrets.

## Repo layout

| Path | What it is |
|------|------------|
| `web/` | Vite + React customer/vendor/admin web app |
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
3. **TypeScript / lint** — `web`: `npm run build`, `mobile`: `npx tsc --noEmit`, `backend`: `npm run build`
4. **Small improvements** — performance, copy, missing null checks

## Key commands

```powershell
# Root — market data
npm run markets:dedupe
npm run markets:links
npm run markets:classify -- --limit 5
npm run markets:usda:pipeline

# Supabase (manual): phase22 + phase23 in docs/supabase/

# Backend (cd backend)
npm run start:dev
npm run markets:classify -- --limit 5

# Web (cd web)
npm run dev
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
