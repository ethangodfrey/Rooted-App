-- Phase 75 — B2B peer marketplace (Phase 1) + availability/loyalty schema prep
-- Apply after phase22 vendors/farmers (and preferably after phase54 wholesale).
--
-- Phase 1:
--   vendors.is_wholesale_provider
--   farmers.is_wholesale_supplier
--   wholesale_listings
--   b2b_procurement_requests (vendor → farmer bulk connection requests)
-- Phase 2 (schema prep):
--   vendor_availability
-- Phase 3 (schema prep):
--   shopper_loyalty

-- ---------------------------------------------------------------------------
-- 1. Wholesale flags
-- ---------------------------------------------------------------------------

alter table public.vendors
  add column if not exists is_wholesale_provider boolean not null default false;

comment on column public.vendors.is_wholesale_provider is
  'When true, vendor participates in the B2B peer marketplace as a wholesale provider.';

create index if not exists vendors_wholesale_provider_idx
  on public.vendors (is_wholesale_provider)
  where is_wholesale_provider = true;

alter table public.farmers
  add column if not exists is_wholesale_supplier boolean not null default false;

comment on column public.farmers.is_wholesale_supplier is
  'When true, farmer is listed as a wholesale supplier for vendor procurement.';

create index if not exists farmers_wholesale_supplier_idx
  on public.farmers (is_wholesale_supplier)
  where is_wholesale_supplier = true;

-- ---------------------------------------------------------------------------
-- 2. wholesale_listings — peer marketplace catalog (farmer/vendor producers)
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'wholesale_listing_availability'
  ) then
    create type public.wholesale_listing_availability as enum (
      'AVAILABLE',
      'LIMITED',
      'UNAVAILABLE'
    );
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'wholesale_producer_type'
  ) then
    create type public.wholesale_producer_type as enum ('FARMER', 'VENDOR');
  end if;
end $$;

create table if not exists public.wholesale_listings (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null,
  producer_type public.wholesale_producer_type not null default 'FARMER'::public.wholesale_producer_type,
  item_name text not null,
  bulk_unit_price numeric(12, 2) not null
    check (bulk_unit_price >= 0),
  min_order_quantity integer not null default 1
    check (min_order_quantity >= 1),
  availability_status public.wholesale_listing_availability not null
    default 'AVAILABLE'::public.wholesale_listing_availability,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wholesale_listings_item_name_not_blank
    check (char_length(btrim(item_name)) > 0)
);

comment on table public.wholesale_listings is
  'Peer B2B marketplace bulk listings (Phase 1). Distinct from wholesale_products SKU catalog.';

create index if not exists wholesale_listings_producer_idx
  on public.wholesale_listings (producer_type, producer_id, created_at desc);

create index if not exists wholesale_listings_availability_idx
  on public.wholesale_listings (availability_status)
  where availability_status <> 'UNAVAILABLE'::public.wholesale_listing_availability;

alter table public.wholesale_listings enable row level security;

drop policy if exists "Authenticated read wholesale listings" on public.wholesale_listings;
create policy "Authenticated read wholesale listings"
  on public.wholesale_listings for select
  to authenticated
  using (true);

drop policy if exists "Producers manage own wholesale listings" on public.wholesale_listings;
create policy "Producers manage own wholesale listings"
  on public.wholesale_listings for all
  to authenticated
  using (
    (
      producer_type = 'VENDOR'::public.wholesale_producer_type
      and producer_id in (select id from public.vendors where user_id = auth.uid())
    )
    or (
      producer_type = 'FARMER'::public.wholesale_producer_type
      and producer_id in (select id from public.farmers where user_id = auth.uid())
    )
    or public.is_admin()
  )
  with check (
    (
      producer_type = 'VENDOR'::public.wholesale_producer_type
      and producer_id in (select id from public.vendors where user_id = auth.uid())
    )
    or (
      producer_type = 'FARMER'::public.wholesale_producer_type
      and producer_id in (select id from public.farmers where user_id = auth.uid())
    )
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- 3. b2b_procurement_requests — vendor requests bulk connection with farmer
-- ---------------------------------------------------------------------------

create table if not exists public.b2b_procurement_requests (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  farmer_id uuid not null references public.farmers (id) on delete cascade,
  listing_id uuid references public.wholesale_listings (id) on delete set null,
  message text,
  requested_quantity integer
    check (requested_quantity is null or requested_quantity >= 1),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint b2b_procurement_vendor_farmer_pending_uidx
    unique (vendor_id, farmer_id, listing_id)
);

comment on table public.b2b_procurement_requests is
  'Vendor → farmer bulk procurement / connection requests for the peer marketplace.';

create index if not exists b2b_procurement_vendor_idx
  on public.b2b_procurement_requests (vendor_id, created_at desc);

create index if not exists b2b_procurement_farmer_idx
  on public.b2b_procurement_requests (farmer_id, created_at desc);

alter table public.b2b_procurement_requests enable row level security;

drop policy if exists "Parties read procurement requests" on public.b2b_procurement_requests;
create policy "Parties read procurement requests"
  on public.b2b_procurement_requests for select
  to authenticated
  using (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
    or farmer_id in (select id from public.farmers where user_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists "Vendors insert procurement requests" on public.b2b_procurement_requests;
create policy "Vendors insert procurement requests"
  on public.b2b_procurement_requests for insert
  to authenticated
  with check (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists "Parties update procurement requests" on public.b2b_procurement_requests;
create policy "Parties update procurement requests"
  on public.b2b_procurement_requests for update
  to authenticated
  using (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
    or farmer_id in (select id from public.farmers where user_id = auth.uid())
    or public.is_admin()
  )
  with check (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
    or farmer_id in (select id from public.farmers where user_id = auth.uid())
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- 4. Phase 2 prep — vendor_availability calendar blocks
-- ---------------------------------------------------------------------------

create table if not exists public.vendor_availability (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  blocked_date date not null,
  reason text not null
    check (reason in ('CATERING', 'MARKET')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendor_availability_vendor_date_reason_uidx
    unique (vendor_id, blocked_date, reason)
);

comment on table public.vendor_availability is
  'Phase 2 schema prep — calendar blocked dates for catering or market commitments.';

create index if not exists vendor_availability_vendor_date_idx
  on public.vendor_availability (vendor_id, blocked_date);

alter table public.vendor_availability enable row level security;

drop policy if exists "Vendors manage own availability" on public.vendor_availability;
create policy "Vendors manage own availability"
  on public.vendor_availability for all
  to authenticated
  using (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
    or public.is_admin()
  )
  with check (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- 5. Phase 3 prep — shopper_loyalty points
-- ---------------------------------------------------------------------------

create table if not exists public.shopper_loyalty (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid not null references public.shoppers (id) on delete cascade,
  points_total integer not null default 0
    check (points_total >= 0),
  last_action_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopper_loyalty_shopper_uidx unique (shopper_id)
);

comment on table public.shopper_loyalty is
  'Phase 3 schema prep — shopper loyalty points ledger summary.';

create index if not exists shopper_loyalty_points_idx
  on public.shopper_loyalty (points_total desc);

alter table public.shopper_loyalty enable row level security;

drop policy if exists "Shoppers read own loyalty" on public.shopper_loyalty;
create policy "Shoppers read own loyalty"
  on public.shopper_loyalty for select
  to authenticated
  using (
    shopper_id in (select id from public.shoppers where user_id = auth.uid())
    or public.is_admin()
  );
