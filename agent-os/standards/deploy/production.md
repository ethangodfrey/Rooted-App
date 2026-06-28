# Production deploy

## Architecture

| Component | Host | URL |
|-----------|------|-----|
| Web SPA | Vercel | `vendorlymarketplace.vercel.app` → `vendorly.app` |
| Backend API | Railway | `api.vendorly.app` (or `*.up.railway.app`) |
| Database + Auth | Supabase | `ajedyjbdpjahnhzrxwdj.supabase.co` |

## Web (Vercel)

- Root `vercel.json` — `npm run build --prefix web`, output `web/dist`
- Set all `VITE_*` env vars → **redeploy** (baked at build time)
- Blank white page = missing `VITE_SUPABASE_*` at build (see `web/src/lib/supabase.ts`)

## Backend (Railway)

- Root Directory: **`backend`** (not repo root, not `web`)
- Dockerfile deploy, health check `/health/live`
- See `backend/.env.example` and `docs/DEPLOY.md` §2

## Off-LAN

Supabase auth/data works anywhere. POS and proxied API features need public HTTPS — see `docs/OFF_LAN_ACCESS.md`.

## Smoke test

- `/` and `/login` on web
- Deep route refresh (no 404)
- Vendor POS page (confirms `VITE_API_URL` + CORS)
- `/health/live` on backend
