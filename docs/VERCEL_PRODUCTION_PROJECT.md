# Vercel production project — Vendorly_Marketplace1

**This is the only Vercel project used for Vendorly web production.** All agents, deploy runbooks, and smoke scripts target this project.

## Canonical production target

| Field | Value |
|-------|--------|
| **Vercel project name** | `Vendorly_Marketplace1` |
| **Git branch** | `main` |
| **Repo** | `ethangodfrey/Rooted-App` |
| **Build** | Repo root + root `vercel.json` (`npm run build --prefix web` → `web/dist`) |

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
| `VITE_APP_URL` | `https://vendorly-marketplace1.vercel.app` *(until custom domain)* or `https://vendorly.app` |
| `VITE_API_URL` | `https://api.vendorly.app` |

Redeploy Production after saving.

### 4. Update Railway CORS for the correct web origin

Railway → API service → Variables:

```env
WEB_APP_URL=https://vendorly-marketplace1.vercel.app
CORS_ORIGINS=https://vendorly-marketplace1.vercel.app,https://vendorly.app,https://www.vendorly.app
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
API_BASE=https://api.vendorly.app npm run smoke:boundaries
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

When `vendorly.app` should point at **Vendorly_Marketplace1**:

1. Vercel → **Vendorly_Marketplace1** → **Settings → Domains** → add `vendorly.app`
2. Remove the domain from other Vercel projects
3. Set `VITE_APP_URL=https://vendorly.app` on **Vendorly_Marketplace1** → redeploy
