# Post-PR #49 production alignment checklist

Use this after merging security/CORS/settlement hardening into `main`.

## 1. Merge (already done if on `929ecf2`)

```bash
gh pr ready 49
gh pr merge 49 --merge --delete-branch
git checkout main
git pull origin main
```

## 2. Railway — backend production variables

**Dashboard:** [railway.app](https://railway.app) → Vendorly API service → **Variables**

Set or confirm:

| Variable | Production value |
|----------|------------------|
| `NODE_ENV` | `production` |
| `PUBLIC_BASE_URL` | `https://api.vendorly.app` |
| `WEB_APP_URL` | `https://vendorly.app` |
| `CORS_ORIGINS` | `https://vendorly-marketplace1.vercel.app,https://vendorly.app,https://www.vendorly.app` |
| `DATABASE_URL` | Supabase pooler URI (port 6543) |
| `SUPABASE_URL` | `https://ajedyjbdpjahnhzrxwdj.supabase.co` |
| `STRIPE_WEBHOOK_SECRET` | From Stripe Dashboard → Webhooks |
| `STRIPE_SECRET_KEY` | Stripe API secret |

**Notes:**
- `assertProductionEnv` blocks startup without `DATABASE_URL`, `PUBLIC_BASE_URL`, `WEB_APP_URL`, `SUPABASE_URL`.
- HTTPS `*.vendorly.app` subdomains are auto-allowed even if omitted from `CORS_ORIGINS`.
- After saving variables → **Deploy** / redeploy the service.

## 3. Vercel — frontend production variables

**Canonical project:** **`Vendorly_Marketplace1`** (not `vendorly-marketplace` / `rooted-app`).  
See [`docs/VERCEL_PRODUCTION_PROJECT.md`](VERCEL_PRODUCTION_PROJECT.md) if phases deployed to the wrong project.

**Dashboard:** **Vendorly_Marketplace1** → **Settings** → **Environment Variables** → **Production**

| Variable | Required value |
|----------|----------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_APP_URL` | `https://vendorly.app` |
| `VITE_API_URL` | `https://api.vendorly.app` |

`web/scripts/verify-build-env.mjs` **blocks Production builds** when `VITE_API_URL` is missing or not HTTPS.

Redeploy Production after any env change.

## 4. Boundary smoke test

Against your live API (custom domain or Railway `*.up.railway.app`):

```bash
API_BASE=https://api.vendorly.app npm run smoke:boundaries
# or temporary Railway URL:
API_BASE=https://YOUR-SERVICE.up.railway.app npm run smoke:boundaries
```

**Expected:**
- Unauthorized `Origin` → no `Access-Control-Allow-Origin`
- `https://vendorly.app` and `https://shop.vendorly.app` → ACAO matches origin
- `GET /health/live` without Origin → `200`
- `POST /webhooks/stripe` with bad signature → `{ ok: false, error: "invalid_signature" }` (or `webhook_not_configured` if Stripe secret unset), **no stack/SQL in body**

## 5. Local production-mode verification (no DNS required)

```bash
cd backend && npm run build
NODE_ENV=production \
  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rooted \
  PUBLIC_BASE_URL=http://127.0.0.1:4000 \
  WEB_APP_URL=https://vendorly.app \
  SUPABASE_URL=https://ajedyjbdpjahnhzrxwdj.supabase.co \
  STRIPE_SECRET_KEY=sk_test_smoke \
  STRIPE_WEBHOOK_SECRET=whsec_smoke \
  npm run start:prod
```

In another terminal:

```bash
API_BASE=http://127.0.0.1:4000 npm run smoke:boundaries
```
