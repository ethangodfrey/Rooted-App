# Rooted — Launch Runbook

Operational checklist for standing up a **fresh production** Supabase project and shipping the mobile app to TestFlight / App Store.

## Prerequisites

- [ ] Apple Developer Program enrolled ($99/year)
- [ ] Production domain for web app (privacy policy, terms, support URL)
- [ ] Hosted backend API with HTTPS (`PUBLIC_BASE_URL`)
- [ ] Managed Redis (if `POS_QUEUES_ENABLED=true` in production)
- [ ] Expo/EAS project linked (`eas init` in `mobile/`)
- [ ] Production Supabase project (separate from dev recommended)

## 1. Supabase SQL — apply in order

Run each file in the Supabase SQL Editor **in this exact order**. Do not skip phases.

| # | File | Purpose |
|---|------|---------|
| 1 | `phase1_auth.sql` | Users, shoppers, vendors, RLS |
| 2 | `phase1_storage_auth_redirect.sql` | Public `auth` storage bucket for email redirect bridge |
| 3 | `phase4_events.sql` | Events table |
| 4 | `phase5_seed_denver_events.sql` | Denver seed events (optional for prod) |
| 5 | `phase5_seed_all_states_events.sql` | National seed events (optional for prod) |
| 6 | `phase6_vendor_events.sql` | Vendor ↔ event participation |
| 7 | `phase7_products.sql` | Products + event availability |
| 8 | `phase7_product_media_storage.sql` | Product image storage bucket |
| 9 | `phase9_orders.sql` | Reserve-for-pickup orders |
| 10 | `phase9_reservation_limits.sql` | Presale cap enforcement |
| 11 | `phase10_posts.sql` | Vendor feed posts |
| 12 | `phase10_post_scheduling.sql` | Scheduled posts |
| 13 | `phase10_feed_saved_vendor_read.sql` | Feed read tracking |
| 14 | `phase10_feed_explore.sql` | Explore feed |
| 15 | `phase11_analytics.sql` | Analytics + manual sales |
| 16 | `phase12_admin.sql` | Admin policies |
| 17 | `phase12_onboarding_role_reset.sql` | Role switch cleanup |
| 18 | `phase12_vendor_application.sql` | Vendor application fields |
| 19 | `phase12_pos_integrations.sql` | POS integration metadata |
| 20 | `phase12b_pos_tables.sql` | POS connection tables |
| 21 | `phase12c_pos_rls.sql` | POS RLS policies |
| 22 | `phase13_market_agent.sql` | Market agent tables |
| 23 | `phase14_market_details.sql` | Market detail fields |
| 24 | `phase15_market_history.sql` | Market history |
| 25 | `phase16_video_posts.sql` | Video post support |
| 26 | `phase17_admin_agent.sql` | Admin agent tables |
| 27 | `phase18_admin_agent_feedback.sql` | Admin agent feedback |
| 28 | `phase19_post_moderation.sql` | Post moderation |
| 29 | `phase20_leftovers.sql` | Leftovers marketplace |
| 30 | `phase21_market_guide.sql` | Market guide content |
| 31 | `phase22_account_deletion.sql` | In-app account deletion (Apple 5.1.1) |

### Market data (generated — do not hand-edit)

Apply after core phases, in part order:

1. `generated_markets.sql` (if present) or `generated_markets_part001.sql` … `part015.sql`
2. `generated_usda_markets.sql` (if present) or `generated_usda_markets_part001.sql` … `part012.sql`

Regenerate via `npm run markets:usda:import` from repo root — never edit generated files manually.

### Auth email redirect bridge

1. Upload `docs/supabase/auth-redirect.html` to Supabase Storage bucket `auth` (public).
2. Note the public URL, e.g. `https://<ref>.supabase.co/storage/v1/object/public/auth/auth-redirect.html`
3. Add that URL to **Authentication → URL Configuration → Redirect URLs** in Supabase.
4. Set `EXPO_PUBLIC_AUTH_REDIRECT_URL` in `mobile/.env` to that URL.

## 2. Environment variables

### Mobile (`mobile/.env`)

```env
EXPO_PUBLIC_SUPABASE_URL=https://<prod-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<prod-anon-key>
EXPO_PUBLIC_API_URL=https://api.yourdomain.com
EXPO_PUBLIC_AUTH_REDIRECT_URL=https://<prod-ref>.supabase.co/storage/v1/object/public/auth/auth-redirect.html
EXPO_PUBLIC_WEB_URL=https://yourdomain.com
```

### Web (`web/.env`)

```env
VITE_SUPABASE_URL=https://<prod-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<prod-anon-key>
VITE_APP_URL=https://yourdomain.com
VITE_API_URL=https://api.yourdomain.com
```

### Backend (`backend/.env`)

See `backend/.env.example` — at minimum: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `POS_CREDENTIAL_KEY`, `PUBLIC_BASE_URL`, `WEB_APP_URL`.

## 3. Mobile App Store build

```bash
cd mobile
eas init          # link Expo project (first time)
eas build --platform ios --profile production
eas submit --platform ios
```

Verify `app.json` has `ios.bundleIdentifier` (`com.rooted.app`) and `android.package` before building.

## 4. Post-migration smoke test

Run after SQL + env setup:

### Auth

- [ ] Sign up (shopper) → email confirm link opens app / web
- [ ] Sign in → lands on role select or home
- [ ] Forgot password → reset link opens app → set new password works
- [ ] Sign out → session cleared

### Shopper

- [ ] Browse events list and map (pins render)
- [ ] Open event detail → vendors visible
- [ ] Reserve product (Model A) → order appears in My reservations
- [ ] Save vendor → appears on profile

### Vendor

- [ ] Complete vendor application → pending approval
- [ ] Admin approves vendor → vendor dashboard loads
- [ ] Create product + event availability
- [ ] View incoming order

### Admin

- [ ] Approve/reject vendor
- [ ] View orders, posts, events

### Compliance

- [ ] Privacy policy and terms links work on signup (web + mobile)
- [ ] Account deletion removes user and signs out
- [ ] Support URL configured in App Store Connect

### Backend health

```bash
curl https://api.yourdomain.com/health/ready
# expect 200
```

## 5. Launch blockers checklist

| Item | Status |
|------|--------|
| Privacy policy published | |
| Terms of service published | |
| Account deletion in app | SQL + UI in repo |
| Bundle ID + EAS configured | `app.json` + `eas.json` |
| Auth redirect wired | `EXPO_PUBLIC_AUTH_REDIRECT_URL` |
| Dev admin backdoor removed/gated | `__DEV__` only |
| Backend hosted with HTTPS | |
| Web deployed with SPA rewrites | |
| Error monitoring (Sentry, etc.) | |
| Rate limiting on public API | |

## 6. Recommended launch model

Ship **Model A** (reserve now, pay at pickup). Do not promise in-app payments until Stripe is integrated. Hide or label non-farmers-market listings until classification pipeline completes.
