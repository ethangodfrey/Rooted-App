# Main computer handoff — July 20, 2026 cloud agent work

Checklist for when you are back on the main machine. Cloud agents already committed/pushed these stacked PRs; local work is mostly **merge review**, **Supabase SQL**, and **env/deploy** confirmation.

## 1. Pull and review the PR stack (in order)

| Order | Branch | PR | What it adds |
|------:|--------|----|--------------|
| 1 | `cursor/dual-posting-content-428e` | #211 | Dual-posting / `post_contributions` |
| 2 | `cursor/dual-posting-observability-428e` | #212 | Dual-posting health/metrics |
| 3 | `cursor/meet-the-makers-discovery-428e` | #213 | Meet the Makers feed + RSVP |
| 4 | `cursor/vendor-catering-services-428e` | #214 | Optional catering module |
| 5 | `cursor/meet-the-makers-usda-428e` | #215 | US filter + USDA enrichment |
| 6 | `cursor/engagement-analytics-dashboard-428e` | #216 | Engagement Performance dashboard |
| 7 | `cursor/intelligence-automated-reporting-428e` | #217 | Weekly reports + anomaly detection |
| 8 | `cursor/b2b-marketplace-phase1-428e` | (open) | B2B peer marketplace Phase 1 + schema prep |

```powershell
git fetch origin
# Review each PR on GitHub, then merge bottom-up (or merge the tip if you squash-merge the stack).
```

Tip of stack (includes everything above once merged):  
`cursor/b2b-marketplace-phase1-428e`

## 2. Apply Supabase SQL (required)

In the Supabase SQL editor, apply **in order** if not already applied:

1. `docs/supabase/phase70_dual_posting_content.sql`  
   (or `docs/supabase/migrations/20260720_dual_posting_content.sql`)
2. `docs/supabase/phase71_meet_the_makers.sql`  
   (or `migrations/20260720_meet_the_makers.sql`) — `user_events` + alert radius
3. `docs/supabase/phase72_vendor_catering.sql`  
   (or `migrations/20260720_vendor_catering.sql`)
4. `docs/supabase/phase73_engagement_analytics.sql`  
   (or `migrations/20260720_engagement_analytics.sql`) — **new** interaction columns + `engagement_metrics`
5. `docs/supabase/phase74_intelligence_reporting.sql`  
   (or `migrations/20260720_intelligence_reporting.sql`) — `partner_reports` + PERFORMANCE_* notification types
6. `docs/supabase/phase75_b2b_marketplace.sql`  
   (or `migrations/20260720_b2b_marketplace.sql`) — wholesale flags, `wholesale_listings`, procurement, availability + loyalty prep

After phase73–75, confirm:

```sql
select to_regclass('public.engagement_metrics');
select to_regclass('public.partner_reports');
select to_regclass('public.wholesale_listings');
select to_regclass('public.b2b_procurement_requests');
select to_regclass('public.vendor_availability');
select to_regclass('public.shopper_loyalty');
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'post_contributions'
  and column_name in ('interaction_events', 'view_count', 'click_count');
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'catering_inquiries'
  and column_name in ('interaction_events', 'view_count', 'click_count');
```

Optional email delivery for weekly/anomaly reports:

```env
RESEND_API_KEY=
PARTNER_REPORT_FROM_EMAIL=reports@yourdomain.com
```

Without `RESEND_API_KEY`, reports still store + dashboard-notify; email status is `SKIPPED`.
## 3. Environment on the main machine

### Root `.env` (already expected for market seeding)

```env
USDA_API_KEY=<your existing key>
```

Meet the Makers Nest API now loads **both** `backend/.env` and root `../.env`.  
You should **not** need a second key — just ensure the root value is present where you already keep it for `npm run markets:usda:seed`.

On API boot you should see one of:

- `USDA_API_KEY_LOADED SOURCE=ENV`
- `USDA_API_KEY_MISSING SOURCE=ENV` (fix path if missing)

### Deploy envs (Railway / Vercel)

- Backend: same `USDA_API_KEY` if you want live USDA state-directory sync (hours via `listinginfo` still work without it).
- Web: existing `VITE_API_URL` / Supabase vars unchanged.
- No new public client secrets for analytics.

## 4. Local verify after pull

```powershell
cd Rooted-App   # or your repo path
git pull

npm run build
npx tsc --noEmit
npm run test:discovery:meet-the-makers
npm run test:vendor:catering
npm run test:analytics:dashboard
npm run test:intelligence:automated
npm run test:b2b:marketplace

cd web
npm run build
```

Expected uppercase logs (no emoji):

- `DISCOVERY_INTERFACE_INITIALIZED` / `PARTNERSHIP_FEED_SYNCED` / `USDA_MARKET_DATA_SYNCED`
- `CATERING_MODULE_INITIALIZED` / `VENDOR_SERVICES_UPDATED`
- `ANALYTICS_DASHBOARD_INITIALIZED` / `METRICS_SYNC_COMPLETE`
- `REPORTING_ENGINE_INITIALIZED` / `ANOMALY_DETECTION_ACTIVE` / `PERFORMANCE_ANOMALY_DETECTED`
- `B2B_MARKETPLACE_INITIALIZED` / `WHOLESALE_DIRECTORY_ACTIVE`

## 5. Manual UI smoke (5 minutes)

1. **Meet the Makers** — `/shopper/meet-the-makers`  
   US partnership posts, hours when USDA-enriched, RSVP → shows on shopper schedule.
2. **Active Collaboration** badge on vendor/farmer profile → modal of US joint posts.
3. **Catering** — `/vendor/catering` toggle + public “Request Catering” if enabled.
4. **Performance** — `/vendor/analytics` → **Performance** tab  
   Post Reach + Inquiries over time charts (empty zeros are OK until traffic + phase73).

## 6. Optional: seed / refresh USDA markets

Only if directory data is stale:

```powershell
npm run markets:usda:seed
# then your usual schedules/import/apply pipeline from docs/US_FARMERS_MARKET_API_SETUP.md
```

## 7. Do not forget

- [ ] Merge PR stack (or tip) after review  
- [ ] Apply phase70 → phase73 in Supabase  
- [ ] Confirm `USDA_API_KEY` in root `.env` (and Railway if used)  
- [ ] Redeploy backend after merge so `/api/discovery/*`, `/api/catering/*`, `/api/analytics/summary` are live  
- [ ] Redeploy web so Performance tab + Meet the Makers page ship  
- [ ] Paste phase73 into Supabase if someone already pasted only phase72 earlier  

## Cloud agent note

This workspace’s scrubbed `.env` did **not** contain `USDA_API_KEY`; your main machine / production secrets should. Cloud verify logged `USDA_API_KEY_MISSING` there — that is expected for the agent sandbox, not a signal that your laptop key is gone.
