-- Rooted Phase 51 — Three-tier stickers + profile network graph
-- Apply after phase50_user_role_stickers.sql.
--
-- Vision:
--   profiles.role enum: shopper | vendor | farmer (permanent text stickers)
--   follows: shopper_id → followed_profile_id (profiles)
--   network_connections: sender_id ↔ receiver_id (profiles; V2V + F2V B2B)
--
-- Legacy `public.users` remains for ops (chef/admin) and is synced from profiles
-- for marketplace sticker roles.

-- ---------------------------------------------------------------------------
-- 1. profiles — shopper | vendor | farmer
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'profile_role') then
    create type public.profile_role as enum ('shopper', 'vendor', 'farmer');
  else
    -- Widen enum if an earlier draft only had shopper|vendor
    begin
      alter type public.profile_role add value if not exists 'farmer';
    exception
      when duplicate_object then null;
      when syntax_error then
        -- PG < 15 may lack IF NOT EXISTS on enum values
        begin
          alter type public.profile_role add value 'farmer';
        exception
          when duplicate_object then null;
        end;
    end;
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
    check (role is null or role in ('shopper', 'vendor', 'farmer'))
);

comment on table public.profiles is
  'Phase 51: marketplace profile. role sticker enum shopper|vendor|farmer only.';

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
  using (role in ('shopper', 'vendor', 'farmer'));

-- Legacy users.role: sticker roles + ops
alter table public.users drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check
  check (role is null or role in ('shopper', 'vendor', 'farmer', 'chef', 'admin', 'customer'));

alter table public.users
  add column if not exists shopper_interests text[] not null default '{}';

alter table public.users
  add column if not exists shopper_zip_code text;

alter table public.shoppers
  add column if not exists zip_code text;

-- Farmers extension (raw/bulk ag goods; parallel to vendors)
create table if not exists public.farmers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  farm_name text,
  farm_description text,
  logo_url text,
  banner_url text,
  sell_city text,
  sell_state text,
  postal_code text,
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.farmers is
  'Phase 51: farmer extension for harvest/wholesale listings (FARMER sticker).';

alter table public.farmers enable row level security;

drop policy if exists "Farmers read own row" on public.farmers;
create policy "Farmers read own row"
  on public.farmers for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Farmers update own row" on public.farmers;
create policy "Farmers update own row"
  on public.farmers for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Farmers insert own row" on public.farmers;
create policy "Farmers insert own row"
  on public.farmers for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Public read approved farmers" on public.farmers;
create policy "Public read approved farmers"
  on public.farmers for select
  to anon, authenticated
  using (approval_status = 'approved' or user_id = auth.uid());

-- Backfill profiles from users
insert into public.profiles (id, role, shopper_interests, shopper_zip_code, created_at, updated_at)
select
  u.id,
  case
    when u.role in ('shopper', 'customer') then 'shopper'::public.profile_role
    when u.role = 'vendor' then 'vendor'::public.profile_role
    when u.role = 'farmer' then 'farmer'::public.profile_role
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

update public.users u
set
  role = p.role::text,
  shopper_interests = p.shopper_interests,
  shopper_zip_code = p.shopper_zip_code,
  updated_at = now()
from public.profiles p
where p.id = u.id
  and p.role is not null
  and (u.role is null or u.role in ('shopper', 'vendor', 'farmer', 'customer'));

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
    and (role is null or role in ('shopper', 'vendor', 'farmer', 'customer') or new.role is null);

  if new.role = 'shopper' then
    insert into public.shoppers (user_id, interests, zip_code)
    values (new.id, new.shopper_interests, new.shopper_zip_code)
    on conflict (user_id) do update
    set
      interests = excluded.interests,
      zip_code = coalesce(excluded.zip_code, public.shoppers.zip_code);
  elsif new.role = 'vendor' then
    insert into public.vendors (user_id, approval_status)
    values (new.id, 'pending')
    on conflict (user_id) do nothing;
  elsif new.role = 'farmer' then
    insert into public.farmers (user_id, approval_status)
    values (new.id, 'pending')
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_sync_to_users on public.profiles;
create trigger profiles_sync_to_users
  after insert or update of role, shopper_interests, shopper_zip_code
  on public.profiles
  for each row execute function public.sync_profile_to_users();

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
-- 2. follows — shopper → vendor/farmer profile
-- ---------------------------------------------------------------------------

