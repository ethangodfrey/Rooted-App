-- Phase 84 — Product wholesale MOQ + chef/vendor procurement escrow orders
-- Apply after phase75 (B2B marketplace) and phase78 (financial clearing).
--
-- Telemetry: B2B_WHOLESALE_ACTIVE, CHEF_PROCUREMENT_INITIALIZED

-- ---------------------------------------------------------------------------
-- 1. Consumer products — wholesale attributes for verified suppliers
-- ---------------------------------------------------------------------------

alter table public.products
  add column if not exists is_wholesale_eligible boolean not null default false;

alter table public.products
  add column if not exists moq_quantity integer
    check (moq_quantity is null or moq_quantity >= 1);

alter table public.products
  add column if not exists wholesale_price_cents integer
    check (wholesale_price_cents is null or wholesale_price_cents >= 0);

comment on column public.products.is_wholesale_eligible is
  'When true, product appears in Private Chef / vendor wholesale procurement catalog.';

comment on column public.products.moq_quantity is
  'Minimum order quantity (packaging units) required for wholesale_price_cents.';

comment on column public.products.wholesale_price_cents is
  'Discounted unit price in integer cents for commercial buyers (chefs / vendors).';

create index if not exists products_wholesale_eligible_idx
  on public.products (is_wholesale_eligible)
  where is_wholesale_eligible = true;

-- ---------------------------------------------------------------------------
-- 2. Chef / vendor procurement orders (Stripe Connect escrow)
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'chef_procurement_order_status'
  ) then
    create type public.chef_procurement_order_status as enum (
      'AWAITING_PAYMENT',
      'HELD_IN_ESCROW',
      'READY_FOR_PICKUP',
      'SETTLED',
      'CANCELLED'
    );
  end if;
end $$;

create table if not exists public.chef_procurement_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_user_id uuid not null references public.users (id) on delete cascade,
  buyer_role text not null
    check (buyer_role in ('chef', 'vendor')),
  buyer_vendor_id uuid references public.vendors (id) on delete set null,
  seller_vendor_id uuid not null references public.vendors (id) on delete restrict,
  status public.chef_procurement_order_status not null
    default 'AWAITING_PAYMENT'::public.chef_procurement_order_status,
  subtotal_cents integer not null check (subtotal_cents >= 0),
  pickup_code text not null,
  escrow_transaction_id uuid,
  stripe_checkout_session_id text,
  paid_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.chef_procurement_orders is
  'Bulk B2B procurement by Private Chefs or verified vendors; funds HELD_IN_ESCROW until pickup code verified.';

create index if not exists chef_procurement_orders_buyer_idx
  on public.chef_procurement_orders (buyer_user_id, status);

create index if not exists chef_procurement_orders_seller_idx
  on public.chef_procurement_orders (seller_vendor_id, status);

create index if not exists chef_procurement_orders_pickup_idx
  on public.chef_procurement_orders (pickup_code);

create table if not exists public.chef_procurement_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.chef_procurement_orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  product_name text not null,
  quantity integer not null check (quantity >= 1),
  moq_quantity integer not null check (moq_quantity >= 1),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents >= 0)
);

create index if not exists chef_procurement_order_items_order_idx
  on public.chef_procurement_order_items (order_id);

create index if not exists chef_procurement_order_items_product_idx
  on public.chef_procurement_order_items (product_id);

alter table public.chef_procurement_orders enable row level security;
alter table public.chef_procurement_order_items enable row level security;

drop policy if exists "Buyers read own chef procurement orders" on public.chef_procurement_orders;
create policy "Buyers read own chef procurement orders"
  on public.chef_procurement_orders for select
  to authenticated
  using (buyer_user_id = auth.uid());

drop policy if exists "Sellers read chef procurement sales" on public.chef_procurement_orders;
create policy "Sellers read chef procurement sales"
  on public.chef_procurement_orders for select
  to authenticated
  using (
    seller_vendor_id in (
      select id from public.vendors where user_id = auth.uid()
    )
  );

drop policy if exists "Buyers read own chef procurement items" on public.chef_procurement_order_items;
create policy "Buyers read own chef procurement items"
  on public.chef_procurement_order_items for select
  to authenticated
  using (
    order_id in (
      select id from public.chef_procurement_orders where buyer_user_id = auth.uid()
    )
  );
