-- Phase 72 — Optional vendor catering services module
-- Apply after phase22 (vendors) and preferably after phase71.
--
-- Adds:
--   vendors.is_catering_provider
--   vendor_catering_services (capacity + description + price estimate)
--   catering_inquiries (shopper "Request Catering" contact flow)

-- ---------------------------------------------------------------------------
-- 1. Vendor flag
-- ---------------------------------------------------------------------------

alter table public.vendors
  add column if not exists is_catering_provider boolean not null default false;

comment on column public.vendors.is_catering_provider is
  'When true, vendor offers catering and may publish vendor_catering_services.';

create index if not exists vendors_catering_provider_idx
  on public.vendors (is_catering_provider)
  where is_catering_provider = true;

-- ---------------------------------------------------------------------------
-- 2. vendor_catering_services
-- ---------------------------------------------------------------------------

create table if not exists public.vendor_catering_services (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  service_description text not null default '',
  min_guests integer not null default 1
    check (min_guests >= 1),
  max_guests integer not null default 50
    check (max_guests >= 1),
  price_range_estimate text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendor_catering_services_guest_range check (max_guests >= min_guests),
  constraint vendor_catering_services_vendor_uidx unique (vendor_id)
);

comment on table public.vendor_catering_services is
  'Optional catering capacity and pricing summary for a vendor (one row per vendor).';

create index if not exists vendor_catering_services_vendor_idx
  on public.vendor_catering_services (vendor_id);

alter table public.vendor_catering_services enable row level security;

drop policy if exists "Public read catering services" on public.vendor_catering_services;
create policy "Public read catering services"
  on public.vendor_catering_services for select
  to authenticated, anon
  using (
    exists (
      select 1 from public.vendors v
      where v.id = vendor_catering_services.vendor_id
        and v.is_catering_provider = true
        and v.approval_status = 'approved'
    )
    or exists (
      select 1 from public.vendors v
      where v.id = vendor_catering_services.vendor_id
        and v.user_id = auth.uid()
    )
    or public.is_admin()
  );

drop policy if exists "Vendors manage own catering services" on public.vendor_catering_services;
create policy "Vendors manage own catering services"
  on public.vendor_catering_services for all
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
-- 3. catering_inquiries — Request Catering contact flow
-- ---------------------------------------------------------------------------

create table if not exists public.catering_inquiries (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  shopper_id uuid not null references public.profiles (id) on delete cascade,
  message text not null,
  guest_count integer,
  event_date date,
  status text not null default 'OPEN'
    check (status in ('OPEN', 'REPLIED', 'CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catering_inquiries_message_not_blank check (char_length(btrim(message)) > 0)
);

comment on table public.catering_inquiries is
  'Shopper catering requests opened from vendor public profiles.';

create index if not exists catering_inquiries_vendor_idx
  on public.catering_inquiries (vendor_id, created_at desc);

create index if not exists catering_inquiries_shopper_idx
  on public.catering_inquiries (shopper_id, created_at desc);

alter table public.catering_inquiries enable row level security;

drop policy if exists "Shoppers insert catering inquiries" on public.catering_inquiries;
create policy "Shoppers insert catering inquiries"
  on public.catering_inquiries for insert
  to authenticated
  with check (shopper_id = auth.uid() or public.is_admin());

drop policy if exists "Parties read catering inquiries" on public.catering_inquiries;
create policy "Parties read catering inquiries"
  on public.catering_inquiries for select
  to authenticated
  using (
    shopper_id = auth.uid()
    or vendor_id in (select id from public.vendors where user_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists "Vendors update catering inquiries" on public.catering_inquiries;
create policy "Vendors update catering inquiries"
  on public.catering_inquiries for update
  to authenticated
  using (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
    or public.is_admin()
  )
  with check (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
    or public.is_admin()
  );
