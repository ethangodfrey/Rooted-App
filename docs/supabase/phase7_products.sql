-- Rooted Phase 7: products + dual-channel inventory
-- Run in Supabase SQL Editor after Phase 1, Phase 4, and Phase 6.

create table public.products (
  id                   uuid primary key default gen_random_uuid(),
  vendor_id            uuid not null references public.vendors (id) on delete cascade,
  name                 text not null,
  description          text,
  price                integer not null, -- cents
  media_urls           text[] default '{}',
  category             text,
  sku                  text,
  status               text not null default 'active'
    check (status in ('active', 'archived')),
  inquiry_enabled      boolean not null default false,
  reserve_enabled      boolean not null default true,
  prepay_enabled       boolean not null default false,
  custom_order_enabled boolean not null default false,
  prep_time            integer,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "Vendors manage own products"
  on public.products for all
  using (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
  )
  with check (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
  );

create policy "Public read active products of approved vendors"
  on public.products for select
  using (
    status = 'active'
    and vendor_id in (select id from public.vendors where approval_status = 'approved')
  );

create index products_vendor_id_idx on public.products (vendor_id);

-- Dual-channel inventory: per-event presale (digital) vs in-person (booth) caps.
create table public.product_event_availability (
  id                          uuid primary key default gen_random_uuid(),
  product_id                  uuid not null references public.products (id) on delete cascade,
  event_id                    uuid not null references public.events (id) on delete cascade,
  available_quantity_presale  integer not null default 0 check (available_quantity_presale >= 0),
  available_quantity_inperson integer not null default 0 check (available_quantity_inperson >= 0),
  pre_order_deadline          timestamptz,
  pickup_notes                text,
  unique (product_id, event_id)
);

alter table public.product_event_availability enable row level security;

create policy "Vendors manage own availability"
  on public.product_event_availability for all
  using (
    product_id in (
      select p.id from public.products p
      join public.vendors v on v.id = p.vendor_id
      where v.user_id = auth.uid()
    )
  )
  with check (
    product_id in (
      select p.id from public.products p
      join public.vendors v on v.id = p.vendor_id
      where v.user_id = auth.uid()
    )
  );

create policy "Public read availability for public events"
  on public.product_event_availability for select
  using (
    event_id in (select id from public.events where visibility_status = 'public')
    and product_id in (
      select id from public.products
      where status = 'active'
        and vendor_id in (select id from public.vendors where approval_status = 'approved')
    )
  );

create index pea_product_id_idx on public.product_event_availability (product_id);
create index pea_event_id_idx on public.product_event_availability (event_id);
