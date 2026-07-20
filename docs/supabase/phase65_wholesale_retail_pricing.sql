-- Vendorly Phase 65 — Retail / consumer pricing on wholesale catalog SKUs
-- Run in Supabase SQL Editor after phase64_vendor_peer_connections.sql.
--
-- Adds optional retail sale fields so farmers can sell bulk SKUs at retail
-- pricing without wholesale MOQ / peer-connection gates.
--
-- Telemetry: RETAIL_SALE_MODE_ENABLED, PRODUCT_RETAIL_ENDPOINT_ACTIVE

alter table public.wholesale_products
  add column if not exists is_retail_enabled boolean not null default false,
  add column if not exists retail_price numeric(12, 4);

comment on column public.wholesale_products.is_retail_enabled is
  'When true, buyers may draft orders at retail_price without peer ACCEPTED / MOQ.';

comment on column public.wholesale_products.retail_price is
  'Optional retail unit price in USD (decimal dollars). Null until farmer enables retail.';

-- Explicit backfill for existing bulk products (idempotent).
update public.wholesale_products
set is_retail_enabled = false
where is_retail_enabled is distinct from false;
