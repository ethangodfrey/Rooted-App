# Rooted — Launch Runbook

Checklist for standing up a **production** Supabase project, backend, web app, and App Store build. Use this after legal pages and hosting decisions are made.

---

## 1. Supabase — SQL apply order

Run each file in the Supabase SQL Editor **in this order** on a fresh project. Do not skip phases; later files assume earlier tables and policies exist.

| # | File | Purpose |
|---|------|---------|
| 1 | `phase1_auth.sql` | `users`, `shoppers`, `vendors`, auth trigger |
| 2 | `phase1_storage_auth_redirect.sql` | Public `auth` bucket for email redirect bridge |
| 3 | `phase4_events.sql` | Events + RLS |
| 4 | `phase6_vendor_events.sql` | Vendor ↔ event participation |
| 5 | `phase7_products.sql` | Products + event availability |
| 6 | `phase7_product_media_storage.sql` | Product image storage bucket |
| 7 | `phase9_orders.sql` | Orders + order items |
| 8 | `phase9_reservation_limits.sql` | Reservation caps |
| 9 | `phase10_posts.sql` | Vendor feed posts |
| 10 | `phase10_post_scheduling.sql` | Scheduled posts |
| 11 | `phase10_feed_explore.sql` | Explore feed policies |
| 12 | `phase10_feed_saved_vendor_read.sql` | Saved-vendor feed read access |
| 13 | `phase11_analytics.sql` | Analytics snapshots + inventory transactions |
| 14 | `phase12_admin.sql` | Admin RLS helpers |
| 15 | `phase12_vendor_application.sql` | Vendor application fields |
| 16 | `phase12_onboarding_role_reset.sql` | Role onboarding reset |
| 17 | `phase12_pos_integrations.sql` | POS integration columns |
| 18 | `phase12b_pos_tables.sql` | POS connection tables |
| 19 | `phase12c_pos_rls.sql` | POS table RLS |
| 20 | `phase13_market_agent.sql` | Market discovery agent tables |
| 21 | `phase14_market_details.sql` | Market detail enrichment |
| 22 | `phase15_market_history.sql` | Market change history |
| 23 | `phase16_video_posts.sql` | Video post support |
| 24 | `phase17_admin_agent.sql` | AI vendor review agent |
| 25 | `phase18_admin_agent_feedback.sql` | Agent feedback loop |
| 26 | `phase19_post_moderation.sql` | Post moderation agent |
| 27 | `phase20_leftovers.sql` | Leftover listings |
| 28 | `phase21_market_guide.sql` | Market guide content |
| 29 | `phase22_account_deletion.sql` | Self-service account deletion RPC |

### Optional seed data (dev / demo only)

| File | Notes |
|------|-------|
| `phase5_seed_denver_events.sql` | Denver sample events |
| `phase5_seed_all_states_events.sql` | Broader US seed — large |

### Market catalog (regenerate; do not hand-edit)

```bash
npm run markets:usda:pipeline   # generates docs/supabase/generated_usda_markets_part*.sql
```

Apply generated parts in numeric order (`part001` → `part012`) **after** phase 13–21.

---

## 2. Post-migration smoke test

Run in Supabase SQL Editor or via the app:

- [ ] Sign up a new shopper → `public.users` row created via trigger
- [ ] Select shopper role → `shoppers` row exists
- [ ] Browse events list (seeded or USDA markets visible)
- [ ] Vendor signup → application row + `approval_status = pending`
- [ ] Admin can list pending vendors (admin role in `users.role`)
- [ ] Reserve-for-pickup order creates `orders` + `order_items`
- [ ] Upload `docs/supabase/auth-redirect.html` to Storage bucket `auth` as `auth-redirect.html`
- [ ] Password reset email opens app (see §4)
- [ ] Account deletion from Profile removes auth user (phase 22 applied)

---

## 3. Auth redirect (mobile)

Required for password reset and email confirmation on physical devices.

1. Upload `docs/supabase/auth-redirect.html` to Supabase Storage bucket **`auth`** (public).
2. In Supabase → **Authentication → URL Configuration**, add redirect URLs:
   - `https://<project>.supabase.co/storage/v1/object/public/auth/auth-redirect.html`
   - `mobile://auth/callback`
   - `mobile://auth/reset-password`
   - Production web: `https://<your-domain>/auth/callback`, `https://<your-domain>/auth/reset-password`
3. Set in `mobile/.env` (and EAS secrets for production builds):

   ```env
   EXPO_PUBLIC_AUTH_REDIRECT_URL=https://<project>.supabase.co/storage/v1/object/public/auth/auth-redirect.html
   ```

4. For Universal Links (recommended before App Store): host `apple-app-site-association` on your domain and add `associatedDomains` in `app.json`.

---

## 4. Legal & App Store metadata

| Item | Where |
|------|-------|
| Privacy policy | Publish at `/privacy` on web (or external URL); set `EXPO_PUBLIC_PRIVACY_URL` / `VITE_PRIVACY_URL` |
| Terms of service | Publish at `/terms`; set `EXPO_PUBLIC_TERMS_URL` / `VITE_TERMS_URL` |
| Support URL | App Store Connect → `https://<your-domain>/support` (create page or mailto) |
| Account deletion | In-app Profile → Delete account (requires `phase22_account_deletion.sql`) |

**Before submission:** replace placeholder legal copy with counsel-reviewed text.

---

## 5. Mobile — EAS production build

Prerequisites: Apple Developer account, Expo account, `eas-cli`.

```bash
cd mobile
eas init                    # link EAS project (once)
eas build --platform ios --profile production
eas submit --platform ios   # or upload via App Store Connect
```

Verify `mobile/app.json` has:

- `ios.bundleIdentifier` (e.g. `com.rooted.app`)
- `android.package`
- `ios.buildNumber` / `android.versionCode` incremented per submission
- Branded `icon.png` (1024×1024) and splash assets

---

## 6. Backend production

| Env var | Purpose |
|---------|---------|
| `DATABASE_URL` | Supabase Postgres connection string |
| `SUPABASE_URL` | JWT verification (JWKS) |
| `PUBLIC_BASE_URL` | `https://api.<your-domain>` |
| `WEB_APP_URL` | `https://<your-domain>` (CORS) |
| `REDIS_URL` | BullMQ queues (`POS_QUEUES_ENABLED=true` in prod) |
| `POS_CREDENTIAL_KEY` | 32-byte base64 AES key |

Deploy Docker image to Fly.io / Railway / Render. Confirm `GET /health/ready` returns 200.

---

## 7. Web production

```bash
cd web && npm run build
```

Deploy `dist/` to Vercel/Netlify with SPA fallback to `index.html`.

Set `VITE_SUPABASE_*`, `VITE_APP_URL`, `VITE_API_URL`.

---

## 8. CI (GitHub Actions)

`.github/workflows/ci.yml` runs on every push:

- Backend: typecheck, test, build
- Web: `npm run build`
- Mobile: `npx tsc --noEmit`

---

## 9. Launch posture

| Stage | Ready when |
|-------|------------|
| **Closed beta** | Phases 1–22 applied, auth redirects work, legal URLs live, TestFlight build |
| **App Store v1.0** | Above + screenshots, support URL, no dev admin backdoor, monitoring (Sentry/uptime), production API + Redis |

**v1.0 product scope:** Model A (reserve now, pay at pickup). Do not promise in-app payments.
