-- Vendorly Phase 83a — Home Chef / Private Chef / Micro-Brand personas + fulfillment
-- Apply after phase82.

-- Expand vendor_type check (Home Chef = home_kitchen, Private Chef, Micro-Brand)
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
      'private_chef',
      'micro_brand'
    )
  );

-- Home Chef: cottage food disclosure shown on product / menu surfaces
alter table public.vendors
  add column if not exists cottage_food_disclosure text;

-- Private Chef service settings (travel radius reuses delivery_radius_miles)
alter table public.vendors
  add column if not exists base_service_rate_cents integer,
  add column if not exists minimum_guest_count integer;

-- Micro-Brand / Maker nationwide shipping
alter table public.vendors
  add column if not exists shipping_enabled boolean not null default false,
  add column if not exists flat_rate_shipping_fee_cents integer,
  add column if not exists free_shipping_minimum_cents integer;

-- Product variants (Size/Color combos) for micro brands / optional has_variants
alter table public.products
  add column if not exists has_variants boolean not null default false,
  add column if not exists variants jsonb not null default '{}'::jsonb;

comment on column public.vendors.cottage_food_disclosure is
  'Phase 83a: Home Chef cottage-food license / legal disclaimer for product pages.';
comment on column public.vendors.base_service_rate_cents is
  'Phase 83a: Private Chef base service rate in cents.';
comment on column public.vendors.minimum_guest_count is
  'Phase 83a: Private Chef minimum guest count.';
comment on column public.vendors.shipping_enabled is
  'Phase 83a: Micro-Brand enables nationwide shipping at checkout.';
comment on column public.vendors.flat_rate_shipping_fee_cents is
  'Phase 83a: Flat-rate shipping fee in cents (waived above free_shipping_minimum_cents).';
comment on column public.vendors.free_shipping_minimum_cents is
  'Phase 83a: Order subtotal (cents) that unlocks free shipping.';
comment on column public.products.has_variants is
  'Phase 83a: product uses variants JSON for size/color/stock combos.';
comment on column public.products.variants is
  'Phase 83a: { attributes: [{name, values}], combinations: [{id, options, price_cents, stock}] }.';
