-- Rooted Phase 1: users, shoppers, vendors
-- Run in Supabase SQL Editor after creating your project.

-- users (1:1 with auth.users)
create table public.users (
  id                       uuid primary key references auth.users (id) on delete cascade,
  role                     text check (role in ('shopper', 'vendor', 'admin')),
  name                     text,
  email                    text,
  phone                    text,
  profile_photo            text,
  city                     text,
  state                    text,
  zip_code                 text,
  location_coordinates     point,
  notification_preferences jsonb default '{}'::jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table public.users enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create policy "Users read own row"
  on public.users for select using (auth.uid() = id);

create policy "Users update own row"
  on public.users for update using (auth.uid() = id);

-- shoppers (created when role = shopper)
create table public.shoppers (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references public.users (id) on delete cascade,
  interests        text[] default '{}',
  saved_vendors    uuid[] default '{}',
  saved_events     uuid[] default '{}',
  default_location text
);

alter table public.shoppers enable row level security;

create policy "Shoppers read own row"
  on public.shoppers for select using (auth.uid() = user_id);

create policy "Shoppers update own row"
  on public.shoppers for update using (auth.uid() = user_id);

create policy "Shoppers insert own row"
  on public.shoppers for insert with check (auth.uid() = user_id);

-- vendors (created when role = vendor)
create table public.vendors (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references public.users (id) on delete cascade,
  business_name         text,
  business_description  text,
  logo_url              text,
  banner_url            text,
  theme_settings        jsonb default '{}'::jsonb,
  category              text,
  website_url           text,
  instagram_url         text,
  approval_status       text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  messaging_enabled     boolean not null default false,
  custom_orders_enabled boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.vendors enable row level security;

create policy "Vendors read own row"
  on public.vendors for select using (auth.uid() = user_id);

create policy "Vendors update own row"
  on public.vendors for update using (auth.uid() = user_id);

create policy "Vendors insert own row"
  on public.vendors for insert with check (auth.uid() = user_id);

create policy "Public read approved vendors"
  on public.vendors for select using (approval_status = 'approved');
