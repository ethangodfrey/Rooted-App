# Vendorly production deployment

Actionable checklist for deploying **web** (Vercel) and **backend** (Docker host) so shoppers, vendors, and mobile work off LAN / on cellular.

| Component | Host | URL |
|-----------|------|-----|
| Web (Vite SPA) | Vercel | `https://vendorly.app` |
| Backend (NestJS) | Railway *(recommended)* or Render / Fly / VPS | `https://api.vendorly.app` |
| Database + auth | Supabase | `https://ajedyjbdpjahnhzrxwdj.supabase.co` |

Related: [`OFF_LAN_ACCESS.md`](OFF_LAN_ACCESS.md) (what needs a public API), [`web/README.md`](../web/README.md) (OAuth), [`docs/SQUARE_SETUP.md`](SQUARE_SETUP.md) (POS).

---

## Ship without backend (free tier)

You can deploy **web to Vercel + Supabase only** and skip Railway until you have paid Supabase (IPv4) and a working `DATABASE_URL`. Most of the product runs on Supabase; the NestJS backend is optional for now.

### Vercel env vars (minimum)

| Variable | Required? | Value |
|----------|-----------|-------|
| `VITE_SUPABASE_URL` | **Yes** | `https://ajedyjbdpjahnhzrxwdj.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | Supabase → Settings → API → anon public |
| `VITE_APP_URL` | **Yes** | `https://vendorly.app` or your `*.vercel.app` URL |
| `VITE_API_URL` | **No — omit** | Do not set until backend is deployed |

**Important:** If `VITE_API_URL` is set to a broken or unreachable API, admin pages will show connection errors and the browser may log failed health checks. Leave it unset for Supabase-only mode.

After changing env vars, **Redeploy** (values are baked in at build time).

### What works without backend

| Feature | Works? |
|---------|--------|
| Sign up / sign in / OAuth | Yes (Supabase) |
| Discover, map, events, feed | Yes (Supabase) |
| Reservations, orders, products | Yes (Supabase) |
| Vendor dashboard (non-POS) | Yes (Supabase) |
| Admin vendor/event moderation (manual) | Yes (Supabase) |
| Analytics (reservations + in-person) | Yes (Supabase) |
| Market card photos (emoji placeholders) | Yes — proxied photos deferred |
| Square POS connect/sync | Deferred |
| Admin AI agent buttons | Hidden |
| POS card-sales in analytics | Deferred |

### Deferred until paid Supabase + Railway

1. **Supabase paid plan** — IPv4 add-on or direct connection so Railway can reach Postgres (fixes Prisma P1000 / pooler auth issues on free tier).
2. **Railway backend** — set `DATABASE_URL`, `REDIS_URL` (Upstash), deploy from `backend/Dockerfile`.
3. **Then** add `VITE_API_URL=https://api.vendorly.app` in Vercel and `EXPO_PUBLIC_API_URL` for mobile → redeploy.

See §2 below for full backend setup when ready.

**Mobile (EAS):** [`mobile/BUILD.md`](../mobile/BUILD.md) — preview/production builds with Supabase-only env (no backend).

---

## Before you start

### GitHub repo

Remote: `https://github.com/ethangodfrey/Rooted-App.git` (branch `main`).

Vercel and Railway import from GitHub. If you have local-only changes, commit and push first:

```powershell
cd C:\Users\ethan\OneDrive\Desktop\Rooted
git add -A
git commit -m "Your message"
git push origin main
```

