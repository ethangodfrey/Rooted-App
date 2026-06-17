-- Rooted Phase 9 add-on: product-level reservation limits
-- Run in Supabase SQL Editor after phase9_orders.sql.
--
-- Adds two optional product-level caps that vendors control from the product
-- form (NULL = unlimited):
--   reserve_limit_total       - total units offered for reservation (all events)
--   reserve_limit_per_shopper - max units a single shopper may reserve
--
-- These apply on top of the per-event presale cap in
-- product_event_availability; the strictest limit wins.

alter table public.products
  add column if not exists reserve_limit_total integer,
  add column if not exists reserve_limit_per_shopper integer;

-- Recreate the reservation RPC to enforce the new caps.
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
  v_shopper_id      uuid;
  v_vendor_id       uuid;
  v_price           integer;
  v_reserve         boolean;
  v_limit_total     integer;
  v_limit_shopper   integer;
  v_cap             integer;
  v_reserved        integer;
  v_total_reserved  integer;
  v_shopper_reserved integer;
  v_order_id        uuid;
begin
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantity must be at least 1';
  end if;

  select id into v_shopper_id from public.shoppers where user_id = auth.uid();
  if v_shopper_id is null then
    raise exception 'Only shoppers can reserve products';
  end if;

  select vendor_id, price, reserve_enabled, reserve_limit_total, reserve_limit_per_shopper
    into v_vendor_id, v_price, v_reserve, v_limit_total, v_limit_shopper
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

  -- Per-event presale cap.
  select coalesce(sum(oi.quantity), 0)
    into v_reserved
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.product_id = p_product_id
      and o.event_id = p_event_id
      and o.order_status not in ('declined', 'cancelled');

  if v_reserved + p_quantity > v_cap then
    raise exception 'Only % presale spots remain for this event', greatest(v_cap - v_reserved, 0);
  end if;

  -- Optional product-wide total reservation cap (across all events).
  if v_limit_total is not null then
    select coalesce(sum(oi.quantity), 0)
      into v_total_reserved
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.product_id = p_product_id
        and o.order_status not in ('declined', 'cancelled');

    if v_total_reserved + p_quantity > v_limit_total then
      raise exception 'Only % reservation spots remain', greatest(v_limit_total - v_total_reserved, 0);
    end if;
  end if;

  -- Optional per-shopper cap for this product (across all events).
  if v_limit_shopper is not null then
    select coalesce(sum(oi.quantity), 0)
      into v_shopper_reserved
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.product_id = p_product_id
        and o.shopper_id = v_shopper_id
        and o.order_status not in ('declined', 'cancelled');

    if v_shopper_reserved + p_quantity > v_limit_shopper then
      raise exception 'You can reserve at most % of this item', v_limit_shopper;
    end if;
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
