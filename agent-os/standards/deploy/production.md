# Production deploy

## Architecture

| Component | Host | URL |
|-----------|------|-----|
| Web SPA | Vercel **`Vendorly_Marketplace1`** | `vendorly-marketplace1.vercel.app` → `vendorly.app` |
| Tenant edge gateway | Vercel **`tenant-web`** project | Separate deploy; root `tenant-web/` |
| Backend API | Railway | `api.vendorly.app` (or `*.up.railway.app`) |
| Database + Auth | Supabase | `ajedyjbdpjahnhzrxwdj.supabase.co` |

See `docs/VERCEL_MULTI_PROJECT.md` for split-project build targets.

## Web (Vercel — Vendorly_Marketplace1 only)

- Root `vercel.json` — `npm run build --prefix web`, output `web/dist`
- **`tenant-web/` is isolated** — deploy via separate Vercel project (`npm run build --prefix tenant-web`)
- Set all `VITE_*` env vars → **redeploy** (baked at build time)
- Blank white page = missing `VITE_SUPABASE_*` at build (see `web/src/lib/supabase.ts`)

## Backend (Railway)

- Root Directory: **`backend`** (not repo root, not `web`)
- Dockerfile deploy, health check `/health/live`
- See `backend/.env.example` and `docs/DEPLOY.md` §2

## Off-LAN

Supabase auth/data works anywhere. POS and proxied API features need public HTTPS — see `docs/OFF_LAN_ACCESS.md`.

## Workspace validation baseline (`f4fd540+`)

No manual shell `NODE_ENV` override required. Scripts pin production for tenant-web builds.

### Builds (repo root)

| Target | Command | Expected |
|--------|---------|----------|
| Web SPA | `npm run build:web` | exit 0 — 11 lazy chunks in `web/dist/` |
| Tenant gateway | `npm run build:tenant-web` | exit 0 — API routes + static prerender |

**Constraint:** `build:web` must stay `npm run build --prefix web` only — never bundle tenant-web into the Vite pipeline.

### Smoke auditors

| Script | Expected |
|--------|----------|
| `npm run smoke:ui-baseline` | exit 0 — 10/10 source, 9/9 production markers |
| `npm run smoke:settlement` | `PASS_LAZY_CHUNK` — `api.vendorly.app` in lazy chunks; settlement matrices in production crawl |

`BLOCKED_AUTH` on settlement UI segments without `SMOKE_VENDOR_EMAIL` / `SMOKE_VENDOR_PASSWORD` is expected.

## Smoke test (manual / deploy)

- `/` and `/login` on web
- Deep route refresh (no 404)
- Vendor POS page (confirms `VITE_API_URL` + CORS)
- `/health/live` on backend
