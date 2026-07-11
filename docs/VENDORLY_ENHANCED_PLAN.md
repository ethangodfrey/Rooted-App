# Vendorly Enhanced Plan — Implementation Tracker

Source: `vendorly-marketplace-enhanced-plan.md` (user downloads)

This doc maps the **research-backed enhanced plan** to repo status. Apply SQL in order: phase22 → **phase23**.

## SQL migrations

| File | Contents |
|------|----------|
| `phase22_vendorly_marketplace.sql` | Roles, chefs, vendors, explore, saved_items, orders |
| `phase23_vendorly_enhanced.sql` | Trust, compliance, reviews, inventory holds |
| `phase26_service_reviews.sql` | Adds `reviews.service_id` + `'service'` target_type for chef-service-level reviews |
| `phase23c_verification_docs.sql` | Private `verification-docs` storage bucket + RLS for credential uploads |
| `phase24_geo_search.sql` | PostGIS hyperlocal: generated geography columns + GiST indexes + `find_nearby_events` / `find_nearby_vendors` / `find_nearby_leftovers` RPCs |
| `phase27_address_fields.sql` | Adds `street_address` / `postal_code` / `country` to `vendors` + `chefs` for onboarding address capture + vendor geocoding |
| `phase28_search_index.sql` | Cross-vertical unified discovery: `search_index` materialized view (vendors/chefs/events/products) + GIN/GiST indexes + `search_all()` ranked RPC + `refresh_search_index()` |
| `phase29_search_refresh_cron.sql` | Enables `pg_cron` and schedules `refresh_search_index()` every 10 min (job `vendorly_refresh_search_index`, unscheduled-by-name before re-create) |
| `phase30_chef_geo.sql` | Chef hyperlocal geo: `latitude`/`longitude` + generated `geog` + GiST on `chefs`, `find_nearby_chefs()` RPC, and `search_index` rebuild so chef rows carry `geog` |
| `phase31_leftovers_search.sql` | Adds `leftover_listings` to `search_index` as `entity_type='leftover'` (active/in-stock/unexpired/approved-vendor; geo from `pickup_geog`) |

## Enhanced plan sections vs repo

| Section | Status | Notes |
|---------|--------|-------|
| 1. Trust & verification | ✅ SQL + mobile UI | Credential upload (vendor/chef) + admin approve/reject awards badges; `phase23c` private bucket |
| 2. Compliance (cottage food) | ✅ SQL + util | TX/CA/CO seed; `generateCompliantLabel()` |
| 3. Unified discovery | ✅ SQL + mobile + web | `phase28_search_index.sql` adds a `search_index` materialized view UNION-ing vendors/chefs/events/products into a common shape (`entity_type`/`entity_id`/`title`/`subtitle`/`description`/`city`/`state`/`image_url`/`geog`/`search_tsv`/`metadata`/`created_at`), GIN(`search_tsv`) + GiST(`geog`) indexes, and a SECURITY DEFINER `search_all(p_query, p_lat, p_lng, p_limit, p_entity_types)` RPC ranking by `ts_rank` + geo proximity (`ST_Distance`, km). Mobile `unified-search.ts` + web `unified-search.ts`/`ShopperHomePage` now call `search_all` (graceful fallback to the old client-side per-vertical merge on RPC error). `phase30` gives chefs `geog` so they rank by distance too; `phase31` adds `leftover_listings` (`entity_type='leftover'`) to the index and clients map/render them (link to leftover detail). `phase29` auto-refreshes the matview every 10 min via `pg_cron` (`refresh_search_index()`), so it is no longer manual |
| 4. Enhanced reviews | ✅ SQL + UI | `reviews`, `rating_aggregates`; vendor/chef/**product**/**service** submit+list UI on web+mobile (`ReviewsSection`); `phase26` adds service target. Averages computed client-side from the review list |
| 5. Inventory holds | ✅ SQL | `reserve_inventory()` RPC; checkout not wired |
| 6. Hyperlocal (PostGIS) | ✅ SQL + mobile | `phase24_geo_search.sql` enables PostGIS + `find_nearby_*` RPCs (geography `ST_DWithin`/`ST_Distance`); `phase30` adds `find_nearby_chefs` + chef `geog` for full parity. Mobile search + home discovery geo-rank events with "X mi away" labels and fall back to text/bbox when coords/RPC unavailable |
| 7. Onboarding wizard | 🟡 Address capture done | Vendor setup has `vendor_type`; `phase27` adds street address + ZIP capture to vendor + chef setup (web+mobile). Vendor **and chef** saves auto-geocode the address via shared `lib/geocode.ts` (Nominatim, full-address→city/state-centroid fallback, never blocks save) → `latitude/longitude` so `find_nearby_vendors`/`find_nearby_chefs` return accurate points. The mobile storefront editor also re-geocodes when the city/state changes. Multi-step wizard still not built |
| 8. Messaging | ❌ Phase 2 | Schema in plan only — do not build yet |
| 9. Navigation (Messages tab) | ❌ Phase 2 | Current tabs: Home, Explore, Markets, Map, Feed, Search, Profile |
| 10. New components | 🔲 Partial | Trust badges, compliance util; reviews/messaging TBD |
| 11. Phase 1 timeline | 🔲 In progress | See `VENDORLY_MIGRATION.md` |

## Mobile additions (this pass)

- `mobile/src/lib/compliance.ts` — label generation + checklist
- `mobile/src/lib/verification.ts` — credential upload, fetch/submit/delete, admin approve/reject, badge award
- `mobile/src/components/trust/verification-badge.tsx`
- `mobile/src/components/trust/credential-manager.tsx` — shared submit form + status list
- `mobile/app/(vendor)/compliance/` — checklist + credential submit/list
- `mobile/app/(chef)/credentials.tsx` — chef credential submit/list
- `mobile/app/(admin)/credentials/` — admin review (approve/reject)
- Types for verification, compliance, reviews

## Next recommended slices

1. Apply `phase23_vendorly_enhanced.sql` + `phase23c_verification_docs.sql` in Supabase
2. Wire `reserve_inventory()` into checkout/reserve flow
3. ~~Review submit/display UI on vendor/chef profiles~~ ✅ vendor/chef/product/service reviews on web+mobile (`phase26` adds `reviews.service_id`)
4. ~~Credential document upload (Supabase Storage)~~ ✅ vendor/chef upload + admin review
5. ~~PostGIS `find_nearby()` for geo-ranked search~~ ✅ `phase24_geo_search.sql` + mobile wiring (events). ~~Follow-up: populate `vendors.latitude/longitude` so `find_nearby_vendors` returns rows~~ ✅ `phase27` + onboarding auto-geocode now writes `vendors.latitude/longitude` on save. ~~consider a materialized `search_index` for cross-vertical ranking~~ ✅ `phase28_search_index.sql` (`search_all` RPC + mobile/web wiring). ~~schedule `refresh_search_index()`~~ ✅ `phase29` `pg_cron` every 10 min; ~~add chef geo (`find_nearby_chefs`)~~ ✅ `phase30`; ~~add `leftover_listings` to the index~~ ✅ `phase31`; ~~backfill existing vendors that only have `sell_city`/`sell_state`~~ ✅ idempotent Nominatim backfill (vendors + chefs) — no-op at run time (1 vendor already geocoded, 0 chefs)
6. ~~Explore content creation UI~~ ✅ vendor + chef post to `explore_content`
7. ~~Customer saved items + quote accept/decline~~ ✅

## Explicitly Phase 2+ (do not build)

Stripe, push notifications, in-app messaging threads, delivery logistics, multi-vendor cart, AI recommendations, organizer portal.
