# Vendorly Marketplace — Migration Guide

**Former name:** Rooted  
**Tagline:** Your local food marketplace — private chefs, home cooks, and farmers markets in one place.

## Phase 1 status

| Step | Status | Notes |
|------|--------|-------|
| Database migration SQL | ✅ | `docs/supabase/phase22_vendorly_marketplace.sql` |
| Role: customer / chef | ✅ | Auth, onboarding, role guards |
| Chef module | ✅ | Dashboard, services, bookings, quote flow |
| Chef browse + book inquiry | ✅ | `(shopper)/chefs/` |
| Explore tab (read) | ✅ | `(shopper)/(tabs)/explore.tsx` |
| Unified search tab | ✅ | `(shopper)/(tabs)/search.tsx` + `unified-search.ts` |
| Vendor direct-sale product fields | ✅ | Product form availability_type, pickup/delivery |
| Vendor type on application | ✅ | Vendor setup vendor_type picker |
| Web types parity | ✅ | `web/src/types/database.ts` |
| Rebrand key auth/welcome copy | ✅ | Logo, signup, welcome, vendor setup |
| Full rebrand (all Rooted strings) | ✅ | Web/mobile UI, POS/analytics copy, logo SVGs, OAuth pages, AI prompts, READMEs, package names |
| Inventory holds in checkout | ✅ | `reserve.tsx` + `phase23b_inventory_holds_checkout.sql` |
| Chef booking quote accept/decline | ✅ | `(shopper)/bookings/[id].tsx` |
| Customer saved items UI | ✅ | `use-saved-items.ts`, `(shopper)/saved/` |
| Vendor reviews (submit + list) | ✅ | `(shopper)/vendors/[id].tsx` + `reviews.ts` |
| Explore content creation UI | ✅ | `(vendor)/explore/`, `(chef)/explore/new` → `explore_content` |
| Chef portfolio upload | ✅ | `(chef)/(tabs)/portfolio.tsx` lists + creates explore posts |
| Credential upload + admin review | ✅ | Vendor/chef submit → `(admin)/credentials` approve/reject + `phase23c_verification_docs.sql` |
| Hyperlocal geo search (PostGIS) | ✅ | `phase24_geo_search.sql` + `geo-search.ts`; customer search + home "Markets near you" geo-rank events |
| Web app Vendorly parity | 🟡 | Phase 1b — landed: types parity, chef role onboarding + routing, customer chef browse/book + bookings (quote accept/decline), Explore feed (read), reviews (vendor+chef submit/list), saved chefs (`saved_items`), vendor credentials + Explore showcase, full chef portal (`/chef` dashboard/services/bookings/portfolio/credentials/setup), admin credential review (`/admin/credentials`), customer trust badges (`TrustBadges` on vendor+chef pages via `user_badges`→`trust_badges`), saved-items "Saved" page (`/shopper/saved`), chef profile photo + banner upload (`product-media` bucket). Deferred: `(shopper)`→`(customer)` route rename |
| Product + service reviews (submit + list) | ✅ | Web + mobile via shared `ReviewsSection` (`targetType="product"` on product pages, `"service"` on chef service/booking pages); `phase26_service_reviews.sql` adds `reviews.service_id` + `'service'` target_type |
| Onboarding street-address capture + auto-geocode | ✅ | `phase27_address_fields.sql` adds `street_address`/`postal_code`/`country` to `vendors`+`chefs`; vendor setup (web `VendorSetupPage` + mobile `(vendor)/profile/setup`) and chef setup (web `ChefSetupPage` + mobile `(chef)/profile/setup`) capture address; shared `geocode.ts` (web+mobile) geocodes vendor address → `latitude`/`longitude` (feeds `geog` + `find_nearby_vendors`). Chef geo skipped (no `find_nearby_chefs` RPC). |
| Cross-vertical unified discovery (search_index) | ✅ | `phase28_search_index.sql` adds the `search_index` materialized view (vendors/chefs/events/products) + GIN/GiST indexes + `search_all()` ranked RPC + `refresh_search_index()`. Mobile `unified-search.ts` and web `unified-search.ts`/`ShopperHomePage` call `search_all` (text relevance + geo distance), falling back to the legacy client-side merge on RPC error. Chef services stay a separate query (not indexed). |
| Auto-refresh search_index (pg_cron) | ✅ | `phase29_search_refresh_cron.sql` enables `pg_cron` and schedules `refresh_search_index()` every 10 min (job `vendorly_refresh_search_index`, unscheduled-by-name then re-created so re-runs never duplicate). Verified live via `cron.job`. |
| Chef hyperlocal geo (end-to-end) | ✅ | `phase30_chef_geo.sql` adds `latitude`/`longitude` + generated `geog` + GiST to `chefs` (mirrors phase24 vendors), adds `find_nearby_chefs()` (approved-only), and rebuilds `search_index` so chef rows carry `geog`. Chef setup (web `ChefSetupPage` + mobile `(chef)/profile/setup`) now geocodes on save via shared `geocode.ts`. |
| Leftovers in unified search | ✅ | `phase31_leftovers_search.sql` adds `leftover_listings` to `search_index` as `entity_type='leftover'` (active, in-stock, unexpired, approved vendor; geo from phase24 `pickup_geog`). Mobile + web `unified-search.ts` map the `leftover` type; search UIs render a Leftovers result linking to the leftover detail route. |
| Route rename `(shopper)` → `(customer)` | 🔲 | Optional cleanup |

