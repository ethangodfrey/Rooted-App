-- Rooted Phase 51 — Network graph + profile sticker roles
-- Apply after phase50_user_role_stickers.sql.
--
-- Vision alignment:
--   profiles.role enum: shopper | vendor (permanent sticker roles)
--   follows: shopper_id → profiles, vendor_id → vendors
--   vendor_connections: sender/receiver → vendors, status pending|connected
--
-- Legacy `public.users` remains for ops fields (chef/admin, contact). Marketplace
-- sticker role + shopper prefs live on `public.profiles` and sync into users.

-- ---------------------------------------------------------------------------
-- 1. profiles — strict shopper | vendor sticker roles
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'profile_role') then
    create type public.profile_role as enum ('shopper', 'vendor');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.profile_role,
  shopper_interests text[] not null default '{}',
  shopper_zip_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_marketplace_only
    check (role is null or role in ('shopper', 'vendor'))
);

comment on table public.profiles is
  'Phase 51: canonical marketplace profile. role is sticker enum shopper|vendor only.';

comment on column public.profiles.role is
  'Permanent sticker role. NULL until onboarding; never chef/admin.';

comment on column public.profiles.shopper_interests is
  'Curated shopper category preferences.';

comment on column public.profiles.shopper_zip_code is
  'Shopper ZIP for local explore / USDA lookups.';

create index if not exists profiles_role_idx
  on public.profiles (role)
  where role is not null;

create index if not exists profiles_shopper_zip_code_idx
  on public.profiles (shopper_zip_code)
  where shopper_zip_code is not null;

alter table public.profiles enable row level security;

drop policy if exists "Profiles read own row" on public.profiles;
create policy "Profiles read own row"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "Profiles update own row" on public.profiles;
create policy "Profiles update own row"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Profiles insert own row" on public.profiles;
create policy "Profiles insert own row"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "Public read marketplace profiles" on public.profiles;
create policy "Public read marketplace profiles"
  on public.profiles for select
  to anon, authenticated
  using (role in ('shopper', 'vendor'));

-- Ensure legacy users.role can hold sticker roles (+ ops)
alter table public.users drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check
  check (role is null or role in ('shopper', 'vendor', 'chef', 'admin', 'customer'));

alter table public.users
  add column if not exists shopper_interests text[] not null default '{}';

alter table public.users
  add column if not exists shopper_zip_code text;

alter table public.shoppers
  add column if not exists zip_code text;

-- Backfill profiles from users (customer → shopper)
insert into public.profiles (id, role, shopper_interests, shopper_zip_code, created_at, updated_at)
select
  u.id,
  case
    when u.role in ('shopper', 'customer') then 'shopper'::public.profile_role
    when u.role = 'vendor' then 'vendor'::public.profile_role
    else null
  end,
  coalesce(u.shopper_interests, s.interests, '{}'),
  coalesce(u.shopper_zip_code, s.zip_code, u.zip_code),
  coalesce(u.created_at, now()),
  coalesce(u.updated_at, now())
from public.users u
left join public.shoppers s on s.user_id = u.id
on conflict (id) do update
set
  role = coalesce(public.profiles.role, excluded.role),
  shopper_interests = case
    when cardinality(public.profiles.shopper_interests) > 0 then public.profiles.shopper_interests
    else excluded.shopper_interests
  end,
  shopper_zip_code = coalesce(public.profiles.shopper_zip_code, excluded.shopper_zip_code);

-- Keep users.role aligned for sticker roles (do not overwrite chef/admin)
update public.users u
set
  role = p.role::text,
  shopper_interests = p.shopper_interests,
  shopper_zip_code = p.shopper_zip_code,
  updated_at = now()
from public.profiles p
where p.id = u.id
  and p.role is not null
  and (u.role is null or u.role in ('shopper', 'vendor', 'customer'));

create or replace function public.sync_profile_to_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set
    role = case
      when new.role is not null then new.role::text
      else role
    end,
    shopper_interests = new.shopper_interests,
    shopper_zip_code = new.shopper_zip_code,
    updated_at = now()
  where id = new.id
    and (role is null or role in ('shopper', 'vendor', 'customer') or new.role is null);

  if new.role = 'shopper' then
    insert into public.shoppers (user_id, interests, zip_code)
    values (new.id, new.shopper_interests, new.shopper_zip_code)
    on conflict (user_id) do update
    set
      interests = excluded.interests,
      zip_code = coalesce(excluded.zip_code, public.shoppers.zip_code);
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_sync_to_users on public.profiles;
create trigger profiles_sync_to_users
  after insert or update of role, shopper_interests, shopper_zip_code
  on public.profiles
  for each row execute function public.sync_profile_to_users();

-- New auth users: profile + users row with NULL role until onboarding
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, role)
  values (new.id, new.email, null)
  on conflict (id) do nothing;

  insert into public.profiles (id, role)
  values (new.id, null)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. follows — shopper profile → vendor
-- ---------------------------------------------------------------------------

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid not null references public.profiles (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (shopper_id, vendor_id)
);

create index if not exists follows_shopper_idx on public.follows (shopper_id);
create index if not exists follows_vendor_idx on public.follows (vendor_id);

comment on table public.follows is
  'Phase 51: shopper profile follows vendor. Distinct from saved_items favorites.';

alter table public.follows enable row level security;

drop policy if exists "Shoppers manage own follows" on public.follows;
create policy "Shoppers manage own follows"
  on public.follows for all
  to authenticated
  using (shopper_id = auth.uid())
  with check (shopper_id = auth.uid());

drop policy if exists "Vendors read their followers" on public.follows;
create policy "Vendors read their followers"
  on public.follows for select
  to authenticated
  using (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
  );

-- Backfill follows from saved_items (shopper_id = profile/user id)
insert into public.follows (shopper_id, vendor_id)
select si.customer_id, si.vendor_id
from public.saved_items si
where si.item_type = 'vendor'
  and si.vendor_id is not null
  and exists (select 1 from public.profiles p where p.id = si.customer_id)
on conflict (shopper_id, vendor_id) do nothing;

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
  'Phase 51: V2V connection requests (pending → connected).';

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
