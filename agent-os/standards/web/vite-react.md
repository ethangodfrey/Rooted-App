# Web (Vite + React)

## Structure

- `web/src/pages/` — route-level pages by role (`shopper/`, `vendor/`, `chef/`, `admin/`, `auth/`)
- `web/src/components/` — shared UI
- `web/src/lib/` — API clients, Supabase, search, geocode, auth helpers
- `web/src/providers/` — React context (e.g. `auth-provider.tsx`)
- Path alias: `@/` → `src/`

## Env vars (build-time)

| Var | Purpose |
|-----|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key |
| `VITE_APP_URL` | OAuth/email redirect base (production) |
| `VITE_API_URL` | NestJS backend (required off LAN) |

Missing Supabase vars must not crash the app — use `isSupabaseConfigured` guards; `createClient` only with real credentials.

## API calls

Use `web/src/lib/api.ts` — attaches Supabase Bearer token, reads `getApiBaseUrl()`. Never hardcode LAN IPs in production builds.

## Markets and search

- Event/market listings from **Supabase** (`events`, `search_all` RPC), not Google Places
- Unified discovery: `web/src/lib/unified-search.ts` → `search_all()` with geo fallback
- Calendar filtering: `web/src/lib/event-day-filter.ts`

## Deploy

Vercel builds from repo root via `vercel.json` (`npm run build --prefix web`). Env vars require redeploy after changes.
