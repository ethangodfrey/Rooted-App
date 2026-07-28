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
docs/supabase/migrations/20260717_b2b_connections.sql # vendor_connections + B2B threads
docs/supabase/phase53_nationwide_directory_geo.sql # markets.directory_slug + operating_hours + geo indexes
docs/supabase/phase54_b2b_wholesale_marketplace.sql # vendor_business_connections + wholesale_products
docs/supabase/phase55_market_theme_branding.sql # markets theme_* colors for tenant injection
docs/supabase/phase56_wholesale_order_drafts.sql # wholesale_orders + wholesale_order_items drafts
docs/supabase/phase57_wholesale_order_acceptance.sql # accept/reject + available_quantity reservation
docs/supabase/phase58_wholesale_fulfillment_tracking.sql # ORDER_SHIPPED_IN_TRANSIT + carrier tracking
docs/supabase/phase59_wholesale_delivery_settlement.sql # ORDER_DELIVERY_CONFIRMED + settlement ledger
docs/supabase/phase60_wholesale_invoices_net_terms.sql # wholesale_invoices Net-30 billing
docs/supabase/phase61_invoice_reconciliation.sql # paid_at + seller reconcile-to-PAID
docs/supabase/phase62a_invoice_status_enum.sql # add PENDING/OVERDUE enum values (run alone)
docs/supabase/phase62b_invoice_pending_backfill.sql # ISSUED→PENDING backfill (after 62a)
docs/supabase/phase63_wholesale_stripe_payments.sql # PAYMENT_SETTLED + Stripe PaymentIntent columns
docs/supabase/phase64_vendor_peer_connections.sql # vendor_peer_connections wholesale peer edges
docs/supabase/phase65_wholesale_retail_pricing.sql # is_retail_enabled + retail_price on wholesale_products
docs/supabase/phase68a_orders_partitioning_strategy.sql # orders monthly RANGE strategy registry
docs/supabase/phase68b_orders_partition_migration_safe.sql # preferred orders partition cutover
docs/supabase/phase83a_home_private_chef_vendor_types.sql # home_kitchen/private_chef/micro_brand personas
docs/supabase/phase83b_vendor_connections.sql # V2V vendor_connections + products.visibility
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
`20260717_b2b_connections.sql` creates `vendor_connections` (pending|connected|ignored) with unordered unique pairs and opens B2B `conversation_threads` on accept.
Phase53 adds nationwide directory geo columns and indexes on `markets`.
Phase54–63 cover the B2B wholesale marketplace (catalog, orders, fulfillment, invoices, Stripe payments). See `docs/VENDORLY_MIGRATION.md`.
Phase64 adds `vendor_peer_connections` (wholesale peer edges; distinct from profile `vendor_connections`).
Phase65 adds retail sale fields on `wholesale_products`.
Phase68a registers monthly RANGE partitioning strategy for `orders` / `order_items`; phase68b performs cutover. Ops runbook: `docs/WHOLESALE_DISCOVERY_AND_PARTITIONING.md`.
Phase83a expands `vendors.vendor_type` (home_kitchen, private_chef, micro_brand) and persona columns; phase83b adds profile-level `vendor_connections` + `products.visibility`. Distinct from phase64 `vendor_peer_connections`. Runbook: `docs/PHASE83_DEFERRED_FEATURES_AMEND.md`.
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