## Apply database changes

Run in Supabase SQL Editor **after** all prior phase scripts.

**If a run fails partway through**, re-run the same file — phase22/phase23 are idempotent (policies use `DROP IF EXISTS`).

```
docs/supabase/phase22_vendorly_marketplace.sql
docs/supabase/phase23_vendorly_enhanced.sql   # trust, compliance, reviews, inventory
docs/supabase/phase23b_inventory_holds_checkout.sql   # reserve_inventory checkout RPCs
docs/supabase/phase23c_verification_docs.sql   # private verification-docs bucket + storage RLS
docs/supabase/phase24_geo_search.sql   # PostGIS + find_nearby_* geo-ranking RPCs
docs/supabase/phase25_saved_items_backfill.sql   # backfill legacy saved_vendors/events into saved_items
docs/supabase/phase26_service_reviews.sql   # reviews.service_id + 'service' target_type for chef-service-level reviews
docs/supabase/phase27_address_fields.sql   # street_address/postal_code/country on vendors + chefs (onboarding geocoding)
docs/supabase/phase28_search_index.sql   # search_index matview + search_all() unified ranked RPC
docs/supabase/phase29_search_refresh_cron.sql   # pg_cron job: refresh_search_index() every 10 min
docs/supabase/phase30_chef_geo.sql   # chef latitude/longitude/geog + find_nearby_chefs + matview rebuild (chef geog)
docs/supabase/phase31_leftovers_search.sql   # add leftover_listings to search_index (entity_type='leftover')
```

`phase24` enables the `postgis` extension, adds generated `geography` columns
(+ GiST indexes) to `events`, `vendors`, and `leftover_listings`, and creates
the `find_nearby_events` / `find_nearby_vendors` / `find_nearby_leftovers` RPCs
(execute granted to `anon` + `authenticated`). Re-runnable.

`phase27` adds nullable `street_address` / `postal_code` / `country` (default
`'USA'`) to `vendors` and `chefs` so onboarding can capture a real street
address. The vendor setup flow geocodes that address via Nominatim (shared
`lib/geocode.ts`, descriptive User-Agent, full-address → city/state-centroid
fallback, never blocks the save) and writes `vendors.latitude`/`longitude`,
which feed the generated `geog` column and `find_nearby_vendors`. **Chefs** got
the same address fields for parity here; chef geo (lat/lng/`geog` +
`find_nearby_chefs`) was added later in `phase30`. Idempotent (`add column if not
exists`).

