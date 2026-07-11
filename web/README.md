# Vendorly Website

Marketing site + full web app for Vendorly — customers, vendors, and chefs can sign in and use the same Supabase backend as the mobile app.

## Stack

- Vite + React + TypeScript
- React Router
- Supabase Auth + Postgres (same project as `mobile/`)

## Setup

1. Copy env vars from the mobile app:

```powershell
cd web
copy .env.example .env
```

2. Add your Supabase credentials to `web/.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL=http://localhost:5173
```

Use the same values as `mobile/.env` (`EXPO_PUBLIC_SUPABASE_*`).

3. In **Supabase Dashboard → Authentication → URL Configuration**, add redirect URLs:

- `http://localhost:5173/auth/callback`
- `http://localhost:5173/auth/reset-password`
- Your production domain equivalents when deployed

4. **Google & Apple sign-in** (optional but recommended):

See [Google OAuth setup checklist](#google-oauth-setup-checklist) below.

- **Apple:** configure Services ID + key in Apple Developer; add Supabase callback URL from the Apple provider panel.

### Google OAuth setup checklist

Use this when Google sign-in shows a raw Supabase error like `Unsupported provider: provider is not enabled` or `validation_failed`.

**1. Enable Google in Supabase**

- Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **Providers** → **Google**
- Toggle **Enable Sign in with Google**

**2. Create Google OAuth credentials**

- [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
- Create **OAuth 2.0 Client ID** (type **Web application**)
- **Authorized redirect URI** — add exactly (replace with your project ref):

  ```
  https://ajedyjbdpjahnhzrxwdj.supabase.co/auth/v1/callback
  ```

  This is Supabase's callback, **not** `localhost:5173/auth/callback`.

- Copy **Client ID** and **Client Secret** into Supabase → Google provider → **Save**

**3. Configure Supabase redirect URLs**

- Supabase → **Authentication** → **URL Configuration**
- **Site URL:** `http://localhost:5173` (dev) or your production URL
- **Redirect URLs** — add each:

  ```
  http://localhost:5173/auth/callback
  http://localhost:5173/**
  vendorly://auth/callback
  ```

  Add production URLs when deployed (e.g. `https://yourdomain.com/auth/callback`).

**4. Verify `web/.env`**

```
VITE_SUPABASE_URL=https://ajedyjbdpjahnhzrxwdj.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL=http://localhost:5173
```

In dev, you can leave `VITE_APP_URL` unset — OAuth uses your browser origin automatically.

**5. Test**

- Restart `npm run dev` after env changes
- Click **Continue with Google** on `/login`
- If the provider is still disabled, the app shows a friendly message with a setup checklist instead of raw JSON

### Google sign-in shows "400" or "redirect_uri_mismatch"

1. In **Google Cloud Console**, the redirect URI must be Supabase's callback (`…/auth/v1/callback`), **not** `localhost:5173/auth/callback`.
2. In **Supabase → Redirect URLs**, add `http://localhost:5173/auth/callback` (that's where Supabase sends the user *after* Google succeeds).
3. Leave `VITE_APP_URL` unset in dev so OAuth uses your actual browser origin (`http://localhost:5173`).
4. Confirm Google provider is **enabled** with valid Client ID + Secret in Supabase.

## Development

```powershell
npm install
npm run dev
```

- **Marketing site:** http://localhost:5173
- **Sign in:** http://localhost:5173/login
- **After login:** routes to shopper or vendor dashboard automatically

### Use away from home (cellular / remote)

Core shopper and vendor flows use **Supabase in the cloud** — they work anywhere with internet.

For **POS, admin AI, and proxied market photos**, set public HTTPS API URLs:

1. Deploy this app to **Vercel** with `VITE_APP_URL` + `VITE_API_URL=https://api.vendorly.app` (see [Production deploy](#production-deploy-vercel)).
2. Deploy the NestJS backend (or tunnel it) and set backend `WEB_APP_URL` to match.
3. Add production auth redirect URLs in Supabase.

Full checklist: [`docs/OFF_LAN_ACCESS.md`](../docs/OFF_LAN_ACCESS.md).

Same-Wi‑Fi dev from a phone: open `http://YOUR-PC-LAN-IP:5173` (API auto-targets `:4000` on that host).

## Web app features

### Shoppers
- Sign up / sign in / password reset
- Role selection + interests onboarding
- Discover (search), Events, Map, Feed, Profile tabs
- Vendor storefronts, product detail, reserve for pickup
- Order history

### Vendors
- Vendor application setup
- Dashboard, Orders, Products, Posts, Profile tabs
- Create products (with photos, limits) and set per-event availability
- Join/leave markets (vendor events)
- Log in-person sales
- Connect Square POS, sync, and item mappings
- Analytics with CSV export
- Edit storefront
- Manage order status
- Leftovers listings
- Video posts

### Admins
- Vendor approval/rejection with AI review suggestions
- Event create/edit/publish
- Read-only order browser
- Post moderation queue with AI assist

## Environment

| Variable | Dev | Production |
|----------|-----|------------|
| `VITE_SUPABASE_URL` | Supabase project URL | Same as mobile |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | Same as mobile |
| `VITE_APP_URL` | Optional (`http://localhost:5173`) | **Required** — e.g. `https://vendorly.app` |
| `VITE_API_URL` | Optional (auto `:4000` on same host) | **Required** — `https://api.vendorly.app` |

Copy `web/.env.example` → `web/.env` for local dev. Production values go in your host's env dashboard (never commit `.env`).

```powershell
npm run build
npm run preview
```

## Production deploy (Vercel)

**Platform:** [Vercel](https://vercel.com) — static hosting for the Vite SPA with SPA rewrites in `vercel.json`.

### 1. Verify the build locally

```powershell
cd web
npm install
npm run build
npm run preview
```

Open http://localhost:4173 and confirm pages load. `npm run build` must pass before deploying.

### 2. Create the Vercel project

1. Sign in at [vercel.com/new](https://vercel.com/new) and **Import** this Git repository.
2. **Root Directory:** set to `web` (monorepo — do not deploy from repo root).
3. Vercel should detect **Vite** automatically. Confirm:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
4. Add **Environment Variables** (Production, and Preview if you want PR previews):

   | Name | Example value |
   |------|---------------|
   | `VITE_SUPABASE_URL` | `https://your-project-ref.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | *(anon key from Supabase → Settings → API)* |
   | `VITE_APP_URL` | `https://vendorly.app` |
   | `VITE_API_URL` | `https://api.vendorly.app` |

5. Click **Deploy**.

Or deploy from CLI (after [installing Vercel CLI](https://vercel.com/docs/cli)):

```powershell
cd web
npx vercel login
npx vercel link
npx vercel --prod
```

Set env vars once in the Vercel dashboard (**Project → Settings → Environment Variables**) or via CLI:

```powershell
npx vercel env add VITE_SUPABASE_URL production
npx vercel env add VITE_SUPABASE_ANON_KEY production
npx vercel env add VITE_APP_URL production
npx vercel env add VITE_API_URL production
```

### 3. Custom domain (optional)

1. Vercel → **Project → Settings → Domains** → add `vendorly.app` (and `www` if needed).
2. At your DNS provider, add the records Vercel shows (usually `A`/`CNAME` to Vercel).
3. Wait for SSL provisioning, then set `VITE_APP_URL` to the canonical HTTPS URL and **Redeploy**.

### 4. Supabase auth URLs (required for login)

In **Supabase Dashboard → Authentication → URL Configuration**:

- **Site URL:** `https://vendorly.app` (or your Vercel `*.vercel.app` URL until DNS is ready)
- **Redirect URLs** — add:
  - `https://vendorly.app/auth/callback`
  - `https://vendorly.app/auth/reset-password`
  - `https://vendorly.app/**`
  - `vendorly://auth/callback` (mobile deep link)

For Google OAuth, keep the Google Cloud **Authorized redirect URI** as Supabase's callback (`https://YOUR-PROJECT.supabase.co/auth/v1/callback`), not the web app URL.

### 5. Backend CORS (required for POS / admin API)

On the NestJS backend (`backend/.env`), set:

```
WEB_APP_URL=https://vendorly.app
PUBLIC_BASE_URL=https://api.vendorly.app
```

Redeploy the backend after changing CORS. Without this, browser calls to `VITE_API_URL` from the production site will be blocked.

### 6. Smoke test after deploy

- `/` — marketing landing page
- `/login` — sign in (Supabase)
- `/auth/callback` — OAuth return (test Google if enabled)
- Deep link route, e.g. `/shopper/explore` — refresh the page; should not 404 (SPA rewrite)
- Vendor **POS** page — confirms `VITE_API_URL` reaches the backend

### Alternative: Netlify

If you prefer Netlify, add `web/netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Set the same four `VITE_*` env vars in Netlify → **Site configuration → Environment variables**, with **Base directory** = `web`.
