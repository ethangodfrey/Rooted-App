# Supabase migrations

## Apply order

Run in Supabase SQL Editor **after** all prior phases. Scripts are idempotent where noted (`DROP IF EXISTS`).

Minimum Vendorly stack through phase31:

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
```

Optional next: `phase32_stripe_messaging.sql` (Stripe Connect + messaging).

## Key RPCs

- `search_all()` — unified ranked search (vendors, chefs, events, products, leftovers)
- `find_nearby_events/vendors/chefs/leftovers()` — PostGIS geo ranking
- `refresh_search_index()` — matview refresh (pg_cron every 10 min via phase29)

## Status tracker

See `docs/VENDORLY_MIGRATION.md` for phase completion table.

## Rules

- Never commit real keys or `.env`
- Re-run failed script from start of that file — do not skip phases