`phase28` builds **cross-vertical unified discovery**. It (re)creates the
`public.search_index` **materialized view** that UNION ALLs publicly-visible
vendors (`approval_status='approved'`), chefs (`approval_status='approved'`),
events (`visibility_status='public'`), and products (`status='active'`) into a
common shape (`entity_type`, `entity_id`, `title`, `subtitle`, `description`,
`city`, `state`, `image_url`, `geog`, `search_tsv`, `metadata` jsonb,
`created_at`). A **materialized** view is required because Postgres can only
index tables/matviews — the GIN index on `search_tsv` and GiST index on `geog`
that make ranking fast cannot exist on a plain view. The `search_all(p_query,
p_lat, p_lng, p_limit, p_entity_types)` SECURITY DEFINER RPC (granted to
`anon`+`authenticated`) ranks rows by `ts_rank * 10 + 1/(1+distance_km/5)`
(text relevance dominant, geo proximity a bounded boost), returns `distance_km`
(null without coords or for rows lacking `geog`, e.g. all chefs), and respects
`p_entity_types`. Products inherit their vendor's `geog`. Idempotent
(drops+recreates the derived matview; `create or replace` for the RPCs).

`phase29` removes the manual-refresh caveat: it enables **`pg_cron`**
(`create extension if not exists pg_cron`) and schedules
`select public.refresh_search_index();` every 10 minutes as job
`vendorly_refresh_search_index`. The job is unscheduled by name (if present)
before being re-created, so re-running never duplicates it. (If a connection
can't enable `pg_cron`, the fallback is a `@nestjs/schedule` task in the backend
that calls the refresh — not needed here since `pg_cron` enabled cleanly.)
Verified live by querying `cron.job`.

`phase30` finishes **chef hyperlocal geo**, mirroring phase24's vendor model:
nullable `latitude`/`longitude` + a generated `geog geography(Point,4326)` (+
GiST index) on `chefs`, and `find_nearby_chefs(p_lat,p_lng,p_radius_km,p_limit,
p_search)` (SECURITY DEFINER, approved-only, `anon`+`authenticated`). It rebuilds
`search_index` so chef rows carry real `geog` (previously hard-coded null),
recreating the matview indexes + `search_all`/`refresh_search_index` dropped by
the `drop ... cascade`. Chef setup screens (web `ChefSetupPage`, mobile
`(chef)/profile/setup`) now geocode on save via the shared `geocode.ts` (same
graceful fallback as vendors). Idempotent.

`phase31` folds **leftover listings** into unified search as
`entity_type='leftover'` (active, in-stock, unexpired, available, owned by an
approved vendor; geo from phase24 `pickup_geog`). It rebuilds the matview and
recreates indexes + functions. Mobile/web `unified-search.ts` map the new type
and the search UIs render a Leftovers result that links to the existing leftover
detail route.

A one-off backfill (throwaway Node + `pg` runner using `geocode.ts`'s
Nominatim logic, ~1.1s rate limit, idempotent skip-if-coords) geocodes existing
vendors/chefs that have an address but no `latitude`. At the time of writing only
1 vendor existed (already geocoded) and 0 chefs, so it was a no-op; it ends with
`refresh_search_index()`.

See also `docs/VENDORLY_ENHANCED_PLAN.md` for enhanced-plan gap tracker.

## Role mapping

| Vendorly role | DB `users.role` | Extension table |
|---------------|-----------------|-----------------|
| Customer | `customer` | `shoppers` (legacy table name) |
| Vendor | `vendor` | `vendors` |
| Chef | `chef` | `chefs` |
| Admin | `admin` | — |

Code treats `shopper` as deprecated alias for `customer`.

## Not in Phase 1

- Stripe / payments
- In-app messaging
- Push notifications
- Multi-vendor cart
- Delivery tracking
