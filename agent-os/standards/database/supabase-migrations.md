# Supabase migrations

## Apply order

Run in Supabase SQL Editor **after** all prior phases. Scripts are idempotent where noted (`DROP IF EXISTS`).

Minimum Vendorly stack through phase39:

```
docs/supabase/phase22_vendorly_marketplace.sql
docs/supabase/phase23_vendorly_enhanced.sql
docs/supabase/phase23b_inventory_holds_checkout.sql
docs/supabase/phase23c_verification_docs.sql
docs/supabase/phase24_geo_search.sql
docs/supabase/phase25_saved_items_backfill.sql
docs/supabase/phase26_service_reviews.sql
docs/supabase/phase27_address_fields.sql
docs/supabase/phase28_search_index.sql
docs/supabase/phase29_search_refresh_cron.sql
docs/supabase/phase30_chef_geo.sql
docs/supabase/phase31_leftovers_search.sql
docs/supabase/phase32_stripe_messaging.sql
docs/supabase/phase32_multi_tenant.sql
docs/supabase/phase33_explore_hybrid_feed.sql
docs/supabase/phase34_storefront_checkout.sql
docs/supabase/phase35_search_event_schedule.sql
docs/supabase/phase36_production_mvp_core_schema.sql
docs/supabase/phase37_vendor_media_feed_storage.sql
docs/supabase/phase38_ranked_vendor_feed.sql
docs/supabase/phase39_payments_kyc_ledger.sql
docs/supabase/phase42_regional_markets.sql
docs/supabase/phase42a_seed_markets_from_events.sql
docs/supabase/phase42b_backfill_orders_market_id.sql
docs/supabase/phase43_pos_national_markets_foundation.sql
docs/supabase/phase43c_pos_data_rls.sql
docs/supabase/phase44_national_harvester_pos_analytics.sql
docs/supabase/phase44c_national_harvester_pos_analytics_rls.sql
docs/supabase/phase45_pos_webhook_analytics.sql
docs/supabase/phase46_encrypted_credentials.sql
docs/supabase/phase47_pos_analytics_ingestion.sql
docs/supabase/phase48_pickup_codes_storefront.sql
docs/supabase/phase49_stripe_policy_snap_ebt.sql
docs/supabase/phase49_seed_snap_stripe_test_vendor.sql # optional smoke-test UPDATE for Connect + SNAP
docs/supabase/phase50_user_role_stickers.sql # shopper|vendor sticker roles; null until onboarding
docs/supabase/phase51_network_and_stickers.sql # profiles enum, follows, network_connections
docs/supabase/phase52_profile_specialties.sql # vendor_specialties + farmer_specialties
docs/supabase/farmers_markets_directory.sql
```

Optional (any time after `phase1_auth.sql`):

```
docs/supabase/phase22b_account_deletion.sql
```

Phase36 is additive and preserves legacy reservation/order/feed fields while
adding the production MVP transaction and vendor-profile schema.
Phase37 provisions the public signed-upload media bucket for vendor feeds.
Phase38 adds the cached hyper-local ranked vendor feed RPC.
Phase39 adds settlement holds and 1099-K compliance rollups.
Phase42 adds regional marketplace isolation (`regions`, `markets`, vendor registrations, `orders.market_id` + RLS).
Phase42b backfills `orders.market_id` from `markets.event_id` after phase42 is applied.
Phase42a seeds `markets` rows from legacy `public.events` (run before phase42b).
Phase43 adds POS OAuth foundation tables (`vendor_pos_connections`, `pos_transactions`) and the PostGIS-backed `national_farmers_markets` registry.
Phase44 extends regional `markets` with geo/schedules, adds `market_sales_snapshots` daily POS rollups, and tenant-routing columns on POS connection tables. See `docs/supabase/PHASE44_SCHEMA_REVIEW.md`.
Phase45 adds `pos_webhook_logs` (raw audit) and `analytics_sales` (normalized finance) with vendor/admin RLS.
Phase46 adds `encrypted_credentials` (AES-256-GCM vault) and hardens token column grants on `vendor_pos_connections`. See `docs/supabase/PHASE46_ENCRYPTED_CREDENTIALS_DESIGN.md`.
Phase47 adds platform-agnostic analytics ingest tables (`pos_analytics_transactions`, `pos_analytics_transaction_items`), a connections view, and ledger line items (`pos_transaction_items`). See `docs/supabase/PHASE47_POS_ANALYTICS_INGESTION.md`.
Phase48 updates `create_storefront_checkout` to mint 6-char `pickup_code`s (Nest alphabet), set fulfillment windows from the event, and bridge `orders.market_id` via `markets.event_id`.
Phase49 adds `vendors.preorder_payment_policy`, `vendors.accepts_snap_ebt`, and `products.is_snap_eligible` for Stripe pay-at-preorder UX and SNAP/EBT discovery filters.
Phase50 leaves `users.role` NULL until onboarding sticker selection (`shopper`|`vendor`).
Phase51 creates `profiles` (`profile_role` enum shopper|vendor|farmer), `farmers`, `follows` (`followed_profile_id`), and `network_connections` (`pending`|`connected`); syncs sticker fields into `users`.
Phase52 adds `vendor_specialties` / `farmer_specialties` text arrays on `profiles` (mirrored to `users`) for B2B discovery filters.
`farmers_markets_directory.sql` adds `public.farmers_markets` (PostGIS directory + GiST) for seedable national directory rows; complements `national_farmers_markets`. Seed with `npm run markets:seed-directory`.

## Key RPCs

- `search_all()` — unified ranked search (vendors, chefs, events, products, leftovers)
- `explore_hybrid_feed()` — geo + engagement ranked vendor posts + showcase feed (phase33)
- `find_nearby_events/vendors/chefs/leftovers()` — PostGIS geo ranking
- `refresh_search_index()` — matview refresh (pg_cron every 10 min via phase29)

## Status tracker

See `docs/VENDORLY_MIGRATION.md` for phase completion table.

## Rules

- Never commit real keys or `.env`
- Re-run failed script from start of that file — do not skip phases
