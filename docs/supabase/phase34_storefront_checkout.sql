-- Vendorly Phase 34 — Storefront cart checkout (multi-line + dual-channel inventory)
-- Run in Supabase SQL Editor after phase33_explore_hybrid_feed.sql.
--
-- Validates presale AND in-person (POS) stock before checkout, creates a single
-- multi-line order, and confirms inventory holds atomically.

-- ---------------------------------------------------------------------------
-- RPC: validate cart lines against live dual-channel inventory
-- ---------------------------------------------------------------------------
create or replace function public.validate_storefront_cart(
  p_vendor_id uuid,
  p_event_id  uuid,
  p_items     jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_line      jsonb;
  v_product_id uuid;
  v_quantity  integer;
  v_presale   integer;
  v_inperson  integer;
  v_reserved  integer;
  v_price     integer;
  v_name      text;
  v_issues    jsonb := '[]'::jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('valid', false, 'error', 'Cart is empty');
  end if;

  for v_line in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_line->>'product_id')::uuid;
    v_quantity := (v_line->>'quantity')::integer;

    if v_product_id is null or v_quantity is null or v_quantity < 1 then
      return jsonb_build_object('valid', false, 'error', 'Invalid cart line');
    end if;

    select p.name, p.price, pea.available_quantity_presale, pea.available_quantity_inperson,
           pea.reserved_quantity
      into v_name, v_price, v_presale, v_inperson, v_reserved
    from public.products p
    left join public.product_event_availability pea
      on pea.product_id = p.id and pea.event_id = p_event_id
    where p.id = v_product_id
      and p.vendor_id = p_vendor_id
      and p.status = 'active'
      and p.reserve_enabled = true;

    if v_name is null then
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'product_id', v_product_id,
        'error', 'Product unavailable for reservation'
      ));
      continue;
    end if;

    if v_presale is null then
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'product_id', v_product_id,
        'product_name', v_name,
        'error', 'Not listed for this event'
      ));
      continue;
    end if;

    if (v_presale - coalesce(v_reserved, 0)) < v_quantity then
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'product_id', v_product_id,
        'product_name', v_name,
        'error', 'Insufficient presale inventory',
        'available_presale', greatest(v_presale - coalesce(v_reserved, 0), 0)
      ));
    end if;

    if coalesce(v_inperson, 0) < v_quantity then
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'product_id', v_product_id,
        'product_name', v_name,
        'error', 'Insufficient POS in-person stock',
        'available_inperson', coalesce(v_inperson, 0)
      ));
    end if;
  end loop;

  if jsonb_array_length(v_issues) > 0 then
    return jsonb_build_object('valid', false, 'issues', v_issues);
  end if;

  return jsonb_build_object('valid', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: create multi-line storefront checkout order (hold-aware)
-- ---------------------------------------------------------------------------
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
begin
  select id into v_shopper_id from public.shoppers where user_id = auth.uid();
  if v_shopper_id is null then
    return jsonb_build_object('success', false, 'error', 'Only shoppers can checkout');
  end if;

  v_validation := public.validate_storefront_cart(p_vendor_id, p_event_id, p_items);
  if not (v_validation->>'valid')::boolean then
    return jsonb_build_object('success', false, 'error', coalesce(v_validation->>'error', 'Validation failed'), 'issues', v_validation->'issues');
  end if;

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
    shopper_id, vendor_id, event_id, order_status, payment_status,
    subtotal, tax, total, notes
  ) values (
    v_shopper_id,
    p_vendor_id,
    p_event_id,
    'submitted',
    case when p_payment_method = 'stripe' then 'stripe_pending' else 'unpaid' end,
    v_subtotal,
    0,
    v_subtotal,
    p_notes
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
    'subtotal', v_subtotal,
    'payment_method', p_payment_method
  );
end;
$$;

grant execute on function public.validate_storefront_cart(uuid, uuid, jsonb) to authenticated;
grant execute on function public.create_storefront_checkout(uuid, uuid, jsonb, text, text) to authenticated;

comment on function public.validate_storefront_cart is
  'Pre-checkout validation against presale + in-person (POS) inventory channels.';

comment on function public.create_storefront_checkout is
  'Atomic multi-line storefront order creation with hold confirmation.';
