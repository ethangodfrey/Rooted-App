# Production ingress alignment

Canonical gateway targets live in [`deploy/ingress.targets.json`](../deploy/ingress.targets.json).

## Backend (Railway)

| Item | Value |
|------|-------|
| Public host | `api.vendorly.app` |
| Health probe | `GET /api/health` → `STATUS=HEALTH_OK` |
| Container port | `4000` (`PORT`, listen `0.0.0.0`) |
| Restart | `railway restart --service backend` |

DNS: create a **CNAME** for `api.vendorly.app` pointing at the Railway service domain (`*.up.railway.app`). Production variables are declared in `backend/railway.json` / `backend/railway.toml` (`PORT`, `PUBLIC_BASE_URL`).

## Tenant-web (Vercel)

| Item | Value |
|------|-------|
| Public host | `tenant-web-psi.vercel.app` (or custom domain) |
| Readiness probe | `GET /api/health/readiness` |
| Route file | `tenant-web/src/app/api/health/readiness/route.ts` |

Multi-tenant middleware **must not** rewrite `/api/*`. The middleware matcher excludes `api/` so readiness is never rewritten to `/[tenant]/api/health/readiness` (which 404s).

## Operator checks

```bash
cp .env.live.example .env.live
npm run verify:ingress
# Runs scripts/verify-ingress-cutover.ts
# Expect (success):
#   DNS_VERIFIED
#   ROUTING_ALIGNED
#   INGRESS_OK

npm run verify:ingress:align
# Legacy align probe (scripts/verify-ingress.ts)

npm run test:deploy:resilience:live
# With LIVE_SMOKE_BOOT_LOCAL_NEST=0 — fails closed if remote Nest/readiness are down
```

Status vocabulary (text only, no emoji): `INGRESS_OK`, `DNS_VERIFIED`, `ROUTING_ALIGNED`.

Cutover assertions reject localhost targets, HTML catch-all bodies, and JSON that does not match production schemas (`STATUS` + `TIMESTAMP` for Nest health; `STATUS` + `TIMESTAMP` + `CHECKS` for tenant-web readiness).
