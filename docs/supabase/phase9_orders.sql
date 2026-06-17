-- Rooted Phase 9: reserve-for-pickup orders (Model A)
-- Run in Supabase SQL Editor after phase7_products.sql.
-- Model A = reserve now, pay at pickup. payment_status stays 'unpaid'
-- until the vendor marks 'paid_at_pickup' when fulfilling.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  shopper_id       uuid not null references public.shoppers (id) on delete cascade,
  vendor_id        uuid not null references public.vendors (id) on delete cascade,
  event_id         uuid not null references public.events (id) on delete cascade,
  order_status     text not null default 'submitted'
    check (order_status in (
      'submitted', 'pending_review', 'accepted', 'declined',
      'preparing', 'ready_for_pickup', 'fulfilled', 'cancelled'
    )),
  payment_status   text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid_at_pickup')),
  fulfillment_type text default 'pickup',
  pickup_datetime  timestamptz,
  subtotal         integer not null,
  tax              integer not null default 0,
  total            integer not null,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders (id) on delete cascade,
  product_id          uuid not null references public.products (id),
  quantity            integer not null check (quantity > 0),
  item_price          integer not null,
  customization_data  jsonb,
  fulfillment_status  text
);

create index if not exists orders_shopper_idx on public.orders (shopper_id);
create index if not exists orders_vendor_idx on public.orders (vendor_id);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_product_idx on public.order_items (product_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- ---------------------------------------------------------------------------
-- RLS: orders
-- ---------------------------------------------------------------------------
create policy "Shoppers read own orders"
  on public.orders for select
  using (shopper_id in (select id from public.shoppers where user_id = auth.uid()));

create policy "Vendors read their orders"
  on public.orders for select
  using (vendor_id in (select id from public.vendors where user_id = auth.uid()));

-- Shoppers may update their own order (used for cancelling); vendors may update
-- orders placed with them (status / payment transitions).
create policy "Shoppers update own orders"
  on public.orders for update
  using (shopper_id in (select id from public.shoppers where user_id = auth.uid()))
  with check (shopper_id in (select id from public.shoppers where user_id = auth.uid()));

create policy "Vendors update their orders"
  on public.orders for update
  using (vendor_id in (select id from public.vendors where user_id = auth.uid()))
  with check (vendor_id in (select id from public.vendors where user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- RLS: order_items (visible when the parent order is visible)
-- ---------------------------------------------------------------------------
create policy "Read order items for visible orders"
  on public.order_items for select
  using (
    order_id in (
      select id from public.orders
      where shopper_id in (select id from public.shoppers where user_id = auth.uid())
         or vendor_id in (select id from public.vendors where user_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Atomic reservation: validates presale capacity, then inserts order + item.
-- Runs as security definer so it can enforce the cap across all shoppers.
-- ---------------------------------------------------------------------------
create or replace function public.create_reservation(
  p_product_id uuid,
  p_event_id   uuid,
  p_quantity   integer,
  p_notes      text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_shopper_id uuid;
  v_vendor_id  uuid;
  v_price      integer;
  v_reserve    boolean;
  v_cap        integer;
  v_reserved   integer;
  v_order_id   uuid;
begin
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantity must be at least 1';
  end if;

  select id into v_shopper_id from public.shoppers where user_id = auth.uid();
  if v_shopper_id is null then
    raise exception 'Only shoppers can reserve products';
  end if;

  select vendor_id, price, reserve_enabled
    into v_vendor_id, v_price, v_reserve
    from public.products
    where id = p_product_id;
  if v_vendor_id is null then
    raise exception 'Product not found';
  end if;
  if not v_reserve then
    raise exception 'This product is not available for reservation';
  end if;

  select available_quantity_presale
    into v_cap
    from public.product_event_availability
    where product_id = p_product_id and event_id = p_event_id;
  if v_cap is null then
    raise exception 'Product is not available at this event';
  end if;

  -- Quantity already committed to (anything not declined/cancelled).
  select coalesce(sum(oi.quantity), 0)
    into v_reserved
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.product_id = p_product_id
      and o.event_id = p_event_id
      and o.order_status not in ('declined', 'cancelled');

  if v_reserved + p_quantity > v_cap then
    raise exception 'Only % presale spots remain', greatest(v_cap - v_reserved, 0);
  end if;

  insert into public.orders (
    shopper_id, vendor_id, event_id, order_status, payment_status,
    subtotal, tax, total, notes
  ) values (
    v_shopper_id, v_vendor_id, p_event_id, 'submitted', 'unpaid',
    v_price * p_quantity, 0, v_price * p_quantity, p_notes
  ) returning id into v_order_id;

  insert into public.order_items (order_id, product_id, quantity, item_price)
  values (v_order_id, p_product_id, p_quantity, v_price);

  return v_order_id;
end;
$$;

grant execute on function public.create_reservation(uuid, uuid, integer, text) to authenticated;
