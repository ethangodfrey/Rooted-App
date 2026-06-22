# Rooted Launch Runbook

Operational checklist for moving Rooted from pilot to App Store / production. See also the launch readiness analysis in the automation PR description.

**Realistic posture today:** closed beta with a small vendor cohort.  
**App Store launch:** address every blocker below before submission.

---

## 1. Supabase migrations (fresh production)

Apply SQL in this order in the Supabase SQL Editor. Optional seed files are marked.

| # | File | Notes |
|---|------|--------|
| 1 | `phase1_auth.sql` | Core users, shoppers, vendors |
| 2 | `phase1_storage_auth_redirect.sql` | Public `auth` bucket for email bridge |
| 3 | `phase4_events.sql` | Events |
| 4 | `phase5_seed_denver_events.sql` | Optional dev seed |
| 5 | `phase5_seed_all_states_events.sql` | Optional broader seed |
| 6 | `phase6_vendor_events.sql` | Vendor ↔ event |
| 7 | `phase7_products.sql` | Products |
| 8 | `phase7_product_media_storage.sql` | Product media bucket |
| 9 | `phase9_orders.sql` | Orders |
| 10 | `phase9_reservation_limits.sql` | Presale caps |
| 11 | `phase10_posts.sql` | Vendor posts |
| 12 | `phase10_post_scheduling.sql` | Scheduled posts |
| 13 | `phase10_feed_explore.sql` | Explore feed |
| 14 | `phase10_feed_saved_vendor_read.sql` | Saved-vendor reads |
| 15 | `phase11_analytics.sql` | Analytics tables |
| 16 | `phase12_admin.sql` | Admin RLS |
| 17 | `phase12_onboarding_role_reset.sql` | Role reset |
| 18 | `phase12_vendor_application.sql` | Vendor application |
| 19 | `phase12_pos_integrations.sql` | POS patches |
| 20 | `phase12b_pos_tables.sql` | POS tables |
| 21 | `phase12c_pos_rls.sql` | POS RLS |
| 22 | `phase13_market_agent.sql` | Market discovery |
| 23 | `phase14_market_details.sql` | Market detail fields |
| 24 | `phase15_market_history.sql` | Market history |
| 25 | `phase16_video_posts.sql` | Video posts |
| 26 | `phase17_admin_agent.sql` | AI vendor triage |
| 27 | `phase18_admin_agent_feedback.sql` | Agent feedback |
| 28 | `phase19_post_moderation.sql` | AI post moderation |
| 29 | `phase20_leftovers.sql` | Leftovers |
| 30 | `phase21_market_guide.sql` | Market guide |
| 31 | `phase22_account_deletion.sql` | **Required** for in-app account delete |

**Market data imports** (regenerate — do not hand-edit):

```bash
npm run markets:usda:pipeline   # from repo root
```

Then apply generated `docs/supabase/generated_usda_markets_part*.sql` in numeric order.

### Post-migration smoke test

- [ ] Sign up as shopper → role select → interests → home
- [ ] Sign up as vendor → application → pending approval
- [ ] Admin can approve vendor (promote `users.role` to `admin` in SQL for first admin)
- [ ] Create product, link to event, place reservation
- [ ] Password reset email opens app (see §3)
- [ ] Delete account from profile removes auth user

---

## 2. Legal & compliance

| Item | Status in repo | Action |
|------|----------------|--------|
| Privacy policy | `/privacy` on web | Publish web app; set `VITE_APP_URL` / `EXPO_PUBLIC_WEB_APP_URL` |
| Terms of service | `/terms` on web | Same |
| Support URL | `/support` on web | Add to App Store Connect |
| Signup consent | Mobile + web signup | Verify links resolve on production domain |
| Account deletion | `phase22_account_deletion.sql` + profile UI | Run migration before enabling delete button |

---

## 3. Auth deep links (password reset)

1. Upload `docs/supabase/auth-redirect.html` to Supabase Storage bucket `auth` (public).
2. Set `EXPO_PUBLIC_AUTH_REDIRECT_URL` to the public URL of that file.
3. Add the same URL under **Authentication → URL Configuration → Redirect URLs** in Supabase.
4. For production web, set `VITE_APP_URL` to your deployed origin.
5. Optional: switch `app.json` `scheme` from `mobile` to `rooted` and update `auth-redirect.html` `APP_SCHEME` to match; configure Universal Links later.

---

## 4. Mobile App Store build

### Prerequisites

- [ ] Apple Developer Program enrolled
- [ ] Replace placeholder icons in `mobile/assets/images/` with branded 1024×1024 assets
- [ ] Run `eas init` and link project (set `extra.eas.projectId` in `app.json`)
- [ ] Update `mobile/eas.json` submit section with real Apple IDs

### Config already in repo

- `ios.bundleIdentifier`: `com.rooted.app`
- `android.package`: `com.rooted.app`
- `eas.json` profiles: `development`, `preview`, `production`

### Build & submit

```bash
cd mobile
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

Before public release: TestFlight build + App Store screenshots (6.7", 6.5", 5.5").

---

## 5. Production infrastructure

| Component | Needed |
|-----------|--------|
| Backend API | Hosted HTTPS (Fly.io, Railway, Render, etc.) |
| Redis | Managed instance if POS queues enabled |
| Web app | Vercel/Netlify with SPA rewrites to `index.html` |
| Supabase | Dedicated production project |
| Secrets | GitHub Environments / Doppler — not committed `.env` files |
| Mobile env | `EXPO_PUBLIC_API_URL` = production API in EAS secrets |

### Health check monitoring

Poll `GET /health/ready` on the backend from an uptime service (Better Uptime, Pingdom, etc.).

---

## 6. Security before review

| Item | Action |
|------|--------|
| Admin dev backdoor | Gated behind `__DEV__` in `mobile/src/lib/admin-dev.ts` — verify production build |
| CORS no-Origin | Production rejects requests without Origin (see `backend/src/main.ts`) |
| API rate limiting | **Not yet implemented** — add `@nestjs/throttler` before public launch |
| Error monitoring | Add Sentry/Crashlytics on mobile, web, backend |

---

## 7. CI

| Workflow | Path | Checks |
|----------|------|--------|
| Backend CI | `.github/workflows/backend-ci.yml` | tsc, test, build |
| Web & Mobile CI | `.github/workflows/web-mobile-ci.yml` | web build, mobile tsc |

---

## 8. Launch product scope (v1.0)

- Ship **Model A**: reserve now, pay at pickup. Do not promise in-app payments.
- Square POS is the only production-ready POS integration.
- Hide or label non-farmers-market listings until classification pipeline completes.

---

## 9. Remaining gaps (not in this run)

- Branded app icon and splash (placeholders exist)
- EAS project linkage (`eas init`)
- Universal Links / associated domains
- Push notifications
- Offline/network UX
- Web E2E tests
- API rate limiting
- Sentry / crash reporting

---

*Last updated: June 2026*
