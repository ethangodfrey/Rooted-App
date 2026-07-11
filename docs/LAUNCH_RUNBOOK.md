# Rooted Launch Runbook

Checklist for promoting Rooted from closed beta to App Store / production. Work top-to-bottom; each section has a verification gate.

**Realistic posture today:** closed beta with a small vendor cohort.  
**App Store target:** complete all **Blockers** sections below.

---

## 1. Supabase — fresh production database

Apply SQL in this exact order in the Supabase SQL Editor (or via migration tooling). Skip seed files if you are importing USDA data separately.

| # | File | Purpose |
|---|------|---------|
| 1 | `docs/supabase/phase1_auth.sql` | users, shoppers, vendors, RLS |
| 2 | `docs/supabase/phase1_storage_auth_redirect.sql` | `auth` storage bucket for email bridge |
| 3 | `docs/supabase/phase4_events.sql` | events table |
| 4 | `docs/supabase/phase6_vendor_events.sql` | vendor ↔ event participation |
| 5 | `docs/supabase/phase7_products.sql` | products + availability |
| 6 | `docs/supabase/phase7_product_media_storage.sql` | product image storage |
| 7 | `docs/supabase/phase9_orders.sql` | reserve-for-pickup orders |
| 8 | `docs/supabase/phase9_reservation_limits.sql` | presale caps |
| 9 | `docs/supabase/phase10_posts.sql` | vendor feed posts |
| 10 | `docs/supabase/phase10_post_scheduling.sql` | scheduled posts |
| 11 | `docs/supabase/phase10_feed_explore.sql` | explore feed |
| 12 | `docs/supabase/phase10_feed_saved_vendor_read.sql` | saved-vendor feed reads |
| 13 | `docs/supabase/phase11_analytics.sql` | vendor analytics |
| 14 | `docs/supabase/phase12_admin.sql` | admin policies |
| 15 | `docs/supabase/phase12_onboarding_role_reset.sql` | role reset helper |
| 16 | `docs/supabase/phase12_vendor_application.sql` | vendor application fields |
| 17 | `docs/supabase/phase12_pos_integrations.sql` | POS integration metadata |
| 18 | `docs/supabase/phase12b_pos_tables.sql` | POS tables |
| 19 | `docs/supabase/phase12c_pos_rls.sql` | POS RLS |
| 20 | `docs/supabase/phase13_market_agent.sql` | market agent |
| 21 | `docs/supabase/phase14_market_details.sql` | market detail fields |
| 22 | `docs/supabase/phase15_market_history.sql` | market history |
| 23 | `docs/supabase/phase16_video_posts.sql` | video posts |
| 24 | `docs/supabase/phase17_admin_agent.sql` | admin agent |
| 25 | `docs/supabase/phase18_admin_agent_feedback.sql` | admin agent feedback |
| 26 | `docs/supabase/phase19_post_moderation.sql` | post moderation |
| 27 | `docs/supabase/phase20_leftovers.sql` | leftovers |
| 28 | `docs/supabase/phase21_market_guide.sql` | market guide |
| 29 | `docs/supabase/phase22_account_deletion.sql` | self-service account deletion |

**Optional seeds (dev/staging only):**

- `docs/supabase/phase5_seed_denver_events.sql`
- `docs/supabase/phase5_seed_all_states_events.sql`

**USDA market data:** regenerate via `npm run markets:usda:import` — do not hand-edit `generated_usda_markets_part*.sql`.

### Post-migration smoke test

- [ ] Sign up as shopper → role select → interests → home loads
- [ ] Sign up as vendor → application → pending approval visible in admin
- [ ] Admin can approve vendor (`update users set role = 'admin' where email = '…'` for first admin)
- [ ] Reserve-for-pickup order completes (Model A — unpaid until pickup)
- [ ] Password reset email opens app via hosted redirect (see §2)
- [ ] Delete account from profile removes user and signs out

---

## 2. Auth email links (mobile)

Password reset and email confirmation **fail on physical devices** without a hosted HTTPS bridge.

1. Upload `docs/supabase/auth-redirect.html` to Supabase Storage bucket **`auth`** (public).
2. Set `EXPO_PUBLIC_AUTH_REDIRECT_URL` in mobile `.env` / EAS secrets to the public URL, e.g.  
   `https://<project>.supabase.co/storage/v1/object/public/auth/auth-redirect.html`
3. In Supabase → **Authentication → URL Configuration → Redirect URLs**, add that same URL.
4. Run `eas build` with the env var baked in; Expo Go uses `mobile://` scheme only in dev.

**Verify:** request password reset on a TestFlight build → tap email link → app opens → set new password.

---

## 3. Legal & compliance (App Store blockers)

