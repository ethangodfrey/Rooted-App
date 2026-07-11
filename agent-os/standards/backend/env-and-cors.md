# Backend env and CORS

## Required (production)

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Supabase **pooler** URI (port 6543) |
| `PUBLIC_BASE_URL` | Public API URL (Railway or `https://api.vendorly.app`) |
| `WEB_APP_URL` | Primary web origin for CORS |
| `CORS_ORIGINS` | Comma-separated extra origins (Vercel URL, www) |
| `SUPABASE_URL` | `https://ajedyjbdpjahnhzrxwdj.supabase.co` |
| `POS_CREDENTIAL_KEY` | Base64 32-byte key — encrypts POS OAuth tokens at rest |

## Redis + POS (production POS sync)

| Variable | Value |
|----------|-------|
| `REDIS_URL` | Upstash `rediss://...` |
| `POS_QUEUES_ENABLED` | `true` |

## CORS behavior

`main.ts` allows: localhost dev ports, `WEB_APP_URL`, `CORS_ORIGINS`, and LAN origins in dev only. Update CORS when Vercel domain changes — redeploy backend.

## Deploy

- **Railway:** Root Directory = `backend`, Dockerfile deploy, health check `/health/live`
- **Not Vercel** — long-running process with queues and cron

See `docs/DEPLOY.md` for full checklist.
