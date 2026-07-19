-- Vendorly Phase 59 — Wholesale Delivery Confirmation & Settlement Logs
-- Run in Supabase SQL Editor after phase58_wholesale_fulfillment_tracking.sql.
--
-- Extends:
--   * wholesale_order_status — ORDER_DELIVERY_CONFIRMED
--   * wholesale_orders delivery confirmation timestamps
--   * wholesale_settlement_logs — buyer delivery ledger rows
-- Telemetry: ORDER_DELIVERY_CONFIRMED, WHOLESALE_LEDGER_SETTLED

-- ---------------------------------------------------------------------------
-- A. Status enum extension
-- ---------------------------------------------------------------------------
alter type public.wholesale_order_status
  add value if not exists 'ORDER_DELIVERY_CONFIRMED';

-- ---------------------------------------------------------------------------
-- B. Delivery confirmation columns
-- ---------------------------------------------------------------------------
alter table public.wholesale_orders
  add column if not exists delivered_at timestamptz;

alter table public.wholesale_orders
  add column if not exists delivery_confirmed_at timestamptz;

comment on column public.wholesale_orders.delivered_at is
  'Buyer-reported delivery timestamp captured at settlement.';
comment on column public.wholesale_orders.delivery_confirmed_at is
  'Server timestamp when status transitioned to ORDER_DELIVERY_CONFIRMED.';

create index if not exists wholesale_orders_delivered_idx
  on public.wholesale_orders (delivered_at)
  where delivered_at is not null;

-- ---------------------------------------------------------------------------
-- C. Settlement ledger
-- ---------------------------------------------------------------------------
create table if not exists public.wholesale_settlement_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.wholesale_orders (id) on delete cascade,
  buyer_vendor_id uuid not null references public.vendors (id) on delete cascade,
  seller_vendor_id uuid not null references public.vendors (id) on delete cascade,
  subtotal_cents integer not null
    check (subtotal_cents >= 0),
  delivered_at timestamptz not null,
  settled_at timestamptz not null default now(),
  constraint wholesale_settlement_logs_order_unique unique (order_id)
);

comment on table public.wholesale_settlement_logs is
  'Immutable buyer delivery settlement ledger for wholesale orders.';

create index if not exists wholesale_settlement_logs_buyer_idx
  on public.wholesale_settlement_logs (buyer_vendor_id, settled_at desc);

create index if not exists wholesale_settlement_logs_seller_idx
  on public.wholesale_settlement_logs (seller_vendor_id, settled_at desc);

alter table public.wholesale_settlement_logs enable row level security;

drop policy if exists "B2B vendors read own settlement logs"
  on public.wholesale_settlement_logs;
create policy "B2B vendors read own settlement logs"
  on public.wholesale_settlement_logs for select
  using (
    exists (
      select 1 from public.vendors v
      where v.user_id = auth.uid()
        and (v.id = buyer_vendor_id or v.id = seller_vendor_id)
    )
  );

drop policy if exists "B2B buyers insert settlement logs"
  on public.wholesale_settlement_logs;
create policy "B2B buyers insert settlement logs"
  on public.wholesale_settlement_logs for insert
  with check (
    exists (
      select 1 from public.vendors v
      where v.user_id = auth.uid()
        and v.id = buyer_vendor_id
    )
  );

-- Buyers may update their own inbound shipped orders (delivery confirmation).
drop policy if exists "B2B buyers confirm wholesale delivery"
  on public.wholesale_orders;
create policy "B2B buyers confirm wholesale delivery"
  on public.wholesale_orders for update
  using (
    exists (
      select 1 from public.vendors v
      where v.user_id = auth.uid()
        and v.id = buyer_vendor_id
    )
  )
  with check (
    exists (
      select 1 from public.vendors v
      where v.user_id = auth.uid()
        and v.id = buyer_vendor_id
    )
  );
