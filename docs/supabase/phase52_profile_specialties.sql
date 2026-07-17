-- Rooted Phase 52 — Vendor & farmer specialty arrays on profiles
-- Apply after phase51_network_and_stickers.sql.
--
-- Powers B2B ingredient sourcing + discovery filters.
-- Canonical columns live on public.profiles; mirrored onto public.users for auth clients.

alter table public.profiles
  add column if not exists vendor_specialties text[] not null default '{}';

alter table public.profiles
  add column if not exists farmer_specialties text[] not null default '{}';

comment on column public.profiles.vendor_specialties is
  'Phase 52: vendor specialty tags (e.g. HOME_BAKER, PREPARED_MEALS). Uppercase snake tokens.';

comment on column public.profiles.farmer_specialties is
  'Phase 52: farmer specialty tags (e.g. PRODUCE_VEG, POULTRY_EGGS). Uppercase snake tokens.';

alter table public.users
  add column if not exists vendor_specialties text[] not null default '{}';

alter table public.users
  add column if not exists farmer_specialties text[] not null default '{}';

-- Backfill users from profiles when present
update public.users u
set
  vendor_specialties = coalesce(p.vendor_specialties, '{}'),
  farmer_specialties = coalesce(p.farmer_specialties, '{}')
from public.profiles p
where p.id = u.id;

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
    vendor_specialties = coalesce(new.vendor_specialties, '{}'),
    farmer_specialties = coalesce(new.farmer_specialties, '{}'),
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
  after insert or update of role, shopper_interests, shopper_zip_code, vendor_specialties, farmer_specialties
  on public.profiles
  for each row execute function public.sync_profile_to_users();

create index if not exists profiles_vendor_specialties_gin
  on public.profiles using gin (vendor_specialties);

create index if not exists profiles_farmer_specialties_gin
  on public.profiles using gin (farmer_specialties);
