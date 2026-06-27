-- Vendorly Marketplace — Phase 23 (Enhanced Plan)
-- Run in Supabase SQL Editor after phase22_vendorly_marketplace.sql
--
-- Safe to RE-RUN after partial failures (policies use DROP IF EXISTS).
-- Adds: trust/verification, cottage food compliance, unified reviews,
-- inventory holds with oversell protection.
-- Does NOT include messaging tables (Phase 2) or PostGIS (optional phase23b).

-- ---------------------------------------------------------------------------
-- 1. Trust & verification
-- ---------------------------------------------------------------------------
create table if not exists public.verification_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  credential_type text not null
    check (credential_type in (
      'identity_verified',
      'food_safety_certified',
      'cottage_food_permit',
      'commercial_kitchen',
      'health_department_permit',
      'liability_insurance',
      'business_license'
    )),
  issuing_authority text,
  credential_number text,
  issue_date date,
  expiry_date date,
  document_url text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected', 'expired')),
  verified_by uuid references public.users (id),
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists verification_credentials_user_idx
  on public.verification_credentials (user_id);

alter table public.verification_credentials enable row level security;

drop policy if exists "Users read own credentials" on public.verification_credentials;
create policy "Users read own credentials"
  on public.verification_credentials for select using (auth.uid() = user_id);

drop policy if exists "Users insert own credentials" on public.verification_credentials;
create policy "Users insert own credentials"
  on public.verification_credentials for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own pending credentials" on public.verification_credentials;
create policy "Users update own pending credentials"
  on public.verification_credentials for update using (auth.uid() = user_id);

drop policy if exists "Admins manage all credentials" on public.verification_credentials;
create policy "Admins manage all credentials"
  on public.verification_credentials for all using (public.is_admin());

create table if not exists public.trust_badges (
  id uuid primary key default gen_random_uuid(),
  badge_type text not null unique
    check (badge_type in (
      'identity_verified',
      'food_safety_certified',
      'top_rated',
      'quick_responder',
      'established_seller',
      'superhost',
      'market_regular'
    )),
  badge_name text not null,
  badge_icon text,
  badge_description text,
  requirements jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  badge_id uuid not null references public.trust_badges (id) on delete cascade,
  earned_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (user_id, badge_id)
);

alter table public.trust_badges enable row level security;
alter table public.user_badges enable row level security;

drop policy if exists "Public read trust badges" on public.trust_badges;
create policy "Public read trust badges"
  on public.trust_badges for select using (true);

drop policy if exists "Public read user badges" on public.user_badges;
create policy "Public read user badges"
  on public.user_badges for select using (true);

drop policy if exists "Admins manage user badges" on public.user_badges;
create policy "Admins manage user badges"
  on public.user_badges for all using (public.is_admin());

-- Seed badge definitions
insert into public.trust_badges (badge_type, badge_name, badge_icon, badge_description)
values
  ('identity_verified', 'Verified ID', 'id-card', 'Government identity verified'),
  ('food_safety_certified', 'Food Safety', 'certificate', 'Food handler or safety certification on file'),
  ('top_rated', 'Top Rated', 'star', 'Consistently high customer ratings'),
  ('quick_responder', 'Quick Responder', 'bolt', 'Responds to inquiries within 24 hours'),
  ('established_seller', 'Established Seller', 'shopping-basket', '50+ completed orders'),
  ('superhost', 'Super Chef', 'cutlery', '4.8+ rating with 20+ completed bookings'),
  ('market_regular', 'Market Regular', 'calendar', 'Active at 10+ farmers markets')
on conflict (badge_type) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Cottage food compliance
-- ---------------------------------------------------------------------------
create table if not exists public.state_food_regulations (
  id uuid primary key default gen_random_uuid(),
  state_code text not null unique,
  state_name text not null,
  cottage_food_allowed boolean not null default true,
  annual_revenue_limit integer,
  requires_food_handler_cert boolean not null default false,
  requires_kitchen_inspection boolean not null default false,
  requires_permit boolean not null default false,
  permit_application_url text,
  allows_online_sales boolean not null default false,
  allows_farmers_market_sales boolean not null default true,
  allows_retail_sales boolean not null default false,
  allows_wholesale boolean not null default false,
  allowed_product_categories text[] default '{}',
  prohibited_products text[] default '{}',
  requires_no_tcs_foods boolean not null default true,
  required_label_fields text[] default '{}',
  required_disclaimer text,
  mhko_allowed boolean not null default false,
  mhko_municipalities text[] default '{}',
  regulation_url text,
  last_updated date,
  created_at timestamptz not null default now()
);

