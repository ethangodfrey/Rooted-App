-- Vendorly Phase 50 — Shopper / Vendor role split + social graph
-- Apply after phase49.
--
-- 1) Canonical marketplace roles: shopper | vendor (chef/admin retained for ops)
-- 2) Shoppers follow vendors (`follows`)
-- 3) Vendors connect with vendors (`vendor_connections`)

-- ---------------------------------------------------------------------------
-- 1. Role enum + users.role enforcement
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('shopper', 'vendor', 'chef', 'admin');
  end if;
end $$;

-- Normalize legacy customer → shopper before tightening the check
update public.users
set role = 'shopper'
where role = 'customer';

alter table public.users drop constraint if exists users_role_check;

-- Keep text column for compatibility with existing clients; constrain values.
-- (Postgres enums are awkward to widen later; text + check matches prior phases.)
alter table public.users
  add constraint users_role_check
  check (role is null or role in ('shopper', 'vendor', 'chef', 'admin'));

comment on column public.users.role is
  'Phase 50: primary marketplace roles are shopper|vendor; chef/admin retained. Legacy customer migrated to shopper.';

-- Shopper localization helper for USDA / nearby market feeds
alter table public.shoppers
  add column if not exists zip_code text;

comment on column public.shoppers.zip_code is
  'Phase 50: shopper ZIP for local market / explore personalization.';

create index if not exists shoppers_zip_code_idx
  on public.shoppers (zip_code)
  where zip_code is not null;

-- ---------------------------------------------------------------------------
-- 2. follows — shopper → vendor
-- ---------------------------------------------------------------------------

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid not null references public.shoppers (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (shopper_id, vendor_id)
);

create index if not exists follows_shopper_idx on public.follows (shopper_id);
create index if not exists follows_vendor_idx on public.follows (vendor_id);

comment on table public.follows is
  'Phase 50: shopper follows vendor (social). Distinct from saved_items favorites.';

alter table public.follows enable row level security;

drop policy if exists "Shoppers manage own follows" on public.follows;
create policy "Shoppers manage own follows"
  on public.follows for all
  to authenticated
  using (
    shopper_id in (select id from public.shoppers where user_id = auth.uid())
  )
  with check (
    shopper_id in (select id from public.shoppers where user_id = auth.uid())
  );

drop policy if exists "Vendors read their followers" on public.follows;
create policy "Vendors read their followers"
  on public.follows for select
  to authenticated
  using (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3. vendor_connections — vendor ↔ vendor
-- ---------------------------------------------------------------------------

create table if not exists public.vendor_connections (
  id uuid primary key default gen_random_uuid(),
  sender_vendor_id uuid not null references public.vendors (id) on delete cascade,
  receiver_vendor_id uuid not null references public.vendors (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'connected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendor_connections_no_self check (sender_vendor_id <> receiver_vendor_id)
);

comment on table public.vendor_connections is
  'Phase 50: V2V connection requests (pending → connected).';

create unique index if not exists vendor_connections_pair_uidx
  on public.vendor_connections (
    least(sender_vendor_id, receiver_vendor_id),
    greatest(sender_vendor_id, receiver_vendor_id)
  );

create index if not exists vendor_connections_sender_idx
  on public.vendor_connections (sender_vendor_id, status);

create index if not exists vendor_connections_receiver_idx
  on public.vendor_connections (receiver_vendor_id, status);

create or replace function public.set_vendor_connections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vendor_connections_set_updated_at on public.vendor_connections;
create trigger vendor_connections_set_updated_at
  before update on public.vendor_connections
  for each row execute function public.set_vendor_connections_updated_at();

create or replace function public.current_vendor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.vendors where user_id = auth.uid() limit 1;
$$;

revoke all on function public.current_vendor_id() from public;
grant execute on function public.current_vendor_id() to authenticated;

alter table public.vendor_connections enable row level security;

drop policy if exists "Vendors read own connections" on public.vendor_connections;
create policy "Vendors read own connections"
  on public.vendor_connections for select
  to authenticated
  using (
    sender_vendor_id = public.current_vendor_id()
    or receiver_vendor_id = public.current_vendor_id()
  );

drop policy if exists "Vendors send connection requests" on public.vendor_connections;
create policy "Vendors send connection requests"
  on public.vendor_connections for insert
  to authenticated
  with check (sender_vendor_id = public.current_vendor_id());

drop policy if exists "Vendors update own connections" on public.vendor_connections;
create policy "Vendors update own connections"
  on public.vendor_connections for update
  to authenticated
  using (
    sender_vendor_id = public.current_vendor_id()
    or receiver_vendor_id = public.current_vendor_id()
  )
  with check (
    sender_vendor_id = public.current_vendor_id()
    or receiver_vendor_id = public.current_vendor_id()
  );

drop policy if exists "Vendors delete own pending connections" on public.vendor_connections;
create policy "Vendors delete own pending connections"
  on public.vendor_connections for delete
  to authenticated
  using (
    sender_vendor_id = public.current_vendor_id()
    and status = 'pending'
  );

-- Backfill follows from saved_items vendor favorites (best-effort)
insert into public.follows (shopper_id, vendor_id)
select s.id, si.vendor_id
from public.saved_items si
join public.shoppers s on s.user_id = si.customer_id
where si.item_type = 'vendor'
  and si.vendor_id is not null
on conflict (shopper_id, vendor_id) do nothing;
