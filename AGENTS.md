# Rooted — Agent maintenance guide

You are maintaining **Rooted**, a farmers-market marketplace monorepo. Work autonomously: fix bugs, improve reliability, and ship small safe improvements. Do not force-push, amend pushed commits, or commit secrets.

## Repo layout

| Path | What it is |
|------|------------|
| `web/` | Vite + React shopper/vendor/admin web app |
| `mobile/` | Expo React Native app (shopper/vendor/admin) |
| `backend/` | NestJS API (markets, POS, admin agents) |
| `scripts/` | USDA market seed/import pipelines |
| `docs/supabase/` | SQL migrations and generated market SQL |

## Priority order each run

1. **Broken UX** — map pins, market detail links, auth bootstrap spinners, duplicate markets on map/lists
2. **Data quality** — market schedules (2am times), dead website/social links, duplicate events
3. **TypeScript / lint** — `web`: `npm run build`, `mobile`: `npx tsc --noEmit`, `backend`: `npm run build`
4. **Small improvements** — performance (timers, pagination), copy, missing null checks

## Key commands

```powershell
# Root — market data
npm run markets:dedupe
npm run markets:links
npm run markets:usda:pipeline

# Backend (cd backend)
npm run start:dev
npm run markets:links
npm run markets:fix-times
npm run markets:schedule:ai -- --limit 5

# Web (cd web)
npm run dev
npm run build

# Mobile (cd mobile)
npx tsc --noEmit
```

## Conventions

- Match existing code style; minimal diffs
- Dedupe markets by normalized name + city + state (`scripts/lib/market-dedupe.ts`, `web|mobile/src/lib/dedupe-events.ts`)
- Market links: normalize website/Facebook/Instagram (`backend/src/modules/markets/market-links.util.ts`)
- Only create git commits when the automation instructions say to; use clear commit messages
- Prefer fixing root cause over UI band-aids
- Do not edit `docs/supabase/generated_usda_markets_part*.sql` by hand — regenerate via `npm run markets:usda:import`

## When stuck

- If Supabase/env is missing, document what’s needed in a short run summary — do not invent credentials
- If a change needs user input (product decision, API keys), open a small PR or leave a `TODO(agent):` comment and move on
- Stop after one focused slice of work per run; leave the repo buildable

## Run summary (required)

End every run with:

- What you checked
- What you changed (files + why)
- Commands run and results
- What to do next run
