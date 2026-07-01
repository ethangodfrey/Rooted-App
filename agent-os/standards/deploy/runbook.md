# Deploy phase runbook

Use this when guiding production deploy. Work **in order**; do not skip env + redeploy steps.

## Phase gate: web live

- [ ] Vercel Production env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL`
- [ ] Redeploy Vercel (clear build cache)
- [ ] Supabase → Auth → Site URL = Vercel domain
- [ ] Supabase → Redirect URLs: `{domain}/auth/callback`, `{domain}/auth/reset-password`, `{domain}/**`
- [ ] Smoke: `/` loads (not blank), `/login` shows form

Reference: `agent-os/standards/web/auth.md`, `docs/DEPLOY.md` §1

## Phase gate: backend live

- [ ] Railway Root Directory = **`backend`**
- [ ] Env: `NODE_ENV`, `DATABASE_URL` (pooler 6543), `PUBLIC_BASE_URL`, `WEB_APP_URL`, `CORS_ORIGINS`, `SUPABASE_URL`, `POS_CREDENTIAL_KEY`
- [ ] Health: `GET {PUBLIC_BASE_URL}/health/live` → 200
- [ ] Health: `GET {PUBLIC_BASE_URL}/health/ready` → 200 (DB reachable)

Reference: `agent-os/standards/backend/env-and-cors.md`, `docs/DEPLOY.md` §2

## Phase gate: web ↔ API connected

- [ ] Vercel: `VITE_API_URL` = Railway public URL
- [ ] Redeploy Vercel
- [ ] CORS on backend includes Vercel origin in `CORS_ORIGINS`
- [ ] Smoke: vendor POS page loads without CORS error

Reference: `docs/OFF_LAN_ACCESS.md`

## Phase gate: custom domains (optional)

- [ ] Vercel: `vendorly.app` + SSL
- [ ] Railway: `api.vendorly.app` + SSL
- [ ] Update all env vars to custom domains → redeploy both
- [ ] Supabase Site URL + redirects → `vendorly.app`

## Phase gate: mobile off-LAN (after web + API)

- [ ] EAS secrets: `EXPO_PUBLIC_SUPABASE_*`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_AUTH_REDIRECT_URL`
- [ ] No LAN IPs in production build env
- [ ] `npx tsc --noEmit` passes

Reference: `agent-os/standards/mobile/expo.md`, `docs/DEPLOY.md` §4

## Agent behavior during deploy

1. Read `agent-os/standards/index.yml` → load `deploy/*`, `backend/env-and-cors`, `web/auth`
2. Ask user for **only** secrets you cannot infer (DB password, anon key, Railway URL)
3. Never commit `.env` or paste secrets into chat logs unnecessarily
4. Verify with curl/browser smoke after each gate
5. End with run summary: checked, changed, commands, next gate

## Next product phase (after all gates green)

Phase 2: run `docs/supabase/phase32_stripe_messaging.sql`, Stripe env on Railway, checkout UI.

Reference: `docs/VENDORLY_MIGRATION.md` — "Not in Phase 1"
