-- Vendorly Phase 42 — regional marketplace isolation (regions, markets, RLS)
-- Run in Supabase SQL Editor after phase41_stripe_webhook_events.sql.
--
-- Introduces multi-tenant regional directory tables, vendor market registrations,
-- and optional orders.market_id to complete the fulfillment tracking loop.
-- Complements legacy public.events (farmers markets) via markets.event_id bridge.

-- ---------------------------------------------------------------------------
-- A. Region status
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.region_status as enum ('ACTIVE', 'INACTIVE');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.market_status as enum ('ACTIVE', 'INACTIVE', 'ARCHIVED');
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- B. Regions — geographic tenant boundaries
-- ---------------------------------------------------------------------------
create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  timezone text not null default 'America/Denver',
  -- Bounding box or GeoJSON polygon metadata for map overlays / geo filters.
  geographic_bounds jsonb not null default '{}'::jsonb,
  status public.region_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint regions_slug_key unique (slug)
);

create index if not exists regions_status_idx on public.regions (status);

comment on column public.regions.geographic_bounds is
  'JSON bounds payload, e.g. {"type":"bbox","north":40.1,"south":39.5,"east":-104.5,"west":-105.2}';

-- ---------------------------------------------------------------------------
-- C. Markets — regional farmers market directory entries
-- ---------------------------------------------------------------------------
create table if not exists public.markets (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions (id) on delete restrict,
  name text not null,
  slug text not null,
  location_address text,
  city text,
  state text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  pos_provider text check (pos_provider is null or pos_provider in ('SQUARE', 'TOAST', 'CLOVER')),
  -- Optional bridge to legacy events rows while directory migrates.
  event_id uuid references public.events (id) on delete set null,
  status public.market_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint markets_region_slug_key unique (region_id, slug)
);

create index if not exists markets_region_id_idx on public.markets (region_id);
create index if not exists markets_status_idx on public.markets (status);
create index if not exists markets_event_id_idx on public.markets (event_id);

-- ---------------------------------------------------------------------------
-- D. Vendor registrations — explicit market membership for RLS scoping
-- ---------------------------------------------------------------------------
create table if not exists public.vendor_market_registrations (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  market_id uuid not null references public.markets (id) on delete cascade,
  registration_status text not null default 'requested'
    check (registration_status in ('requested', 'approved', 'declined', 'suspended')),
  booth_label text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendor_market_registrations_vendor_market_key unique (vendor_id, market_id)
);

create index if not exists vendor_market_registrations_vendor_id_idx
  on public.vendor_market_registrations (vendor_id);
create index if not exists vendor_market_registrations_market_id_idx
  on public.vendor_market_registrations (market_id);
create index if not exists vendor_market_registrations_status_idx
  on public.vendor_market_registrations (registration_status);

-- ---------------------------------------------------------------------------
-- E. Orders — optional market_id FK to close the tracking loop
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists market_id uuid references public.markets (id) on delete set null;

create index if not exists orders_market_id_idx on public.orders (market_id);

-- ---------------------------------------------------------------------------
-- F. Helper — vendor-approved market ids for policy checks
-- ---------------------------------------------------------------------------
create or replace function public.vendor_approved_market_ids(p_user_id uuid default auth.uid())
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select vmr.market_id
  from public.vendor_market_registrations vmr
  join public.vendors v on v.id = vmr.vendor_id
  where v.user_id = coalesce(p_user_id, auth.uid())
    and vmr.registration_status = 'approved';
$$;

comment on function public.vendor_approved_market_ids(uuid) is
  'Market ids a vendor is approved to operate under (RLS helper).';

-- ---------------------------------------------------------------------------
-- G. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.regions enable row level security;
alter table public.markets enable row level security;
alter table public.vendor_market_registrations enable row level security;

-- Public directory: active regions
drop policy if exists "Public read active regions" on public.regions;
create policy "Public read active regions"
  on public.regions for select
  using (status = 'ACTIVE');

drop policy if exists "Admins manage regions" on public.regions;
create policy "Admins manage regions"
  on public.regions for all
  using (public.is_admin())
  with check (public.is_admin());

-- Public directory: active markets in active regions
drop policy if exists "Public read active markets" on public.markets;
create policy "Public read active markets"
  on public.markets for select
  using (
    status = 'ACTIVE'
    and region_id in (select id from public.regions where status = 'ACTIVE')
  );

-- Vendors read markets they are registered under (any status on registration row)
drop policy if exists "Vendors read registered markets" on public.markets;
create policy "Vendors read registered markets"
  on public.markets for select
  using (
    id in (
      select vmr.market_id
      from public.vendor_market_registrations vmr
      join public.vendors v on v.id = vmr.vendor_id
      where v.user_id = auth.uid()
    )
  );

drop policy if exists "Admins manage markets" on public.markets;
create policy "Admins manage markets"
  on public.markets for all
  using (public.is_admin())
  with check (public.is_admin());

-- Vendor registrations: vendors manage their own rows
drop policy if exists "Vendors manage own market registrations" on public.vendor_market_registrations;
create policy "Vendors manage own market registrations"
  on public.vendor_market_registrations for all
  using (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
  )
  with check (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
  );

-- Public read approved registrations for active public markets (directory)
drop policy if exists "Public read approved market registrations" on public.vendor_market_registrations;
create policy "Public read approved market registrations"
  on public.vendor_market_registrations for select
  using (
    registration_status = 'approved'
    and market_id in (
      select id from public.markets
      where status = 'ACTIVE'
        and region_id in (select id from public.regions where status = 'ACTIVE')
    )
  );

drop policy if exists "Admins manage market registrations" on public.vendor_market_registrations;
create policy "Admins manage market registrations"
  on public.vendor_market_registrations for all
  using (public.is_admin())
  with check (public.is_admin());

-- Orders: tighten market-scoped reads for vendors (additive; legacy vendor_id policies remain)
drop policy if exists "Vendors read orders in registered markets" on public.orders;
create policy "Vendors read orders in registered markets"
  on public.orders for select
  using (
    market_id is not null
    and market_id in (select public.vendor_approved_market_ids())
    and vendor_id in (select id from public.vendors where user_id = auth.uid())
  );

drop policy if exists "Vendors update orders in registered markets" on public.orders;
create policy "Vendors update orders in registered markets"
  on public.orders for update
  using (
    market_id is not null
    and market_id in (select public.vendor_approved_market_ids())
    and vendor_id in (select id from public.vendors where user_id = auth.uid())
  )
  with check (
    market_id is not null
    and market_id in (select public.vendor_approved_market_ids())
    and vendor_id in (select id from public.vendors where user_id = auth.uid())
  );