create table if not exists public.vendor_compliance (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null unique references public.vendors (id) on delete cascade,
  state_code text references public.state_food_regulations (state_code),
  ytd_revenue integer not null default 0,
  revenue_year integer,
  revenue_limit_warning_sent boolean not null default false,
  compliance_status text not null default 'pending_review'
    check (compliance_status in ('compliant', 'pending_review', 'needs_attention', 'suspended')),
  has_required_permits boolean not null default false,
  has_food_handler_cert boolean not null default false,
  labeling_compliant boolean not null default false,
  last_compliance_check timestamptz,
  next_review_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.state_food_regulations enable row level security;
alter table public.vendor_compliance enable row level security;

drop policy if exists "Public read state regulations" on public.state_food_regulations;
create policy "Public read state regulations"
  on public.state_food_regulations for select using (true);

drop policy if exists "Vendors read own compliance" on public.vendor_compliance;
create policy "Vendors read own compliance"
  on public.vendor_compliance for select
  using (vendor_id in (select id from public.vendors where user_id = auth.uid()));

drop policy if exists "Vendors update own compliance" on public.vendor_compliance;
create policy "Vendors update own compliance"
  on public.vendor_compliance for update
  using (vendor_id in (select id from public.vendors where user_id = auth.uid()));

drop policy if exists "Admins manage vendor compliance" on public.vendor_compliance;
create policy "Admins manage vendor compliance"
  on public.vendor_compliance for all using (public.is_admin());

-- Seed key states (expand over time)
insert into public.state_food_regulations (
  state_code, state_name, cottage_food_allowed, annual_revenue_limit,
  requires_food_handler_cert, requires_permit, allows_online_sales,
  allowed_product_categories, prohibited_products, required_label_fields,
  required_disclaimer, regulation_url, last_updated
) values
(
  'TX', 'Texas', true, 5000000,
  true, true, true,
  array['baked_goods', 'jams', 'candies', 'pickles', 'nuts'],
  array['meat', 'dairy', 'canned_vegetables', 'low_acid_foods'],
  array['business_name', 'address', 'ingredients', 'allergens'],
  'Made in a home kitchen that has not been inspected by the state or local health department.',
  'https://www.dshs.texas.gov/food-manufacturers-wholesalers/cottage-food-production-operations',
  current_date
),
(
  'CA', 'California', true, null,
  true, true, true,
  array['baked_goods', 'jams', 'candies', 'dried_foods'],
  array['meat', 'dairy', 'seafood', 'low_acid_foods'],
  array['business_name', 'address', 'ingredients', 'allergens', 'permit_number'],
  'Made in a home kitchen that is not subject to routine health department inspection.',
  'https://www.cdph.ca.gov/Programs/CEH/DFDCS/Pages/MEHKO.aspx',
  current_date
),
(
  'CO', 'Colorado', true, 10000000,
  true, true, true,
  array['baked_goods', 'jams', 'candies', 'spices', 'teas'],
  array['meat', 'dairy', 'canned_vegetables'],
  array['business_name', 'address', 'ingredients'],
  'This product was produced in a home kitchen that is not subject to state licensure or inspection.',
  'https://cdphe.colorado.gov/cottage-foods',
  current_date
)
on conflict (state_code) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Unified reviews (vendors, chefs, products)
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid references public.users (id) on delete set null,
  target_type text not null check (target_type in ('vendor', 'chef', 'product')),
  vendor_id uuid references public.vendors (id) on delete cascade,
  chef_id uuid references public.chefs (id) on delete cascade,
  product_id uuid references public.products (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  booking_id uuid references public.chef_bookings (id) on delete set null,
  overall_rating integer not null check (overall_rating >= 1 and overall_rating <= 5),
  food_quality_rating integer check (food_quality_rating >= 1 and food_quality_rating <= 5),
  communication_rating integer check (communication_rating >= 1 and communication_rating <= 5),
  value_rating integer check (value_rating >= 1 and value_rating <= 5),
  review_title text,
  review_text text,
  media_urls text[] default '{}',
  verified_purchase boolean not null default false,
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'flagged', 'removed')),
  flagged_reason text,
  response_text text,
  response_at timestamptz,
  helpful_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_valid_target check (
    (target_type = 'vendor' and vendor_id is not null and chef_id is null and product_id is null)
    or (target_type = 'chef' and chef_id is not null and vendor_id is null and product_id is null)
    or (target_type = 'product' and product_id is not null and vendor_id is null and chef_id is null)
  )
);

create index if not exists reviews_vendor_idx on public.reviews (vendor_id);
create index if not exists reviews_chef_idx on public.reviews (chef_id);
create index if not exists reviews_product_idx on public.reviews (product_id);

alter table public.reviews enable row level security;

drop policy if exists "Public read approved reviews" on public.reviews;
create policy "Public read approved reviews"
  on public.reviews for select using (moderation_status = 'approved');

