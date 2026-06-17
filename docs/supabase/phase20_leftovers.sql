-- Rooted Phase 20: vendor leftovers (post-market surplus)
-- Run in Supabase SQL Editor after phase9_orders.sql and phase6_vendor_events.sql.
-- Vendors list unsold items with expiry + pickup location; shoppers reserve nearby deals.

-- ---------------------------------------------------------------------------
-- leftover_listings
-- ---------------------------------------------------------------------------
create table if not exists public.leftover_listings (
  id                  uuid primary key default gen_random_uuid(),
  vendor_id           uuid not null references public.vendors (id) on delete cascade,
  product_id          uuid references public.products (id) on delete set null,
  source_event_id     uuid references public.events (id) on delete set null,
  title               text not null,
  description         text,
  media_url           text,
  price_cents         integer not null check (price_cents >= 0),
  quantity_total      integer not null check (quantity_total > 0),
  quantity_remaining  integer not null check (quantity_remaining >= 0),
  available_from      timestamptz not null default now(),
  expires_at          timestamptz not null,
  pickup_address      text,
  pickup_city         text,
  pickup_state        text,
  pickup_latitude     numeric,
  pickup_longitude    numeric,
  pickup_notes        text,
  status              text not null default 'active'
    check (status in ('active', 'sold_out', 'expired', 'cancelled')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists leftover_listings_vendor_idx
  on public.leftover_listings (vendor_id, created_at desc);

create index if not exists leftover_listings_active_idx
  on public.leftover_listings (status, expires_at)
  where status = 'active';

create index if not exists leftover_listings_geo_idx
  on public.leftover_listings (pickup_latitude, pickup_longitude)
  where pickup_latitude is not null;

-- ---------------------------------------------------------------------------
-- Extend orders for leftover pickup (event_id becomes optional)
-- ---------------------------------------------------------------------------
alter table public.orders
  alter column event_id drop not null;

alter table public.orders
  add column if not exists leftover_listing_id uuid
    references public.leftover_listings (id) on delete set null;

alter table public.order_items
  alter column product_id drop not null;

alter table public.order_items
  add column if not exists leftover_listing_id uuid
    references public.leftover_listings (id) on delete set null;

alter table public.order_items
  add column if not exists item_title text;

-- ---------------------------------------------------------------------------
-- RLS: leftover_listings
-- ---------------------------------------------------------------------------
alter table public.leftover_listings enable row level security;

create policy "Vendors manage own leftover listings"
  on public.leftover_listings for all
  using (vendor_id in (select id from public.vendors where user_id = auth.uid()))
  with check (vendor_id in (select id from public.vendors where user_id = auth.uid()));

create policy "Shoppers read active leftover listings"
  on public.leftover_listings for select
  using (
    status = 'active'
    and quantity_remaining > 0
    and expires_at > now()
    and available_from <= now()
    and exists (
      select 1 from public.vendors v
      where v.id = leftover_listings.vendor_id
        and v.approval_status = 'approved'
    )
  );

create policy "Admins read all leftover listings"
  on public.leftover_listings for select
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Atomic leftover reservation
-- ---------------------------------------------------------------------------
create or replace function public.create_leftover_reservation(
  p_leftover_id uuid,
  p_quantity    integer,
  p_notes       text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_shopper_id   uuid;
  v_listing      public.leftover_listings%rowtype;
  v_order_id     uuid;
  v_product_id   uuid;
begin
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantity must be at least 1';
  end if;

  select id into v_shopper_id from public.shoppers where user_id = auth.uid();
  if v_shopper_id is null then
    raise exception 'Only shoppers can reserve leftovers';
  end if;

  select * into v_listing
  from public.leftover_listings
  where id = p_leftover_id
  for update;

  if v_listing.id is null then
    raise exception 'Leftover listing not found';
  end if;
  if v_listing.status <> 'active' then
    raise exception 'This leftover listing is no longer available';
  end if;
  if v_listing.expires_at <= now() then
    raise exception 'This leftover listing has expired';
  end if;
  if v_listing.available_from > now() then
    raise exception 'This leftover listing is not available yet';
  end if;
  if p_quantity > v_listing.quantity_remaining then
    raise exception 'Only % remaining', v_listing.quantity_remaining;
  end if;

  v_product_id := v_listing.product_id;

  insert into public.orders (
    shopper_id, vendor_id, event_id, leftover_listing_id,
    order_status, payment_status, fulfillment_type,
    subtotal, tax, total, notes
  ) values (
    v_shopper_id, v_listing.vendor_id, null, v_listing.id,
    'submitted', 'unpaid', 'leftover_pickup',
    v_listing.price_cents * p_quantity, 0, v_listing.price_cents * p_quantity, p_notes
  ) returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, leftover_listing_id, item_title, quantity, item_price
  ) values (
    v_order_id, v_product_id, v_listing.id, v_listing.title, p_quantity, v_listing.price_cents
  );

  update public.leftover_listings
  set
    quantity_remaining = quantity_remaining - p_quantity,
    status = case when quantity_remaining - p_quantity <= 0 then 'sold_out' else status end,
    updated_at = now()
  where id = v_listing.id;

  return v_order_id;
end;
$$;

grant execute on function public.create_leftover_reservation(uuid, integer, text) to authenticated;

-- Mark expired listings (call from cron or on read)
create or replace function public.expire_leftover_listings()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer;
begin
  update public.leftover_listings
  set status = 'expired', updated_at = now()
  where status = 'active' and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.expire_leftover_listings() to authenticated;
