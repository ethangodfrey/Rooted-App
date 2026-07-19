-- Vendorly Phase 54 — Peer-to-Peer Business Marketplace & Bulk Wholesale
-- Run in Supabase SQL Editor after phase53_nationwide_directory_geo.sql (or phase52 if 53 not applied).
--
-- Introduces:
--   * vendor_business_connections — vendor↔vendor B2B partnership edges
--   * wholesale_products — bulk catalog distinct from consumer products
-- Telemetry vocabulary: B2B_CONNECTION_REQUESTED, WHOLESALE_SKU_INDEXED

-- ---------------------------------------------------------------------------
-- A. Enums
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.vendor_business_connection_status as enum (
    'PENDING',
    'ACCEPTED',
    'DECLINED'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.wholesale_product_status as enum (
    'ACTIVE',
    'ARCHIVED'
  );
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- B. Vendor business connections (directory Vendor ids)
-- ---------------------------------------------------------------------------
create table if not exists public.vendor_business_connections (
  id uuid primary key default gen_random_uuid(),
  sender_vendor_id uuid not null references public.vendors (id) on delete cascade,
  receiver_vendor_id uuid not null references public.vendors (id) on delete cascade,
  status public.vendor_business_connection_status not null default 'PENDING',
  initiated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendor_business_connections_no_self
    check (sender_vendor_id <> receiver_vendor_id),
  constraint vendor_business_connections_pair_key
    unique (sender_vendor_id, receiver_vendor_id)
);

comment on table public.vendor_business_connections is
  'B2B wholesale partnership requests between directory vendors (PENDING/ACCEPTED/DECLINED).';

create index if not exists vendor_business_connections_sender_idx
  on public.vendor_business_connections (sender_vendor_id, status);

create index if not exists vendor_business_connections_receiver_idx
  on public.vendor_business_connections (receiver_vendor_id, status);

create index if not exists vendor_business_connections_initiated_idx
  on public.vendor_business_connections (initiated_at);

create or replace function public.set_vendor_business_connections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vendor_business_connections_set_updated_at
  on public.vendor_business_connections;
create trigger vendor_business_connections_set_updated_at
  before update on public.vendor_business_connections
  for each row execute function public.set_vendor_business_connections_updated_at();

-- ---------------------------------------------------------------------------
-- C. Wholesale product catalog
-- ---------------------------------------------------------------------------
create table if not exists public.wholesale_products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  name text not null,
  description text,
  packaging_unit text not null,
  weight_lbs numeric(12, 4) not null
    check (weight_lbs > 0),
  moq integer not null
    check (moq >= 1),
  unit_price_cents integer not null
    check (unit_price_cents >= 0),
  pricing_tiers jsonb not null default '[]'::jsonb,
  freight_notes text,
  pickup_notes text,
  status public.wholesale_product_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.wholesale_products is
  'Bulk wholesale SKUs with MOQ, packaging units, and volume pricing tiers.';

create index if not exists wholesale_products_vendor_status_idx
  on public.wholesale_products (vendor_id, status);

create index if not exists wholesale_products_vendor_name_idx
  on public.wholesale_products (vendor_id, name);

create or replace function public.set_wholesale_products_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wholesale_products_set_updated_at
  on public.wholesale_products;
create trigger wholesale_products_set_updated_at
  before update on public.wholesale_products
  for each row execute function public.set_wholesale_products_updated_at();

-- ---------------------------------------------------------------------------
-- D. RLS (authenticated peers; service role bypasses)
-- ---------------------------------------------------------------------------
alter table public.vendor_business_connections enable row level security;
alter table public.wholesale_products enable row level security;

drop policy if exists "B2B vendors read own business connections"
  on public.vendor_business_connections;
create policy "B2B vendors read own business connections"
  on public.vendor_business_connections for select
  using (
    exists (
      select 1 from public.vendors v
      where v.user_id = auth.uid()
        and (v.id = sender_vendor_id or v.id = receiver_vendor_id)
    )
  );

drop policy if exists "B2B vendors insert business connection requests"
  on public.vendor_business_connections;
create policy "B2B vendors insert business connection requests"
  on public.vendor_business_connections for insert
  with check (
    exists (
      select 1 from public.vendors v
      where v.user_id = auth.uid()
        and v.id = sender_vendor_id
    )
  );

drop policy if exists "B2B vendors update own business connections"
  on public.vendor_business_connections;
create policy "B2B vendors update own business connections"
  on public.vendor_business_connections for update
  using (
    exists (
      select 1 from public.vendors v
      where v.user_id = auth.uid()
        and (v.id = sender_vendor_id or v.id = receiver_vendor_id)
    )
  );

drop policy if exists "Vendors manage own wholesale products"
  on public.wholesale_products;
create policy "Vendors manage own wholesale products"
  on public.wholesale_products for all
  using (
    exists (
      select 1 from public.vendors v
      where v.user_id = auth.uid() and v.id = vendor_id
    )
  )
  with check (
    exists (
      select 1 from public.vendors v
      where v.user_id = auth.uid() and v.id = vendor_id
    )
  );

drop policy if exists "Authenticated read active wholesale products"
  on public.wholesale_products;
create policy "Authenticated read active wholesale products"
  on public.wholesale_products for select
  using (status = 'ACTIVE' and auth.uid() is not null);
