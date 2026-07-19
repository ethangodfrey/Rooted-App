# Production deploy

## Architecture

| Component | Host | URL |
|-----------|------|-----|
| Web SPA | Vercel **`Vendorly_Marketplace1`** | `vendorly-marketplace1.vercel.app` → `vendorlymarketplace.com` |
| Tenant edge gateway | Vercel **`tenant-web`** project | Separate deploy; root `tenant-web/` |
| Backend API | Railway | `api.vendorlymarketplace.app` → service port `4000` (`/api/health`) |
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

Deterministic pass/fail matrix for repo-root validation. **No manual shell `NODE_ENV` override** — tenant-web scripts pin production internally.

### Pass/fail matrix

| Layer | Command | Pass | Fail |
|-------|---------|------|------|
| Web SPA build | `npm run build:web` | exit 0; 11 lazy chunks in `web/dist/` | non-zero exit; TypeScript or Vite errors |
| Tenant gateway build | `npm run build:tenant-web` | exit 0; API routes + static prerender (incl. `/404`) | non-zero exit; Next.js prerender or type errors |
| UI baseline smoke | `npm run smoke:ui-baseline` | exit 0; 10/10 source nodes, 9/9 production markers | missing markers or source regressions |
| Settlement smoke | `npm run smoke:settlement` | `PASS_LAZY_CHUNK`; settlement matrices in production crawl | `api.vendorlymarketplace.app` absent from all chunks |
| Settlement UI (optional) | `npm run smoke:settlement` | `BLOCKED_AUTH` when smoke creds unset — **expected, not fail** | treat auth gate as regression only if bundle/env checks also fail |

### Structural constraints

- **`build:web`** must remain `npm run build --prefix web` only — Vite (`web/`) never bundles or inherits Next.js (`tenant-web/`) env.
- **`build:tenant-web`** carries its own `NODE_ENV=production` pin; do not add tenant env leakage to the web build path.

### Smoke auditors (quick reference)

| Script | Expected |
|--------|----------|
| `npm run smoke:ui-baseline` | exit 0 — 10/10 source, 9/9 production markers |
| `npm run smoke:settlement` | `PASS_LAZY_CHUNK` — lazy-chunk API URL + settlement matrices |

Unset `SMOKE_VENDOR_EMAIL` / `SMOKE_VENDOR_PASSWORD` → settlement UI segments report `BLOCKED_AUTH` (safe expected state).

## Smoke test (manual / deploy)

- `/` and `/login` on web
- Deep route refresh (no 404)
- Vendor POS page (confirms `VITE_API_URL` + CORS)
- `/health/live` on backend
