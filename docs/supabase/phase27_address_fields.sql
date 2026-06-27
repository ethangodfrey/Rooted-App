-- Vendorly Phase 27 — Street-address capture for vendor (and chef) onboarding
-- Run in Supabase SQL Editor after phase26_service_reviews.sql.
--
-- Implements enhanced-plan section 7 (Onboarding / address capture). Today
-- `public.vendors` only stores `sell_city` + `sell_state`, so geocoding can only
-- resolve a city centroid. This adds a real street address + postal code so
-- onboarding can geocode an exact point into the existing `latitude`/`longitude`
-- columns (added in phase24_geo_search.sql) that feed the generated `geog`
-- column and the `find_nearby_vendors` RPC.
--
-- Scope notes:
--   * vendors already have nullable latitude/longitude/geog (phase24) — those are
--     NOT re-added here; only the address text fields are new.
--   * chefs get the same address text fields for parity/completeness, but chefs
--     have no latitude/longitude/geog columns and there is no find_nearby_chefs
--     RPC, so this migration does NOT add chef geo. Chef geocoding is left as a
--     follow-up (see docs/VENDORLY_MIGRATION.md).
--
-- Idempotent: every statement uses `add column if not exists` and all new
-- columns are nullable, so this is safe to run multiple times.

-- ---------------------------------------------------------------------------
-- A. Vendors — street address fields
-- ---------------------------------------------------------------------------
alter table public.vendors
  add column if not exists street_address text,
  add column if not exists postal_code    text,
  add column if not exists country         text default 'USA';

-- ---------------------------------------------------------------------------
-- B. Chefs — street address fields (parity; no geo columns added)
-- ---------------------------------------------------------------------------
alter table public.chefs
  add column if not exists street_address text,
  add column if not exists postal_code    text,
  add column if not exists country         text default 'USA';
