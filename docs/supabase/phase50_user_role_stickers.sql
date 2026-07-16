-- Vendorly Phase 50 — User role stickers (shopper | vendor)
-- Apply after phase49.
--
-- Canonical marketplace sticker roles live on public.users (app "profiles" table).
-- New signups keep role NULL until onboarding selection; display default is shopper.

-- Ensure role check includes sticker roles (retain chef/admin for ops)
alter table public.users drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check
  check (role is null or role in ('shopper', 'vendor', 'chef', 'admin', 'customer'));

-- Normalize legacy customer → shopper for sticker display
update public.users
set role = 'shopper'
where role = 'customer';

-- Column default for explicit inserts that omit role (onboarding still sets explicitly)
alter table public.users
  alter column role set default 'shopper';

comment on column public.users.role is
  'Phase 50 sticker role: shopper | vendor (chef/admin ops). NULL until onboarding selection; default shopper when omitted.';

-- New auth users: leave role NULL so onboarding role screen is required
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, role)
  values (new.id, new.email, null);
  return new;
end;
$$;
