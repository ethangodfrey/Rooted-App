# Rooted Launch Runbook

Operational checklist for promoting Rooted from pilot to App Store / production web. Apply in order; do not skip SQL phases on a fresh Supabase project.

## Pre-flight

- [ ] Apple Developer Program enrolled ($99/year)
- [ ] Production domain chosen (web + API + support email)
- [ ] Production Supabase project (or confirmed prod config)
- [ ] `eas init` run in `mobile/` and `app.json` `extra.eas.projectId` updated
- [ ] Branded 1024×1024 icon and splash assets in `mobile/assets/images/`
- [ ] App Store Connect: privacy policy URL, terms URL, support URL

## 1. Supabase SQL — apply in this order

Run each file in the Supabase SQL Editor (or via migration tooling). Wait for success before the next file.

| # | File | Notes |
|---|------|-------|
| 1 | `docs/supabase/phase1_auth.sql` | Core users, shoppers, vendors |
| 2 | `docs/supabase/phase1_storage_auth_redirect.sql` | Public `auth` bucket for email bridge |
| 3 | `docs/supabase/phase4_events.sql` | Events table |
| 4 | `docs/supabase/phase6_vendor_events.sql` | Vendor ↔ event links |
| 5 | `docs/supabase/phase7_products.sql` | Products + availability |
| 6 | `docs/supabase/phase7_product_media_storage.sql` | Product image bucket |
| 7 | `docs/supabase/phase9_orders.sql` | Orders (Model A) |
| 8 | `docs/supabase/phase9_reservation_limits.sql` | Presale caps |
| 9 | `docs/supabase/phase10_posts.sql` | Vendor posts |
| 10 | `docs/supabase/phase10_feed_explore.sql` | Explore feed |
| 11 | `docs/supabase/phase10_feed_saved_vendor_read.sql` | Saved vendor feed |
| 12 | `docs/supabase/phase10_post_scheduling.sql` | Scheduled posts |
| 13 | `docs/supabase/phase11_analytics.sql` | Analytics tables |
| 14 | `docs/supabase/phase12_admin.sql` | Admin policies |
| 15 | `docs/supabase/phase12_onboarding_role_reset.sql` | Role reset helper |
| 16 | `docs/supabase/phase12_vendor_application.sql` | Vendor application fields |
| 17 | `docs/supabase/phase12_pos_integrations.sql` | POS integration metadata |
| 18 | `docs/supabase/phase12b_pos_tables.sql` | POS tables |
| 19 | `docs/supabase/phase12c_pos_rls.sql` | POS RLS |
| 20 | `docs/supabase/phase13_market_agent.sql` | Market agent columns |
| 21 | `docs/supabase/phase14_market_details.sql` | Market detail fields |
| 22 | `docs/supabase/phase15_market_history.sql` | Market history |
| 23 | `docs/supabase/phase16_video_posts.sql` | Video posts |
| 24 | `docs/supabase/phase17_admin_agent.sql` | Admin agent tables |
| 25 | `docs/supabase/phase18_admin_agent_feedback.sql` | Agent feedback |
| 26 | `docs/supabase/phase19_post_moderation.sql` | Post moderation |
| 27 | `docs/supabase/phase20_leftovers.sql` | Leftovers |
| 28 | `docs/supabase/phase21_market_guide.sql` | Market guide |
| 29 | `docs/supabase/phase22_account_deletion.sql` | Self-service delete (Apple 5.1.1) |
| 30–41 | `docs/supabase/generated_usda_markets_part001.sql` … `part012.sql` | USDA market seed (regenerate via `npm run markets:usda:import`) |

**Optional dev seeds** (skip in production unless needed):

- `phase5_seed_denver_events.sql`
- `phase5_seed_all_states_events.sql`

## 2. Supabase Auth configuration

1. Upload `docs/supabase/auth-redirect.html` to Storage bucket `auth` as `auth-redirect.html`.
2. Authentication → URL Configuration → add redirect URLs:
   - `https://<project>.supabase.co/storage/v1/object/public/auth/auth-redirect.html`
   - `https://<your-domain>/auth/callback`
   - `https://<your-domain>/auth/reset-password`
   - `rooted://auth/callback` and `rooted://auth/reset-password` (native deep links)
3. Set site URL to your production web origin.

## 3. Environment variables

### Web (`web/.env` or host env)

| Variable | Example |
|----------|---------|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | anon key |
| `VITE_APP_URL` | `https://app.rooted.app` |
| `VITE_API_URL` | `https://api.rooted.app` |
| `VITE_SUPPORT_URL` | `mailto:support@rooted.app` |

### Mobile (EAS secrets / `mobile/.env` for local)

| Variable | Example |
|----------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | same as web |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | same as web |
| `EXPO_PUBLIC_API_URL` | `https://api.rooted.app` |
| `EXPO_PUBLIC_AUTH_REDIRECT_URL` | hosted `auth-redirect.html` URL |
| `EXPO_PUBLIC_WEB_URL` | `https://app.rooted.app` |
| `EXPO_PUBLIC_SUPPORT_URL` | `mailto:support@rooted.app` |

### Backend

| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | Supabase Postgres connection |
| `WEB_APP_URL` | Production web origin (CORS) |
| `CORS_ORIGINS` | Comma-separated extra origins |
| `REDIS_URL` | Required for POS job queues in prod |
| `NODE_ENV` | `production` |

## 4. Deploy services

| Component | Suggested host | Verify |
|-----------|----------------|--------|
| Backend API | Fly.io / Railway / Render | `GET /health/ready` returns 200 |
| Web SPA | Vercel / Netlify | SPA rewrite to `index.html`; `/privacy`, `/terms` load |
| Redis | Upstash / managed Redis | POS sync jobs dequeue |
| Supabase | Hosted project | RLS smoke test below |

## 5. Mobile App Store build

```bash
cd mobile
eas init                    # once — update app.json projectId
eas build --platform ios --profile production
eas submit --platform ios   # or upload via App Store Connect
```

Before submit:

- [ ] `ios.bundleIdentifier` = `com.rooted.app` in `app.json`
- [ ] Privacy manifest present (`ios.privacyManifests`)
- [ ] Screenshots (6.7", 6.5", 5.5" iPhone)
- [ ] TestFlight build tested: signup, reset password, delete account

## 6. Post-migration smoke test

Run manually after SQL + deploy:

1. **Auth** — Sign up (shopper), confirm email, sign in, sign out.
2. **Password reset** — Request reset on device; link opens app via hosted redirect.
3. **Role flows** — Shopper interests; vendor application submit.
4. **Discovery** — Map loads pins; event detail opens.
5. **Model A order** — Reserve product → vendor sees order → mark picked up.
6. **Account deletion** — Delete account from profile; cannot sign in again.
7. **Legal URLs** — Privacy and terms load on production domain.
8. **Admin** — Approve vendor; moderate post (if enabled).
9. **API health** — `curl https://api.<domain>/health/ready`

## 7. Launch blockers still requiring product/ops decisions

- Production monitoring (Sentry / uptime on `/health/ready`)
- API rate limiting on public endpoints
- Remove or restrict CORS no-origin allowance in production backend
- Market classification pipeline completion (~17.5k pending listings)
- Push notifications (optional for v1.0)

## 8. Realistic launch posture

| Stage | Ready when |
|-------|------------|
| Closed beta / pilot | This runbook complete + TestFlight + small vendor cohort |
| Public App Store | Above + monitoring + branded assets + review polish |

---

*Generated for launch readiness automation. Update as infrastructure choices are finalized.*
