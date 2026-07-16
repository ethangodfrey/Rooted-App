-- Vendorly Phase 48 — pickup codes + market windows on storefront checkout
-- Apply after phase36 (pickup_code columns) and phase42 (orders.market_id).
-- Aligns create_storefront_checkout with Nest /checkout: 6-char pickup codes,
-- fulfillment windows from the event, and optional markets.event_id bridge.

create or replace function public.generate_pickup_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  -- Matches Nest checkout.service.ts alphabet (no 0/O/1/I).
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text := '';
  v_i integer;
begin
  for v_i in 1..6 loop
    v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1);
  end loop;
  return v_code;
end;
$$;

create or replace function public.create_storefront_checkout(
  p_vendor_id       uuid,
  p_event_id        uuid,
  p_items           jsonb,
  p_notes           text default null,
  p_payment_method  text default 'reserve'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shopper_id   uuid;
  v_line         jsonb;
  v_product_id   uuid;
  v_quantity     integer;
  v_hold_id      uuid;
  v_price        integer;
  v_subtotal     integer := 0;
  v_order_id     uuid;
  v_validation   jsonb;
  v_pickup_code  text;
  v_attempts     integer := 0;
  v_window_start timestamptz;
  v_window_end   timestamptz;
  v_market_id    uuid;
begin
  select id into v_shopper_id from public.shoppers where user_id = auth.uid();
  if v_shopper_id is null then
    return jsonb_build_object('success', false, 'error', 'Only shoppers can checkout');
  end if;

  v_validation := public.validate_storefront_cart(p_vendor_id, p_event_id, p_items);
  if not (v_validation->>'valid')::boolean then
    return jsonb_build_object(
      'success', false,
      'error', coalesce(v_validation->>'error', 'Validation failed'),
      'issues', v_validation->'issues'
    );
  end if;

  select e.start_datetime, e.end_datetime
    into v_window_start, v_window_end
  from public.events e
  where e.id = p_event_id;

  if v_window_start is null then
    return jsonb_build_object('success', false, 'error', 'Market event not found');
  end if;

  select m.id
    into v_market_id
  from public.markets m
  where m.event_id = p_event_id
  order by m.created_at asc nulls last
  limit 1;

  loop
    v_attempts := v_attempts + 1;
    v_pickup_code := public.generate_pickup_code();
    exit when not exists (
      select 1 from public.orders o where o.pickup_code = v_pickup_code
    );
    if v_attempts >= 12 then
      return jsonb_build_object('success', false, 'error', 'Could not allocate pickup code');
    end if;
  end loop;

  for v_line in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_line->>'product_id')::uuid;
    v_quantity := (v_line->>'quantity')::integer;
    v_hold_id := nullif(v_line->>'hold_id', '')::uuid;

    if v_hold_id is not null then
      if not exists (
        select 1 from public.inventory_holds h
        where h.id = v_hold_id
          and h.customer_id = auth.uid()
          and h.product_id = v_product_id
          and h.event_id = p_event_id
          and h.quantity = v_quantity
          and h.hold_type in ('cart', 'checkout')
          and h.expires_at > now()
      ) then
        return jsonb_build_object('success', false, 'error', 'Invalid or expired hold', 'product_id', v_product_id);
      end if;
    end if;

    select price into v_price from public.products where id = v_product_id;
    v_subtotal := v_subtotal + (v_price * v_quantity);
  end loop;

  insert into public.orders (
    shopper_id, vendor_id, event_id, market_id, order_status, payment_status,
    subtotal, tax, total, notes, pickup_code,
    fulfillment_window_start, fulfillment_window_end, order_type, fulfillment_type
  ) values (
    v_shopper_id,
    p_vendor_id,
    p_event_id,
    v_market_id,
    'submitted',
    case when p_payment_method = 'stripe' then 'stripe_pending' else 'unpaid' end,
    v_subtotal,
    0,
    v_subtotal,
    p_notes,
    v_pickup_code,
    v_window_start,
    coalesce(v_window_end, v_window_start),
    'event_pickup',
    'pickup'
  ) returning id into v_order_id;

  for v_line in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_line->>'product_id')::uuid;
    v_quantity := (v_line->>'quantity')::integer;
    v_hold_id := nullif(v_line->>'hold_id', '')::uuid;

    select price into v_price from public.products where id = v_product_id;

    insert into public.order_items (order_id, product_id, quantity, item_price)
    values (v_order_id, v_product_id, v_quantity, v_price);

    if v_hold_id is not null then
      perform public.confirm_reservation_hold(v_order_id, v_hold_id);
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'pickup_code', v_pickup_code,
    'fulfillment_window_start', v_window_start,
    'fulfillment_window_end', coalesce(v_window_end, v_window_start),
    'market_id', v_market_id,
    'subtotal', v_subtotal,
    'payment_method', p_payment_method
  );
end;
$$;

comment on function public.generate_pickup_code is
  'Phase 48: 6-char A-Z0-9 pickup token matching Nest checkout alphabet.';

comment on function public.create_storefront_checkout is
  'Phase 48: storefront checkout with pickup_code, fulfillment window, and market_id bridge.';

grant execute on function public.generate_pickup_code() to authenticated;
grant execute on function public.create_storefront_checkout(uuid, uuid, jsonb, text, text) to authenticated;