| Item | Action |
|------|--------|
| Privacy policy | Publish at `https://rooted.app/privacy` (or set `EXPO_PUBLIC_LEGAL_PRIVACY_URL`) |
| Terms of service | Publish at `https://rooted.app/terms` |
| Support URL | Publish at `https://rooted.app/support` — required in App Store Connect |
| Signup consent | Mobile + web signup screens link to terms/privacy (implemented) |
| Account deletion | Run `phase22_account_deletion.sql`; profile screens expose delete (implemented) |

---

## 4. Mobile build & App Store submission

### Prerequisites

- [ ] Apple Developer Program enrolled ($99/year)
- [ ] Branded 1024×1024 icon in `mobile/assets/images/icon.png`
- [ ] Branded splash in `mobile/assets/images/splash-icon.png`
- [ ] Replace `REPLACE_WITH_EAS_PROJECT_ID` in `mobile/app.json` after `eas init`
- [ ] Replace placeholder values in `mobile/eas.json` submit section

### EAS commands

```bash
cd mobile
npm install -g eas-cli
eas login
eas init                    # links EAS project, updates app.json extra.eas.projectId
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

`app.json` already sets `ios.bundleIdentifier` / `android.package` to `com.rooted.app`.

### App Store Connect

- [ ] Screenshots: 6.7", 6.5", 5.5" iPhone sizes
- [ ] Privacy policy URL, support URL, age rating questionnaire
- [ ] TestFlight internal testing before public release

---

## 5. Production infrastructure

| Component | Dev today | Production needed |
|-----------|-----------|-------------------|
| Backend API | Docker local | Fly.io / Railway / Render with HTTPS |
| Redis | Local | Managed Redis (POS job queues) |
| Web app | `npm run build` → `dist/` | Vercel/Netlify + SPA rewrites |
| Supabase | Dev project | Dedicated prod project or confirmed prod config |
| Secrets | Per-package `.env` | GitHub Environments / Doppler / EAS secrets |
| `EXPO_PUBLIC_API_URL` | LAN IP | `https://api.rooted.app` (or your domain) |

### Backend health check

After deploy, confirm `GET /health/ready` returns 200. Add uptime monitoring (Better Uptime, Pingdom, etc.).

---

## 6. Security before public launch

- [ ] Remove or keep `admin-dev` backdoor **dev-only** (`__DEV__` gated — done in code)
- [ ] Add API rate limiting on public endpoints (webhooks, market photo proxy)
- [ ] Review CORS — tighten no-Origin requests if not needed
- [ ] Rotate any secrets committed to dev `.env` files

---

## 7. Monitoring (strongly recommended)

- [ ] Sentry or Crashlytics on mobile
- [ ] Error tracking on web + backend
- [ ] Uptime alert on `/health/ready`

---

## 8. CI gates (GitHub Actions)

Workflow `.github/workflows/monorepo-ci.yml` runs on every push/PR:

- `web`: `npm run build`
- `mobile`: `npx tsc --noEmit`
- `backend`: typecheck, tests, build

Keep these green before merging launch PRs.

---

## 9. Pilot happy path (Model A)

Ship **reserve now, pay at pickup** — do not promise in-app payments.

1. Shopper discovers market on map → views event → browses vendor products
2. Shopper reserves items → order `payment_status: unpaid`
3. Vendor sees order in dashboard → marks paid at pickup
4. Vendor posts to feed → favoriting shoppers see update

Hide or label non-farmers-market listings until classification pipeline completes (~17.5k pending).

---

## 10. Remaining launch caveats (non-blocking)

| Area | Note |
|------|------|
| Market classification | ~17.5k listings pending — map may show CSAs/agritourism |
| Schedule enrichment | Some markets still have wrong hours |
| Map pin cap | ~100–350 pins nationwide without user location |
| Toast/Clover POS | Not production-ready — Square only |
| Push notifications | Not implemented — users refresh manually |
| Offline UX | No graceful offline states |

---

## Quick env reference

### Mobile (`mobile/.env` or EAS secrets)

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_URL=https://api.rooted.app
EXPO_PUBLIC_AUTH_REDIRECT_URL=https://<project>.supabase.co/storage/v1/object/public/auth/auth-redirect.html
EXPO_PUBLIC_LEGAL_TERMS_URL=https://rooted.app/terms
EXPO_PUBLIC_LEGAL_PRIVACY_URL=https://rooted.app/privacy
EXPO_PUBLIC_SUPPORT_URL=https://rooted.app/support
```

### Web (`web/.env`)

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_URL=https://rooted.app
VITE_API_URL=https://api.rooted.app
```

### Backend (`backend/.env`)

```
DATABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
REDIS_URL=
PUBLIC_BASE_URL=https://api.rooted.app
```
