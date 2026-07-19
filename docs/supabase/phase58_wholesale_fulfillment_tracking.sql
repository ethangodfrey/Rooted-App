-- Vendorly Phase 58 — Wholesale Fulfillment Engine & Carrier Tracking
-- Run in Supabase SQL Editor after phase57_wholesale_order_acceptance.sql.
--
-- Extends:
--   * wholesale_order_status — ORDER_SHIPPED_IN_TRANSIT
--   * wholesale_orders carrier/tracking/ETA columns
-- Telemetry: ORDER_FULFILLMENT_TRACKED, LOGISTICS_MANIFEST_VALID

-- ---------------------------------------------------------------------------
-- A. Status enum extension
-- ---------------------------------------------------------------------------
alter type public.wholesale_order_status
  add value if not exists 'ORDER_SHIPPED_IN_TRANSIT';

-- ---------------------------------------------------------------------------
-- B. Carrier tracking columns on wholesale_orders
-- ---------------------------------------------------------------------------
alter table public.wholesale_orders
  add column if not exists carrier_name text;

alter table public.wholesale_orders
  add column if not exists tracking_number text;

alter table public.wholesale_orders
  add column if not exists estimated_delivery_at timestamptz;

alter table public.wholesale_orders
  add column if not exists shipped_at timestamptz;

comment on column public.wholesale_orders.carrier_name is
  'Carrier label (FedEx, UPS, Freight Carrier, ...) captured at fulfillment.';
comment on column public.wholesale_orders.tracking_number is
  'Carrier tracking number for in-transit wholesale shipments.';
comment on column public.wholesale_orders.estimated_delivery_at is
  'Supplier-provided estimated delivery timestamp.';
comment on column public.wholesale_orders.shipped_at is
  'Timestamp when status transitioned to ORDER_SHIPPED_IN_TRANSIT.';

create index if not exists wholesale_orders_tracking_idx
  on public.wholesale_orders (tracking_number)
  where tracking_number is not null;

create index if not exists wholesale_orders_shipped_idx
  on public.wholesale_orders (shipped_at)
  where shipped_at is not null;