drop policy if exists "Reviewers read own reviews" on public.reviews;
create policy "Reviewers read own reviews"
  on public.reviews for select using (auth.uid() = reviewer_id);

drop policy if exists "Customers insert reviews" on public.reviews;
create policy "Customers insert reviews"
  on public.reviews for insert with check (auth.uid() = reviewer_id);

drop policy if exists "Vendors respond to their reviews" on public.reviews;
create policy "Vendors respond to their reviews"
  on public.reviews for update
  using (vendor_id in (select id from public.vendors where user_id = auth.uid()));

drop policy if exists "Chefs respond to their reviews" on public.reviews;
create policy "Chefs respond to their reviews"
  on public.reviews for update
  using (chef_id in (select id from public.chefs where user_id = auth.uid()));

drop policy if exists "Admins moderate reviews" on public.reviews;
create policy "Admins moderate reviews"
  on public.reviews for all using (public.is_admin());

create table if not exists public.review_votes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  is_helpful boolean not null,
  created_at timestamptz not null default now(),
  unique (review_id, user_id)
);

alter table public.review_votes enable row level security;

drop policy if exists "Users manage own review votes" on public.review_votes;
create policy "Users manage own review votes"
  on public.review_votes for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.rating_aggregates (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id uuid not null,
  total_reviews integer not null default 0,
  average_rating numeric(3, 2),
  rating_distribution jsonb default '{}'::jsonb,
  average_food_quality numeric(3, 2),
  average_communication numeric(3, 2),
  average_value numeric(3, 2),
  last_review_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (target_type, target_id)
);

alter table public.rating_aggregates enable row level security;

drop policy if exists "Public read rating aggregates" on public.rating_aggregates;
create policy "Public read rating aggregates"
  on public.rating_aggregates for select using (true);

-- ---------------------------------------------------------------------------
-- 4. Inventory holds (oversell protection)
-- ---------------------------------------------------------------------------
alter table public.product_event_availability
  add column if not exists reserved_quantity integer not null default 0;

create table if not exists public.inventory_holds (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  customer_id uuid not null references public.users (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  hold_type text not null default 'cart'
    check (hold_type in ('cart', 'checkout', 'confirmed')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists inventory_holds_product_event_idx
  on public.inventory_holds (product_id, event_id);

alter table public.inventory_holds enable row level security;

drop policy if exists "Customers read own holds" on public.inventory_holds;
create policy "Customers read own holds"
  on public.inventory_holds for select using (auth.uid() = customer_id);

drop policy if exists "Customers insert own holds" on public.inventory_holds;
create policy "Customers insert own holds"
  on public.inventory_holds for insert with check (auth.uid() = customer_id);

create or replace function public.reserve_inventory(
  p_product_id uuid,
  p_event_id uuid,
  p_customer_id uuid,
  p_quantity integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available integer;
  v_hold_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    return jsonb_build_object('success', false, 'error', 'Invalid quantity');
  end if;

  select available_quantity_presale - reserved_quantity
  into v_available
  from public.product_event_availability
  where product_id = p_product_id and event_id = p_event_id
  for update;

  if v_available is null then
    return jsonb_build_object('success', false, 'error', 'Product not available at this event');
  end if;

  if v_available < p_quantity then
    return jsonb_build_object('success', false, 'error', 'Insufficient quantity', 'available', v_available);
  end if;

  insert into public.inventory_holds (product_id, event_id, customer_id, quantity, expires_at)
  values (p_product_id, p_event_id, p_customer_id, p_quantity, now() + interval '15 minutes')
  returning id into v_hold_id;

  update public.product_event_availability
  set reserved_quantity = reserved_quantity + p_quantity
  where product_id = p_product_id and event_id = p_event_id;

  return jsonb_build_object(
    'success', true,
    'hold_id', v_hold_id,
    'expires_at', now() + interval '15 minutes'
  );
end;
$$;

create or replace function public.cleanup_expired_holds()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.product_event_availability pea
  set reserved_quantity = greatest(0, pea.reserved_quantity - expired.total_qty)
  from (
    select product_id, event_id, sum(quantity) as total_qty
    from public.inventory_holds
    where expires_at < now() and hold_type = 'cart'
    group by product_id, event_id
  ) expired
  where pea.product_id = expired.product_id
    and pea.event_id = expired.event_id;

  delete from public.inventory_holds
  where expires_at < now() and hold_type = 'cart';
end;
$$;

grant execute on function public.reserve_inventory(uuid, uuid, uuid, integer) to authenticated;
grant execute on function public.cleanup_expired_holds() to authenticated;

comment on table public.verification_credentials is 'Vendorly enhanced — seller verification documents';
comment on table public.state_food_regulations is 'Vendorly enhanced — cottage food rules by state';
comment on table public.reviews is 'Vendorly enhanced — unified verified reviews';