`gh` CLI is optional; install from [cli.github.com](https://cli.github.com/) if you want `gh repo view` / `gh pr create`.

### Local validation (no credentials needed)

```powershell
# Web — must pass before Vercel deploy (either path works)
cd C:\Users\ethan\OneDrive\Desktop\Rooted
npm install --prefix web
npm run build --prefix web   # same command root vercel.json uses (Option B)

# Or from web/ directly (Option A)
cd web
npm install
npm run build

# Backend — optional smoke (needs .env with DATABASE_URL)
cd ..\backend
npm install
npm run build
```

Web build verified: `npm run build --prefix web` from repo root outputs `web/dist/` (Option B) or `npm run build` in `web/` outputs `dist/` (Option A).

Vercel CLI (requires your login — we do **not** deploy for you):

```powershell
cd web
npx vercel login
npx vercel whoami
npx vercel link
# npx vercel --prod   # only after env vars are set in dashboard or CLI
```

---

## 1. Deploy web to Vercel

This repo is a monorepo: the Vite app lives in **`web/`**, not at the repo root. Pick **one** deploy approach below.

### Where is “Root Directory” in Vercel?

Vercel only shows **Root Directory** in certain flows. Look in these places:

| When | Where to find it |
|------|------------------|
| **First import** ([vercel.com/new](https://vercel.com/new)) | On the “Configure Project” screen, **Edit** link next to the project name (above Framework Preset). Click **Edit** → set path to `web` or leave empty. |
| **Existing project** | **Project → Settings → General** → scroll to **Root Directory** → **Edit** → enter `web` or clear to use repo root. |
| **You don’t see the field at all** | Use **Option B** below — leave Root Directory unset/empty and rely on the checked-in repo-root **`vercel.json`**. No dashboard field required. |

If Root Directory is empty **and** there is no root `vercel.json`, Vercel auto-detects Vite at repo root, runs bare **`vite build`**, and fails with **exit 127** (`vite: command not found`) because Vite lives in `web/package.json`, not the root.

### Option A — Root Directory = `web` (dashboard subfolder)

1. Set **Root Directory** to **`web`** (import screen **Edit**, or **Settings → General**).
2. Vercel reads **`web/vercel.json`**.

| Dashboard setting | Value |
|-------------------|-------|
| Root Directory | **`web`** |
| Framework Preset | **Vite** (or Other) |
| Build Command | **`npm run build`** (not `vite build`) |
| Output Directory | **`dist`** |
| Install Command | **`npm install`** |

### Option B — no Root Directory (repo root + `vercel.json`) — use when you can’t find the field

1. Leave **Root Directory empty** (repo root). Do **not** set it to `web`.
2. Push latest `main` so the repo-root **`vercel.json`** is present. It overrides install/build/output:

   ```json
   {
     "installCommand": "npm install --prefix web",
     "buildCommand": "npm run build --prefix web",
     "outputDirectory": "web/dist",
     "framework": null,
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```

3. **Project → Settings → Build & Development Settings** — turn **off** overrides (or leave defaults). Let **`vercel.json`** drive the build. Do **not** set Build Command to `vite build`.

| Dashboard setting | Value (Option B) |
|-------------------|------------------|
| Root Directory | **empty** / not set |
| Framework Preset | **Other** or **None** (avoid Vite preset at repo root) |
| Build Command | *(leave default — `vercel.json` sets `npm run build --prefix web`)* |
| Output Directory | *(leave default — `vercel.json` sets `web/dist`)* |
| Install Command | *(leave default — `vercel.json` sets `npm install --prefix web`)* |

**Redeploy (Option B):**

1. Confirm root `vercel.json` is on the branch Vercel builds (usually `main`).
2. **Deployments** → latest deploy → **⋯ → Redeploy** → check **Use existing Build Cache** off if the last build used wrong commands.
3. Build log should show `npm run build --prefix web`, not `vite build`. Output should list files under `web/dist`.

### Step-by-step (dashboard)

1. Go to [vercel.com/new](https://vercel.com/new) and sign in with GitHub.
2. **Import** `ethangodfrey/Rooted-App`.
3. Choose **Option A** or **Option B** above (Option B if Root Directory is missing or confusing).
4. Confirm build settings match the table for your option.

   **Dashboard fix if you see `Command "vite build" exited with 127`:**

   - **Option A:** **Settings → General → Root Directory** → **`web`** → Save. **Build & Development Settings** → Build = **`npm run build`**, Output = **`dist`**, Framework = **Vite**.
   - **Option B:** Clear Root Directory. Ensure root **`vercel.json`** is on `main`. Disable Build Command override so `npm run build --prefix web` runs. Redeploy.

   Push latest `main` if the deploy log shows an old commit (e.g. “Initial commit”) — the project may be linked to stale code without root or `web/vercel.json`.

5. Add **Environment Variables** for **Production** (and Preview if you want PR previews):

   | Variable | Value | Notes |
   |----------|-------|-------|
   | `VITE_SUPABASE_URL` | `https://ajedyjbdpjahnhzrxwdj.supabase.co` | Same as mobile |
   | `VITE_SUPABASE_ANON_KEY` | *(Supabase → Settings → API → anon public)* | Never commit |
   | `VITE_APP_URL` | `https://vendorly.app` | Or `https://your-project.vercel.app` until DNS is ready |
   | `VITE_API_URL` | *(omit for Supabase-only)* | Optional — set to deployed backend URL when Railway is live |

6. Click **Deploy**.
7. After deploy, open the site and hard-refresh. Env vars are baked in at **build** time — change them → **Redeploy**.

### CLI alternative

```powershell
cd web
npx vercel login
npx vercel link
npx vercel env add VITE_SUPABASE_URL production
npx vercel env add VITE_SUPABASE_ANON_KEY production
npx vercel env add VITE_APP_URL production
# Optional — skip until backend is deployed:
# npx vercel env add VITE_API_URL production
npx vercel --prod
```

### Custom domain `vendorly.app`

1. Vercel → **Project → Settings → Domains** → add `vendorly.app` and optionally `www.vendorly.app`.
2. At your DNS registrar, add the records Vercel shows (typically `A` / `CNAME` to Vercel).
3. Wait for SSL (usually a few minutes).
4. Set `VITE_APP_URL=https://vendorly.app` in Vercel env → **Redeploy**.
5. Add `https://www.vendorly.app` to backend `CORS_ORIGINS` if you use www (see §2).

### Post-deploy smoke test

- `/` — landing page
- `/login` — Supabase auth
- `/auth/callback` — OAuth return
- Refresh a deep route (e.g. `/shopper/explore`) — must not 404 (SPA rewrite in `vercel.json`)
- Vendor **POS** page — confirms `VITE_API_URL` reaches backend (after §2)

---

## 2. Deploy backend (NestJS + Docker)

### Platform recommendation: **Railway**

| Platform | Verdict |
|----------|---------|
| **Railway** | **Best fit** — native Dockerfile deploy, custom domain, env vars, health checks. Use Supabase Postgres + Upstash Redis (already documented in `backend/.env.example`). |
| Render | Good alternative — Docker web service, similar flow. See `backend/render.yaml`. |
| Fly.io | Fine for global edge; more `fly.toml` setup. Same Dockerfile. |
| Docker VPS | Full control; you manage TLS (Caddy/nginx), updates, and monitoring. |

The backend is a **long-running Node process** (POS queues, cron, webhooks). It is **not** suited for Vercel serverless as the primary host.

### Architecture

```
Browser / mobile  →  Vercel (web)     → Supabase (auth, marketplace data)
                   →  api.vendorly.app → NestJS (POS, Stripe webhooks, market photo proxy, admin AI)
Database          →  Supabase Postgres (DATABASE_URL pooler URL)
Job queues        →  Upstash Redis (REDIS_URL, POS_QUEUES_ENABLED=true)
```

### Railway — step-by-step

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → select `Rooted-App`.
2. Add a service → **Dockerfile** deploy.
3. **Settings → Root Directory:** `backend`.
4. **Settings → Networking → Generate Domain** (temporary `*.up.railway.app` URL).
5. **Settings → Networking → Custom Domain** → add `api.vendorly.app` → add the CNAME Railway shows at your DNS provider.
6. **Variables** — set at minimum (see tables below). Railway injects `PORT`; the app listens on `0.0.0.0:${PORT}`.
7. **Settings → Deploy → Health Check Path:** `/health/live` (liveness; always 200 when process is up).
8. Deploy. When healthy, verify:

   ```powershell
   curl https://api.vendorly.app/health/live
   # {"status":"ok","uptime":...}

   curl https://api.vendorly.app/health/ready
   # 200 when DATABASE_URL (+ Redis if queues enabled) are reachable
   ```

Optional quick-start: `backend/railway.toml` is checked in for health-check defaults.

### Render alternative

1. [render.com](https://render.com) → **New → Blueprint** or **Web Service** from repo.
2. Root directory `backend`, environment **Docker**.
3. Health check path: `/health/live`.
4. Use `backend/render.yaml` as a reference (set secrets in the Render dashboard, not in the file).

### Required backend environment variables

Copy from `backend/.env.example`. **Never commit** real values.

#### Core (required for any production deploy)

| Variable | Production value | Notes |
|----------|------------------|-------|
| `NODE_ENV` | `production` | |
| `PORT` | `4000` | Railway/Render set this automatically |
| `DATABASE_URL` | Supabase **pooler** URI | Dashboard → Settings → Database → Connection string (Transaction mode, port 6543) |
| `PUBLIC_BASE_URL` | `https://api.vendorly.app` | Public API URL |
| `WEB_APP_URL` | `https://vendorly.app` | Primary CORS origin |
| `CORS_ORIGINS` | `https://vendorly.app,https://www.vendorly.app,https://YOUR-PROJECT.vercel.app` | Comma-separated extras (Vercel preview URL until custom domain) |
| `SUPABASE_URL` | `https://ajedyjbdpjahnhzrxwdj.supabase.co` | JWKS token verification |
| `POS_CREDENTIAL_KEY` | *(base64 32-byte key)* | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |

#### Redis + POS queues (required for production POS sync)

| Variable | Production value |
|----------|------------------|
| `REDIS_URL` | Upstash TCP URL (`rediss://...`) |
| `POS_QUEUES_ENABLED` | `true` |

Without Redis, POS sync runs inline in dev only; production should use Upstash (see comment in `.env.example`).

#### POS / OAuth (when using Square etc.)

| Variable | Production value |
|----------|------------------|
| `POS_PROVIDER_BASE_URL` | Usually **omit** — falls back to `PUBLIC_BASE_URL` when HTTPS |
| `APP_DEEP_LINK` | `vendorly://pos/connected` |
| `SQUARE_*` / `TOAST_*` / `CLOVER_*` | Provider sandbox or production credentials |

Register Square OAuth redirect: `https://api.vendorly.app/pos/oauth/square/callback`  
Register webhooks: `https://api.vendorly.app/pos/webhooks/square` — see [`SQUARE_SETUP.md`](SQUARE_SETUP.md).

#### Stripe (if Phase 32 enabled)

| Variable | Notes |
|----------|-------|
| `STRIPE_SECRET_KEY` | Dashboard → Developers → API keys |
| `STRIPE_PUBLISHABLE_KEY` | |
| `STRIPE_WEBHOOK_SECRET` | Endpoint URL: `https://api.vendorly.app/stripe/webhooks` |

#### Optional agents / markets (off by default)

| Variable | Default | Enable when |
|----------|---------|-------------|
| `MARKETS_AGENT_ENABLED` | `false` | Running discovery cron in cloud |
| `ADMIN_VENDOR_AGENT_ENABLED` | `false` | Nightly vendor triage |
| `ADMIN_POST_AGENT_ENABLED` | `false` | Post moderation cron |
| `OPENAI_API_KEY` | — | Any AI feature above |

### Health endpoints

| Path | Purpose | Use for |
|------|---------|---------|
| `/health/live` | Process up | Railway/Render/Fly load balancer, Dockerfile `HEALTHCHECK` |
| `/health/ready` or `/health` | DB (+ Redis if queues on) | Readiness; returns **503** if dependencies down |

### CORS checklist

After Vercel domain is known, set on the backend and **redeploy**:

```env
WEB_APP_URL=https://vendorly.app
CORS_ORIGINS=https://vendorly.app,https://www.vendorly.app,https://rooted-app.vercel.app
PUBLIC_BASE_URL=https://api.vendorly.app
```

Without this, browser calls from the production site to `VITE_API_URL` fail with CORS errors.

---

## 3. Supabase configuration

Project: `ajedyjbdpjahnhzrxwdj.supabase.co`

### Authentication → URL Configuration

| Field | Value |
|-------|-------|
| **Site URL** | `https://vendorly.app` (or Vercel URL until DNS ready) |
| **Redirect URLs** | Add each line below |

```
https://vendorly.app/auth/callback
https://vendorly.app/auth/reset-password
https://vendorly.app/**
https://YOUR-PROJECT.vercel.app/auth/callback
https://YOUR-PROJECT.vercel.app/**
vendorly://auth/callback
```

### Google OAuth

Google Cloud → OAuth client → **Authorized redirect URI** stays Supabase’s callback (not your web app):

```
https://ajedyjbdpjahnhzrxwdj.supabase.co/auth/v1/callback
```

### Mobile auth redirect HTML

1. Run `docs/supabase/phase1_storage_auth_redirect.sql` if not already applied.
2. Upload `docs/supabase/auth-redirect.html` to Storage bucket `auth` as `auth-redirect.html`.
3. Use the public URL in mobile env (see §4).

### SQL migrations

Apply phase scripts in order through your latest phase (e.g. `phase22_vendorly_marketplace.sql`, `phase32_stripe_messaging.sql`) via Supabase SQL editor before enabling matching backend features.

---

## 4. Mobile app (EAS / Expo)

In `mobile/.env` or **EAS Secrets** for production builds:

| Variable | Production value |
|----------|------------------|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://ajedyjbdpjahnhzrxwdj.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Same anon key as web |
| `EXPO_PUBLIC_API_URL` | `https://api.vendorly.app` |
| `EXPO_PUBLIC_AUTH_REDIRECT_URL` | `https://ajedyjbdpjahnhzrxwdj.supabase.co/storage/v1/object/public/auth/auth-redirect.html` |

Do **not** use LAN IPs (`192.168.x.x`, `10.x.x.x`) for off-LAN / store builds.

After changing env: `npx expo start --clear` (dev) or rebuild with EAS (production).

---

## 5. End-to-end verification

Run on **cellular or off home Wi‑Fi**:

| # | Test | Expected |
|---|------|----------|
| 1 | Open `https://vendorly.app` | Site loads |
| 2 | Sign in | Supabase auth succeeds |
| 3 | Browse map / events / reserve | Works (Supabase-only) |
| 4 | `curl https://api.vendorly.app/health/live` | `{"status":"ok",...}` |
| 5 | Vendor → POS connect | Reaches API (HTTPS) |
| 6 | Event photos via API proxy | Load if `VITE_API_URL` / `EXPO_PUBLIC_API_URL` set |
| 7 | Mobile app with production env | Same as web for auth + API |

---

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| OAuth redirect error | Missing Supabase redirect URL | Add URLs in §3 |
| CORS error in browser console | Backend missing web origin | Update `WEB_APP_URL` / `CORS_ORIGINS`, redeploy API |
| POS OAuth fails | HTTP callback URL | `PUBLIC_BASE_URL` must be `https://...` |
| `/health/ready` 503 | Bad `DATABASE_URL` or Redis | Check Supabase pooler URL; Upstash `REDIS_URL` |
| Prisma `Can't reach … db.*:6543` | Pooler port on direct host | Use `*.pooler.supabase.com:6543` (transaction) or `db.*:5432` (direct) — not both |
| Prisma **P1000** / SASL auth failed | Stale or wrong DB password | Supabase → Database → reset password → wait 2–3 min → paste fresh Transaction pooler URI |
| Web still hits LAN API | Stale build | Set `VITE_API_URL` in Vercel → Redeploy |
| Vercel 404 on refresh | Wrong root / missing rewrite | Option A: Root = `web`; Option B: root `vercel.json` rewrites to `/index.html` in `web/dist` |
| **`vite build` exited with 127** | Building repo root; `vite` not installed there | **Option B (easiest):** leave Root Directory empty, push root `vercel.json`, redeploy. **Option A:** Root Directory = **`web`**, Build = **`npm run build`**, redeploy |
| Deploy shows old commit | Stale Git link or wrong branch | Reconnect repo; push latest `main`; Redeploy |
| **Blank white page** (`#root` empty, console may show `supabaseUrl is required`) | Missing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` at **build** time | Vercel → **Project → Settings → Environment Variables** → add both for **Production** → **Deployments → Redeploy** (env vars are baked into the JS bundle; changing them requires a new build) |

---

## Files in this repo

| File | Purpose |
|------|---------|
| `vercel.json` | Monorepo fallback when Root Directory is repo root |
| `web/vercel.json` | Vite build + SPA rewrites (when Root Directory = `web`) |
| `web/.env.example` | Web env template |
| `backend/Dockerfile` | Production container (multi-stage, health check) |
| `backend/.env.example` | Full backend env reference |
| `backend/railway.toml` | Railway health-check defaults |
| `backend/render.yaml` | Render blueprint reference |
| `docs/OFF_LAN_ACCESS.md` | Feature matrix for LAN vs cloud |

---

## Run summary template

After deploying, note:

- [ ] Web URL live on Vercel
- [ ] `vendorly.app` DNS + SSL
- [ ] `api.vendorly.app` DNS + `/health/live` OK
- [ ] Supabase redirect URLs updated
- [ ] Backend CORS includes production web URL(s)
- [ ] Mobile / EAS secrets updated
- [ ] Square / Stripe webhook URLs registered (if used)
