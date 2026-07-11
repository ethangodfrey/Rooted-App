-- Vendorly Marketplace — Phase 22
-- Run in Supabase SQL Editor after phase21_market_guide.sql
--
-- Safe to RE-RUN after partial failures (policies use DROP IF EXISTS).
-- Expands Rooted into Vendorly: customer/chef roles, chef booking,
-- vendor direct sales, explore feed, unified saved items.
-- Preserves farmers market flows; shoppers table kept (customer role maps to shoppers row).

-- ---------------------------------------------------------------------------
-- A. Users role expansion (shopper → customer, add chef)
-- ---------------------------------------------------------------------------
alter table public.users drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check
  check (role in ('customer', 'shopper', 'vendor', 'chef', 'admin'));

-- Migrate legacy shopper role to customer
update public.users set role = 'customer' where role = 'shopper';

-- ---------------------------------------------------------------------------
-- B. Vendors — type classification + direct-sale fields
-- ---------------------------------------------------------------------------
alter table public.vendors
  add column if not exists vendor_type text
    check (vendor_type in ('farmers_market', 'home_kitchen', 'food_business', 'caterer', 'meal_prep')),
  add column if not exists serves_delivery boolean not null default false,
  add column if not exists delivery_radius_miles integer,
  add column if not exists accepts_custom_orders boolean not null default true,
  add column if not exists cuisine_tags text[] default '{}',
  add column if not exists dietary_tags text[] default '{}',
  add column if not exists minimum_order_amount integer,
  add column if not exists lead_time_hours integer default 24;

-- ---------------------------------------------------------------------------
-- C. Chefs
-- ---------------------------------------------------------------------------
create table if not exists public.chefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  display_name text not null,
  bio text,
  profile_photo_url text,
  banner_url text,
  cuisine_specialties text[] default '{}',
  service_types text[] default '{}',
  hourly_rate integer,
  base_event_rate integer,
  serves_radius_miles integer,
  home_base_city text,
  home_base_state text,
  home_base_coordinates point,
  availability_settings jsonb default '{}'::jsonb,
  instagram_url text,
  website_url text,
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  featured boolean not null default false,
  rating_average numeric(3, 2),
  review_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chefs_user_id_idx on public.chefs (user_id);
create index if not exists chefs_approval_status_idx on public.chefs (approval_status);

alter table public.chefs enable row level security;

drop policy if exists "Chefs read own row" on public.chefs;
create policy "Chefs read own row"
  on public.chefs for select using (auth.uid() = user_id);

drop policy if exists "Chefs update own row" on public.chefs;
create policy "Chefs update own row"
  on public.chefs for update using (auth.uid() = user_id);

drop policy if exists "Chefs insert own row" on public.chefs;
create policy "Chefs insert own row"
  on public.chefs for insert with check (auth.uid() = user_id);

drop policy if exists "Public read approved chefs" on public.chefs;
create policy "Public read approved chefs"
  on public.chefs for select using (approval_status = 'approved');

drop policy if exists "Admins read all chefs" on public.chefs;
create policy "Admins read all chefs"
  on public.chefs for select using (public.is_admin());

drop policy if exists "Admins update chefs" on public.chefs;
create policy "Admins update chefs"
  on public.chefs for update using (public.is_admin());

-- ---------------------------------------------------------------------------
-- D. Chef services
-- ---------------------------------------------------------------------------
create table if not exists public.chef_services (
  id uuid primary key default gen_random_uuid(),
  chef_id uuid not null references public.chefs (id) on delete cascade,
  service_name text not null,
  service_type text not null
    check (service_type in (
      'private_dining', 'meal_prep', 'event_catering',
      'cooking_class', 'personal_chef', 'custom'
    )),
  description text,
  base_price integer not null,
  price_type text not null
    check (price_type in ('per_person', 'flat_rate', 'hourly', 'custom_quote')),
  min_guests integer,
  max_guests integer,
  duration_hours numeric(4, 2),
  includes_groceries boolean not null default false,
  media_urls text[] default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists chef_services_chef_id_idx on public.chef_services (chef_id);

alter table public.chef_services enable row level security;

drop policy if exists "Chefs manage own services" on public.chef_services;
create policy "Chefs manage own services"
  on public.chef_services for all
  using (chef_id in (select id from public.chefs where user_id = auth.uid()))
  with check (chef_id in (select id from public.chefs where user_id = auth.uid()));

drop policy if exists "Public read active chef services" on public.chef_services;
create policy "Public read active chef services"
  on public.chef_services for select
  using (
    active = true
    and chef_id in (select id from public.chefs where approval_status = 'approved')
  );

drop policy if exists "Admins read all chef services" on public.chef_services;
create policy "Admins read all chef services"
  on public.chef_services for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- E. Chef bookings
-- ---------------------------------------------------------------------------
create table if not exists public.chef_bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.users (id) on delete cascade,
  chef_id uuid not null references public.chefs (id) on delete cascade,
  service_id uuid not null references public.chef_services (id) on delete restrict,
  booking_status text not null default 'inquiry'
    check (booking_status in (
      'inquiry', 'pending_review', 'quoted', 'accepted', 'declined',
      'confirmed', 'in_progress', 'completed', 'cancelled'
    )),
  event_date date not null,
  event_time time,
  duration_hours numeric(4, 2),
  guest_count integer,
  location_address text,
  location_city text,
  location_state text,
  location_coordinates point,
  dietary_requirements text[] default '{}',
  special_requests text,
  quoted_amount integer,
  deposit_amount integer,
  deposit_paid boolean not null default false,
  final_amount integer,
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'deposit_paid', 'paid_in_full')),
  customer_notes text,
  chef_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chef_bookings_customer_idx on public.chef_bookings (customer_id);
