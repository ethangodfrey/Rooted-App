-- Vendorly Phase 56 — Wholesale Order Draft Builder
-- Run in Supabase SQL Editor after phase54_b2b_wholesale_marketplace.sql.
--
-- Introduces:
--   * wholesale_orders — multi-tenant B2B draft headers
--   * wholesale_order_items — line items with negotiated tier unit prices
-- Telemetry vocabulary: ORDER_DRAFT_INITIALIZED, WHOLESALE_PAYLOAD_VALID

-- ---------------------------------------------------------------------------
-- A. Enums
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.wholesale_order_status as enum (
    'ORDER_DRAFT_INITIALIZED'
  );
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- B. Wholesale order drafts
-- ---------------------------------------------------------------------------
create table if not exists public.wholesale_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_vendor_id uuid not null references public.vendors (id) on delete cascade,
  seller_vendor_id uuid not null references public.vendors (id) on delete cascade,
  status public.wholesale_order_status not null default 'ORDER_DRAFT_INITIALIZED',
  currency text not null default 'USD',
  subtotal_cents integer not null
    check (subtotal_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wholesale_orders_no_self
    check (buyer_vendor_id <> seller_vendor_id)
);

comment on table public.wholesale_orders is
  'B2B wholesale order drafts between buyer and seller directory vendors.';

create index if not exists wholesale_orders_buyer_idx
  on public.wholesale_orders (buyer_vendor_id, status);

create index if not exists wholesale_orders_seller_idx
  on public.wholesale_orders (seller_vendor_id, status);

create index if not exists wholesale_orders_created_idx
  on public.wholesale_orders (created_at);

create or replace function public.set_wholesale_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wholesale_orders_set_updated_at
  on public.wholesale_orders;
create trigger wholesale_orders_set_updated_at
  before update on public.wholesale_orders
  for each row execute function public.set_wholesale_orders_updated_at();

-- ---------------------------------------------------------------------------
-- C. Wholesale order line items
-- ---------------------------------------------------------------------------
create table if not exists public.wholesale_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.wholesale_orders (id) on delete cascade,
  product_sku_id uuid not null references public.wholesale_products (id) on delete restrict,
  quantity integer not null
    check (quantity >= 1),
  negotiated_tier_unit_price integer not null
    check (negotiated_tier_unit_price >= 0),
  line_total_cents integer not null
    check (line_total_cents >= 0),
  created_at timestamptz not null default now()
);

comment on table public.wholesale_order_items is
  'Line items for wholesale order drafts (SKU, qty, negotiated tier unit price cents).';

create index if not exists wholesale_order_items_order_idx
  on public.wholesale_order_items (order_id);

create index if not exists wholesale_order_items_sku_idx
  on public.wholesale_order_items (product_sku_id);

-- ---------------------------------------------------------------------------
-- D. RLS
-- ---------------------------------------------------------------------------
alter table public.wholesale_orders enable row level security;
alter table public.wholesale_order_items enable row level security;

drop policy if exists "B2B vendors read own wholesale orders"
  on public.wholesale_orders;
create policy "B2B vendors read own wholesale orders"
  on public.wholesale_orders for select
  using (
    exists (
      select 1 from public.vendors v
      where v.user_id = auth.uid()
        and (v.id = buyer_vendor_id or v.id = seller_vendor_id)
    )
  );

drop policy if exists "B2B buyers insert wholesale order drafts"
  on public.wholesale_orders;
create policy "B2B buyers insert wholesale order drafts"
  on public.wholesale_orders for insert
  with check (
    exists (
      select 1 from public.vendors v
      where v.user_id = auth.uid()
        and v.id = buyer_vendor_id
    )
  );

drop policy if exists "B2B vendors read wholesale order items"
  on public.wholesale_order_items;
create policy "B2B vendors read wholesale order items"
  on public.wholesale_order_items for select
  using (
    exists (
      select 1
      from public.wholesale_orders o
      join public.vendors v on v.user_id = auth.uid()
      where o.id = order_id
        and (v.id = o.buyer_vendor_id or v.id = o.seller_vendor_id)
    )
  );

drop policy if exists "B2B buyers insert wholesale order items"
  on public.wholesale_order_items;
create policy "B2B buyers insert wholesale order items"
  on public.wholesale_order_items for insert
  with check (
    exists (
      select 1
      from public.wholesale_orders o
      join public.vendors v on v.user_id = auth.uid()
      where o.id = order_id
        and v.id = o.buyer_vendor_id
    )
  );