-- Drop earlier draft that referenced vendors.id if present
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'follows' and column_name = 'vendor_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'follows' and column_name = 'followed_profile_id'
  ) then
    drop table public.follows cascade;
  end if;
end $$;

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid not null references public.profiles (id) on delete cascade,
  followed_profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (shopper_id, followed_profile_id),
  constraint follows_no_self check (shopper_id <> followed_profile_id)
);

create index if not exists follows_shopper_idx on public.follows (shopper_id);
create index if not exists follows_followed_idx on public.follows (followed_profile_id);

comment on table public.follows is
  'Phase 51: shopper follows vendor or farmer profile.';

alter table public.follows enable row level security;

drop policy if exists "Shoppers manage own follows" on public.follows;
create policy "Shoppers manage own follows"
  on public.follows for all
  to authenticated
  using (shopper_id = auth.uid())
  with check (shopper_id = auth.uid());

drop policy if exists "Followed profiles read followers" on public.follows;
create policy "Followed profiles read followers"
  on public.follows for select
  to authenticated
  using (followed_profile_id = auth.uid());

-- Backfill from saved_items vendor favorites (customer_id = profile id)
insert into public.follows (shopper_id, followed_profile_id)
select si.customer_id, v.user_id
from public.saved_items si
join public.vendors v on v.id = si.vendor_id
where si.item_type = 'vendor'
  and si.vendor_id is not null
  and exists (select 1 from public.profiles p where p.id = si.customer_id)
  and exists (select 1 from public.profiles p2 where p2.id = v.user_id)
on conflict (shopper_id, followed_profile_id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. network_connections — B2B vendor/farmer ↔ vendor/farmer
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'vendor_connections'
  ) and not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'network_connections'
  ) then
    -- Migrate draft vendor_connections → network_connections (profile ids)
    create table public.network_connections (
      id uuid primary key default gen_random_uuid(),
      sender_id uuid not null references public.profiles (id) on delete cascade,
      receiver_id uuid not null references public.profiles (id) on delete cascade,
      status text not null default 'pending'
        check (status in ('pending', 'connected')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint network_connections_no_self check (sender_id <> receiver_id)
    );

    insert into public.network_connections (id, sender_id, receiver_id, status, created_at, updated_at)
    select
      vc.id,
      vs.user_id,
      vr.user_id,
      vc.status,
      vc.created_at,
      vc.updated_at
    from public.vendor_connections vc
    join public.vendors vs on vs.id = vc.sender_vendor_id
    join public.vendors vr on vr.id = vc.receiver_vendor_id
    on conflict do nothing;

    drop table public.vendor_connections cascade;
  end if;
end $$;

create table if not exists public.network_connections (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'connected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint network_connections_no_self check (sender_id <> receiver_id)
);

comment on table public.network_connections is
  'Phase 51: B2B V2V/F2V connections between vendor and farmer profiles (pending|connected).';

create unique index if not exists network_connections_pair_uidx
  on public.network_connections (
    least(sender_id, receiver_id),
    greatest(sender_id, receiver_id)
  );

create index if not exists network_connections_sender_idx
  on public.network_connections (sender_id, status);

create index if not exists network_connections_receiver_idx
  on public.network_connections (receiver_id, status);

create or replace function public.set_network_connections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists network_connections_set_updated_at on public.network_connections;
create trigger network_connections_set_updated_at
  before update on public.network_connections
  for each row execute function public.set_network_connections_updated_at();

-- Only vendor/farmer sticker roles may participate in B2B network
create or replace function public.is_network_eligible_profile(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = profile_id and role in ('vendor', 'farmer')
  );
$$;

revoke all on function public.is_network_eligible_profile(uuid) from public;
grant execute on function public.is_network_eligible_profile(uuid) to authenticated;

alter table public.network_connections enable row level security;

drop policy if exists "Network peers read own connections" on public.network_connections;
create policy "Network peers read own connections"
  on public.network_connections for select
  to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "Network peers send connection requests" on public.network_connections;
create policy "Network peers send connection requests"
  on public.network_connections for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_network_eligible_profile(sender_id)
    and public.is_network_eligible_profile(receiver_id)
  );

drop policy if exists "Network peers update own connections" on public.network_connections;
create policy "Network peers update own connections"
  on public.network_connections for update
  to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid())
  with check (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "Network peers delete own pending" on public.network_connections;
create policy "Network peers delete own pending"
  on public.network_connections for delete
  to authenticated
  using (sender_id = auth.uid() and status = 'pending');