create index if not exists chef_bookings_chef_idx on public.chef_bookings (chef_id);

alter table public.chef_bookings enable row level security;

drop policy if exists "Customers read own chef bookings" on public.chef_bookings;
create policy "Customers read own chef bookings"
  on public.chef_bookings for select using (auth.uid() = customer_id);

drop policy if exists "Customers insert own chef bookings" on public.chef_bookings;
create policy "Customers insert own chef bookings"
  on public.chef_bookings for insert with check (auth.uid() = customer_id);

drop policy if exists "Customers update own chef bookings" on public.chef_bookings;
create policy "Customers update own chef bookings"
  on public.chef_bookings for update using (auth.uid() = customer_id);

drop policy if exists "Chefs read their bookings" on public.chef_bookings;
create policy "Chefs read their bookings"
  on public.chef_bookings for select
  using (chef_id in (select id from public.chefs where user_id = auth.uid()));

drop policy if exists "Chefs update their bookings" on public.chef_bookings;
create policy "Chefs update their bookings"
  on public.chef_bookings for update
  using (chef_id in (select id from public.chefs where user_id = auth.uid()));

drop policy if exists "Admins read all chef bookings" on public.chef_bookings;
create policy "Admins read all chef bookings"
  on public.chef_bookings for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- F. Chef reviews
