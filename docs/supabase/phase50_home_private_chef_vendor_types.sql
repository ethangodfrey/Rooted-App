-- Vendorly Phase 50 — Home Chef / Private Chef vendor types + fulfillment fields
-- Apply after phase49.

-- Expand vendor_type check to include private_chef (Home Chef continues as home_kitchen)
alter table public.vendors drop constraint if exists vendors_vendor_type_check;

alter table public.vendors
  add constraint vendors_vendor_type_check
  check (
    vendor_type is null
    or vendor_type in (
      'farmers_market',
      'home_kitchen',
      'food_business',
      'caterer',
      'meal_prep',
      'private_chef'
    )
  );

-- Home Chef: cottage food disclosure shown on product / menu surfaces
alter table public.vendors
  add column if not exists cottage_food_disclosure text;

-- Private Chef service settings (travel radius reuses delivery_radius_miles)
alter table public.vendors
  add column if not exists base_service_rate_cents integer,
  add column if not exists minimum_guest_count integer;

comment on column public.vendors.cottage_food_disclosure is
  'Phase 50: Home Chef cottage-food license / legal disclaimer for product pages.';
comment on column public.vendors.base_service_rate_cents is
  'Phase 50: Private Chef base service rate in cents.';
comment on column public.vendors.minimum_guest_count is
  'Phase 50: Private Chef minimum guest count.';
