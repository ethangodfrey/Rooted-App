# Vercel production project — Vendorly_Marketplace1

**This is the primary Vercel project for the Vendorly customer/vendor web SPA.** Smoke scripts and deploy runbooks target this URL unless noted otherwise.

> **Multi-project layout:** OAuth, nearby markets API, and edge webhooks deploy from **`tenant-web/`** as a **separate** Vercel project — not from this build. See [`VERCEL_MULTI_PROJECT.md`](VERCEL_MULTI_PROJECT.md).

## Canonical production target

| Field | Value |
|-------|--------|
| **Vercel project name** | `Vendorly_Marketplace1` |
| **Git branch** | `main` |
| **Repo** | `ethangodfrey/Rooted-App` |
| **Build** | Repo root + root `vercel.json` (`npm run build --prefix web` → `web/dist`) |
| **Does NOT include** | `tenant-web/` Next.js API routes (separate Vercel project) |

> **Do not** use `vendorly-marketplace`, `vendorly_marketplace`, or `rooted-app` for new production deploys unless you intentionally maintain a staging clone.

## Deploy quota (Hobby plan)

If you hit Vercel’s daily deploy limit, **disconnect Git** on other projects linked to this repo (`vendorly-marketplace`, `rooted-app`, etc.). Only **Vendorly_Marketplace1** should auto-deploy from `main`.

## If phases landed on the wrong Vercel project

Git merges to `main` are correct — Vercel projects are separate deploy targets. Fix the **project link**, not the git history.

### 1. Confirm code on `main`

```bash
git checkout main
git pull origin main
git log --oneline -5
```

You should see merges for PR #48 (fulfillment), PR #49 (security/CORS/settlement), PR #51 (settlement charts), and PR #52 (regional markets RLS) — baseline **`e0ae644`**.

### 2. Point **Vendorly_Marketplace1** at `main`

1. [vercel.com/dashboard](https://vercel.com/dashboard) → open **Vendorly_Marketplace1**
2. **Settings → Git** → connect `ethangodfrey/Rooted-App` if missing
3. **Production Branch** = `main`
4. **Settings → General → Root Directory**:
   - **Empty** (use repo-root `vercel.json`), **or**
   - `web` (uses `web/vercel.json`)
5. **Deployments → Redeploy** latest `main` → **Production**

### 3. Copy environment variables

From the wrong project → **Vendorly_Marketplace1** → **Settings → Environment Variables → Production**:

| Variable | Value |
|----------|--------|
| `VITE_SUPABASE_URL` | `https://ajedyjbdpjahnhzrxwdj.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | *(from Supabase → Settings → API)* |
| `VITE_APP_URL` | `https://vendorly-marketplace1.vercel.app` *(until custom domain)* or `https://vendorlymarketplace.com` |
| `VITE_API_URL` | `https://api.vendorlymarketplace.app` |

Redeploy Production after saving.

### 4. Update Railway CORS for the correct web origin

Railway → API service → Variables:

```env
WEB_APP_URL=https://vendorly-marketplace1.vercel.app
CORS_ORIGINS=https://vendorly-marketplace1.vercel.app,https://vendorlymarketplace.com,https://www.vendorlymarketplace.com
```

*(Replace with your exact **Vendorly_Marketplace1** deployment URL from Vercel → Domains.)*

Redeploy the API.

### 5. Pause or detach the wrong project (optional)

On the mistaken Vercel project:

- **Settings → Git → Disconnect**, or
- Disable **Production** auto-deploys

Prevents future confusion when `main` pushes.

### 6. Verify

```bash
# Web — open Vendorly_Marketplace1 production URL
# Should show fulfillment (/profile/orders), vendor fulfillment (/vendor/fulfillment),
# and vendor analytics settlement charts (/vendor/analytics → Market settlement)

# Supabase + Vercel post-phase41 rollout (phase42 SQL + backfill):
# See docs/POST_PHASE41_RELEASE_RUNBOOK.md

# API CORS + webhooks
API_BASE=https://api.vendorlymarketplace.app npm run smoke:boundaries

# Lazy-chunk-aware UI + settlement baseline
npm run smoke:ui-baseline
npm run smoke:settlement
```

## CLI link (local)

```bash
cd web
npx vercel login
npx vercel link
# Select: Vendorly_Marketplace1
npx vercel --prod
```

## Custom domain

When `vendorlymarketplace.com` should point at **Vendorly_Marketplace1**:

1. Vercel → **Vendorly_Marketplace1** → **Settings → Domains** → add `vendorlymarketplace.com`
2. Remove the domain from other Vercel projects
3. Set `VITE_APP_URL=https://vendorlymarketplace.com` on **Vendorly_Marketplace1** → redeploy
