-- Vendorly Phase 23b — inventory hold checkout integration
-- Run in Supabase SQL Editor after phase23_vendorly_enhanced.sql
--
-- Adds release/confirm hold RPCs and updates create_reservation to respect
-- product_event_availability.reserved_quantity (active holds).

create or replace function public.release_inventory_hold(p_hold_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold public.inventory_holds%rowtype;
begin
  select * into v_hold
  from public.inventory_holds
  where id = p_hold_id and customer_id = auth.uid()
  for update;

  if v_hold.id is null then
    return jsonb_build_object('success', false, 'error', 'Hold not found');
  end if;

  if v_hold.hold_type in ('cart', 'checkout') then
    update public.product_event_availability
    set reserved_quantity = greatest(0, reserved_quantity - v_hold.quantity)
    where product_id = v_hold.product_id and event_id = v_hold.event_id;

    delete from public.inventory_holds where id = p_hold_id;
  end if;

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.confirm_reservation_hold(
  p_order_id uuid,
  p_hold_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold public.inventory_holds%rowtype;
  v_shopper_id uuid;
begin
  select id into v_shopper_id from public.shoppers where user_id = auth.uid();
  if v_shopper_id is null then
    return jsonb_build_object('success', false, 'error', 'Only shoppers can confirm holds');
  end if;

  select * into v_hold
  from public.inventory_holds
  where id = p_hold_id and customer_id = auth.uid()
  for update;

  if v_hold.id is null then
    return jsonb_build_object('success', false, 'error', 'Hold not found');
  end if;

  if v_hold.hold_type not in ('cart', 'checkout') then
    return jsonb_build_object('success', false, 'error', 'Hold already processed');
  end if;

  if not exists (
    select 1
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.id = p_order_id
      and o.shopper_id = v_shopper_id
      and o.event_id = v_hold.event_id
      and oi.product_id = v_hold.product_id
      and oi.quantity = v_hold.quantity
  ) then
    return jsonb_build_object('success', false, 'error', 'Order does not match hold');
  end if;

  update public.product_event_availability
  set reserved_quantity = greatest(0, reserved_quantity - v_hold.quantity)
  where product_id = v_hold.product_id and event_id = v_hold.event_id;

  delete from public.inventory_holds where id = p_hold_id;

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.create_reservation(
  p_product_id uuid,
  p_event_id   uuid,
  p_quantity   integer,
  p_notes      text default null,
  p_hold_id    uuid default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_shopper_id       uuid;
  v_vendor_id        uuid;
  v_price            integer;
  v_reserve          boolean;
  v_limit_total      integer;
  v_limit_shopper    integer;
  v_cap              integer;
  v_held             integer;
  v_hold_qty         integer;
  v_reserved         integer;
  v_total_reserved   integer;
  v_shopper_reserved integer;
  v_order_id         uuid;
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

  select available_quantity_presale, reserved_quantity
    into v_cap, v_held
    from public.product_event_availability
    where product_id = p_product_id and event_id = p_event_id
    for update;
  if v_cap is null then
    raise exception 'Product is not available at this event';
  end if;

  v_hold_qty := 0;
  if p_hold_id is not null then
    select quantity into v_hold_qty
    from public.inventory_holds
    where id = p_hold_id
      and customer_id = auth.uid()
      and product_id = p_product_id
      and event_id = p_event_id
      and hold_type in ('cart', 'checkout');
    if v_hold_qty is null then
      raise exception 'Invalid inventory hold';
    end if;
    if v_hold_qty <> p_quantity then
      raise exception 'Hold quantity does not match reservation';
    end if;
    v_held := greatest(0, v_held - v_hold_qty);
  end if;

  select coalesce(sum(oi.quantity), 0)
    into v_reserved
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.product_id = p_product_id
      and o.event_id = p_event_id
      and o.order_status not in ('declined', 'cancelled');

  if v_reserved + v_held + p_quantity > v_cap then
    raise exception 'Only % presale spots remain for this event', greatest(v_cap - v_reserved - v_held, 0);
  end if;

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

grant execute on function public.release_inventory_hold(uuid) to authenticated;
grant execute on function public.confirm_reservation_hold(uuid, uuid) to authenticated;
grant execute on function public.create_reservation(uuid, uuid, integer, text, uuid) to authenticated;
