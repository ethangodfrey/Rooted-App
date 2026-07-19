# Vercel multi-project architecture

Vendorly uses **multiple Vercel projects** from one GitHub repo (`ethangodfrey/Rooted-App`). Each project has its own root directory, build command, and production URL. They do **not** share a single build pipeline.

## Production topography

| Vercel project | Root directory | Framework | Auto-deploy branch | Production URL | Responsibility |
|----------------|----------------|-----------|-------------------|----------------|----------------|
| **Vendorly_Marketplace1** | *(repo root — empty)* | Vite SPA via root `vercel.json` | `main` | https://vendorly-marketplace1.vercel.app | Customer + vendor + admin web app (`web/`) |
| **tenant-web** *(separate project)* | `tenant-web/` | Next.js App Router | `main` *(manual or dedicated)* | Tenant gateway URL | Edge OAuth (`/api/integration/*`), nearby markets (`/api/markets/nearby`), POS webhooks, checkout ingest |

> **Critical:** `tenant-web/` is **not** bundled into the main `web/` Vite build. Root `vercel.json` runs only `npm run build --prefix web` → `web/dist`. Next.js API routes deploy only when the **tenant-web** Vercel project builds.

### Legacy / staging projects (do not use for production)

Disconnect Git auto-deploy on these unless you intentionally maintain clones:

- `vendorly-marketplace`
- `vendorly_marketplace`
- `rooted-app`

See [`VERCEL_PRODUCTION_PROJECT.md`](VERCEL_PRODUCTION_PROJECT.md).

---

## Build targets (local + CI)

```bash
# Main production web SPA (Vendorly_Marketplace1)
npm run build:web
# equivalent: npm run build --prefix web

# Tenant edge gateway (separate Vercel project)
npm run build:tenant-web
# equivalent: npm run build --prefix tenant-web

# Root package.json does NOT build web or tenant-web by default (market scripts only)
```

---

## Environment variable mapping

### Vendorly_Marketplace1 (`web/`)

Set in Vercel → **Vendorly_Marketplace1** → Environment Variables → **Production**:

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_API_URL` | NestJS API (`https://api.vendorlymarketplace.app`) — **required for production builds** (`web/scripts/verify-build-env.mjs`) |
| `VITE_APP_URL` | Public web origin |
| `VITE_TENANT_WEB_URL` | *(optional)* Base URL for tenant-web APIs; falls back to Supabase RPC if unset |

Local dev: copy `web/.env.example` → `web/.env`.

### tenant-web (separate project)

Set in Vercel → **tenant-web project** → Environment Variables:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | DB + OAuth upserts |
| `INTEGRATION_OAUTH_BASE_URL` | OAuth callback base |
| `POS_OAUTH_STATE_SECRET` | Signed OAuth state |
| Square / Clover credentials | Provider token exchange |

See `tenant-web/.env.example`.

---

## Lazy-loaded bundle audit (smoke tests)

The Vite production build code-splits vendor and admin routes into lazy chunks:

- Entry HTML loads `index-*.js` + `react-vendor-*.js` only.
- `api.vendorlymarketplace.app`, settlement charts, and POS ledger strings live in **`vendor-pages-*.js`** and **`admin-pages-*.js`**.

Smoke scripts **must crawl lazy chunks**, not only entry assets. Otherwise `VITE_API_URL` and settlement markers falsely report `FAIL`.

Shared crawler: `scripts/lib/bundle-chunk-audit.mjs`

```bash
npm run smoke:settlement          # post-deploy settlement + env audit
npm run smoke:ui-baseline       # source tree + production marker sanity check
```

### Documented smoke exception

| Check | Entry-only scan | Lazy-chunk crawl | Pass rule |
|-------|-----------------|------------------|-----------|
| `VITE_API_URL` / `api.vendorlymarketplace.app` | Often **absent** in `index-*.js` | **Present** in `vendor-pages` / `admin-pages` | **PASS** when `apiUrlPresent: true` even if `apiUrlInEntryChunks: false` |

---

## Deploy checklist

1. Merge to `main` → **Vendorly_Marketplace1** auto-deploys (confirm in Vercel dashboard).
2. Deploy **tenant-web** separately when OAuth or `/api/markets/nearby` changes.
3. Run verification:

```bash
npm run smoke:ui-baseline
npm run smoke:settlement
API_BASE=https://api.vendorlymarketplace.app npm run smoke:boundaries
```

---

## Related docs

- [`VERCEL_PRODUCTION_PROJECT.md`](VERCEL_PRODUCTION_PROJECT.md) — canonical web production project
- [`DEPLOY.md`](DEPLOY.md) — full web + backend deploy runbook
- [`OFF_LAN_ACCESS.md`](OFF_LAN_ACCESS.md) — cellular / tunnel access