-- ---------------------------------------------------------------------------
create table if not exists public.chef_reviews (
  id uuid primary key default gen_random_uuid(),
  chef_id uuid not null references public.chefs (id) on delete cascade,
  customer_id uuid not null references public.users (id) on delete cascade,
  booking_id uuid references public.chef_bookings (id) on delete set null,
  rating integer not null check (rating >= 1 and rating <= 5),
  review_text text,
  response_text text,
  verified_booking boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists chef_reviews_chef_id_idx on public.chef_reviews (chef_id);

alter table public.chef_reviews enable row level security;

drop policy if exists "Public read chef reviews" on public.chef_reviews;
create policy "Public read chef reviews"
  on public.chef_reviews for select using (true);

drop policy if exists "Customers insert own chef reviews" on public.chef_reviews;
create policy "Customers insert own chef reviews"
  on public.chef_reviews for insert with check (auth.uid() = customer_id);

drop policy if exists "Chefs update review responses" on public.chef_reviews;
create policy "Chefs update review responses"
  on public.chef_reviews for update
  using (chef_id in (select id from public.chefs where user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- G. Chef portfolio
-- ---------------------------------------------------------------------------
create table if not exists public.chef_portfolio_items (
  id uuid primary key default gen_random_uuid(),
  chef_id uuid not null references public.chefs (id) on delete cascade,
  title text,
  description text,
  media_url text not null,
  media_type text not null check (media_type in ('image', 'video')),
  event_type text,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists chef_portfolio_chef_id_idx on public.chef_portfolio_items (chef_id);

alter table public.chef_portfolio_items enable row level security;

drop policy if exists "Chefs manage own portfolio" on public.chef_portfolio_items;
create policy "Chefs manage own portfolio"
  on public.chef_portfolio_items for all
  using (chef_id in (select id from public.chefs where user_id = auth.uid()))
  with check (chef_id in (select id from public.chefs where user_id = auth.uid()));

drop policy if exists "Public read chef portfolio" on public.chef_portfolio_items;
create policy "Public read chef portfolio"
  on public.chef_portfolio_items for select
  using (chef_id in (select id from public.chefs where approval_status = 'approved'));

-- ---------------------------------------------------------------------------
-- H. Products — direct sale fields
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists available_for_delivery boolean not null default false,
  add column if not exists available_for_pickup boolean not null default true,
  add column if not exists made_to_order boolean not null default false,
  add column if not exists lead_time_hours integer,
  add column if not exists dietary_tags text[] default '{}',
  add column if not exists ingredients text,
  add column if not exists allergen_info text,
  add column if not exists serving_size text,
  add column if not exists availability_type text not null default 'always'
    check (availability_type in ('always', 'event_only', 'preorder_only', 'seasonal'));

-- ---------------------------------------------------------------------------
-- I. Orders — optional event + delivery
-- ---------------------------------------------------------------------------
alter table public.orders alter column event_id drop not null;

alter table public.orders
  add column if not exists order_type text not null default 'event_pickup'
    check (order_type in ('event_pickup', 'direct_pickup', 'delivery')),
  add column if not exists delivery_address text,
  add column if not exists delivery_city text,
  add column if not exists delivery_state text,
  add column if not exists delivery_coordinates point,
  add column if not exists scheduled_datetime timestamptz,
  add column if not exists delivery_instructions text;

-- ---------------------------------------------------------------------------
-- J. Explore content
-- ---------------------------------------------------------------------------
create table if not exists public.explore_content (
  id uuid primary key default gen_random_uuid(),
  creator_type text not null check (creator_type in ('vendor', 'chef')),
  vendor_id uuid references public.vendors (id) on delete cascade,
  chef_id uuid references public.chefs (id) on delete cascade,
  content_type text not null
    check (content_type in (
      'portfolio', 'behind_scenes', 'recipe', 'promotion', 'announcement', 'menu_highlight'
    )),
  title text,
  caption text,
  media_urls text[] default '{}',
  linked_product_id uuid references public.products (id) on delete set null,
  linked_service_id uuid references public.chef_services (id) on delete set null,
  tags text[] default '{}',
  engagement_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint explore_content_creator_check check (
    (creator_type = 'vendor' and vendor_id is not null and chef_id is null)
    or (creator_type = 'chef' and chef_id is not null and vendor_id is null)
  )
);

create index if not exists explore_content_vendor_idx on public.explore_content (vendor_id);
create index if not exists explore_content_chef_idx on public.explore_content (chef_id);
create index if not exists explore_content_created_idx on public.explore_content (created_at desc);

alter table public.explore_content enable row level security;

drop policy if exists "Public read explore content" on public.explore_content;
create policy "Public read explore content"
  on public.explore_content for select using (true);

drop policy if exists "Vendors manage own explore content" on public.explore_content;
create policy "Vendors manage own explore content"
  on public.explore_content for all
  using (
    creator_type = 'vendor'
    and vendor_id in (select id from public.vendors where user_id = auth.uid())
  )
  with check (
    creator_type = 'vendor'
    and vendor_id in (select id from public.vendors where user_id = auth.uid())
  );

drop policy if exists "Chefs manage own explore content" on public.explore_content;
create policy "Chefs manage own explore content"
  on public.explore_content for all
  using (
    creator_type = 'chef'
    and chef_id in (select id from public.chefs where user_id = auth.uid())
  )
  with check (
    creator_type = 'chef'
    and chef_id in (select id from public.chefs where user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- K. Saved items (unified favorites)
-- ---------------------------------------------------------------------------
create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.users (id) on delete cascade,
  item_type text not null
    check (item_type in ('vendor', 'chef', 'product', 'service', 'event')),
  vendor_id uuid references public.vendors (id) on delete cascade,
  chef_id uuid references public.chefs (id) on delete cascade,
  product_id uuid references public.products (id) on delete cascade,
  service_id uuid references public.chef_services (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists saved_items_customer_idx on public.saved_items (customer_id);

alter table public.saved_items enable row level security;

drop policy if exists "Customers manage own saved items" on public.saved_items;
create policy "Customers manage own saved items"
  on public.saved_items for all using (auth.uid() = customer_id)
  with check (auth.uid() = customer_id);

-- Partial unique indexes per item type
create unique index if not exists saved_items_vendor_unique
  on public.saved_items (customer_id, vendor_id) where item_type = 'vendor';

create unique index if not exists saved_items_chef_unique
  on public.saved_items (customer_id, chef_id) where item_type = 'chef';

create unique index if not exists saved_items_product_unique
  on public.saved_items (customer_id, product_id) where item_type = 'product';

create unique index if not exists saved_items_service_unique
  on public.saved_items (customer_id, service_id) where item_type = 'service';

create unique index if not exists saved_items_event_unique
  on public.saved_items (customer_id, event_id) where item_type = 'event';

comment on table public.chefs is 'Vendorly — private chef profiles';
comment on table public.explore_content is 'Vendorly — visual showcase feed for vendors and chefs';
