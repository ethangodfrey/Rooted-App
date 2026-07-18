-- Rooted — Pre-Order & Pick-Up Orders Engine (2026-07-17)
-- Apply after phase9_orders.sql (+ phase7 products + phase51 profiles).
--
-- NOTE: public.orders / public.order_items already exist (phase9 marketplace
-- pipeline with Nest/Stripe checkout). This migration adds the PR #130
-- pre-order engine as:
--   public.preorder_orders      ↔ product "orders" table
--   public.preorder_order_items ↔ product "order_items" table
--
-- shopper_id / vendor_id reference public.profiles (id) — vendor|farmer hosts.

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'preorder_status') then
    create type public.preorder_status as enum (
      'PENDING_PICKUP',
      'COMPLETED',
      'CANCELLED'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'preorder_payment_method') then
    create type public.preorder_payment_method as enum (
      'STRIPE_ONLINE',
      'PAY_AT_HANDOFF'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'preorder_payment_status') then
    create type public.preorder_payment_status as enum (
      'PAID',
      'PENDING'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Product stock column (safe decrement target)
-- ---------------------------------------------------------------------------

alter table public.products
  add column if not exists stock integer not null default 0
    check (stock >= 0);

comment on column public.products.stock is
  'Pre-order engine sellable units. Decremented atomically when a pre-order is placed.';

-- Seed stock from presale availability when still zero
update public.products p
set stock = greatest(
  p.stock,
  coalesce((
    select sum(pea.available_quantity_presale)
    from public.product_event_availability pea
    where pea.product_id = p.id
  ), 0)
)
where p.stock = 0;

-- ---------------------------------------------------------------------------
-- 3. preorder_orders (PR "orders")
-- ---------------------------------------------------------------------------

create or replace function public.generate_preorder_pickup_code()
returns text
language plpgsql
as $$
declare
  candidate text;
  attempts int := 0;
begin
  loop
    attempts := attempts + 1;
    candidate := 'RT-' || lpad((floor(random() * 1000))::int::text, 3, '0');
    exit when not exists (
      select 1 from public.preorder_orders where pickup_code = candidate
    );
    if attempts > 25 then
      candidate := 'RT-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 3);
      exit;
    end if;
  end loop;
  return upper(candidate);
end;
$$;

create table if not exists public.preorder_orders (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid not null references public.profiles (id) on delete cascade,
  vendor_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid references public.events (id) on delete set null,
  status public.preorder_status not null default 'PENDING_PICKUP',
  payment_method public.preorder_payment_method not null,
  payment_status public.preorder_payment_status not null default 'PENDING',
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  pickup_code text not null default public.generate_preorder_pickup_code(),
  fulfillment_label text not null default 'PICKUP AT STOREFRONT',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint preorder_orders_pickup_code_format
    check (pickup_code ~ '^[A-Z0-9]{2}-[A-Z0-9]{3}$')
);

comment on table public.preorder_orders is
  'PR #130 pre-order / reservation engine (PENDING_PICKUP → COMPLETED).';

create unique index if not exists preorder_orders_pickup_code_uidx
  on public.preorder_orders (pickup_code);

create index if not exists preorder_orders_vendor_status_idx
  on public.preorder_orders (vendor_id, status, created_at desc);

create index if not exists preorder_orders_shopper_idx
  on public.preorder_orders (shopper_id, created_at desc);

create index if not exists preorder_orders_event_idx
  on public.preorder_orders (event_id)
  where event_id is not null;

alter table public.preorder_orders enable row level security;

drop policy if exists "Shoppers read own preorders" on public.preorder_orders;
create policy "Shoppers read own preorders"
  on public.preorder_orders for select
  to authenticated
  using (shopper_id = auth.uid() or vendor_id = auth.uid() or public.is_admin());

drop policy if exists "Shoppers create own preorders" on public.preorder_orders;
create policy "Shoppers create own preorders"
  on public.preorder_orders for insert
  to authenticated
  with check (shopper_id = auth.uid());

drop policy if exists "Vendors update own preorders" on public.preorder_orders;
create policy "Vendors update own preorders"
  on public.preorder_orders for update
  to authenticated
  using (vendor_id = auth.uid() or shopper_id = auth.uid() or public.is_admin())
  with check (vendor_id = auth.uid() or shopper_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. preorder_order_items (PR "order_items")
-- ---------------------------------------------------------------------------

create table if not exists public.preorder_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.preorder_orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);

create index if not exists preorder_order_items_order_idx
  on public.preorder_order_items (order_id);

create index if not exists preorder_order_items_product_idx
  on public.preorder_order_items (product_id);

alter table public.preorder_order_items enable row level security;

drop policy if exists "Participants read preorder items" on public.preorder_order_items;
create policy "Participants read preorder items"
  on public.preorder_order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.preorder_orders o
      where o.id = order_id
        and (o.shopper_id = auth.uid() or o.vendor_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "Shoppers insert preorder items" on public.preorder_order_items;
create policy "Shoppers insert preorder items"
  on public.preorder_order_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.preorder_orders o
      where o.id = order_id and o.shopper_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Safe stock decrement on item insert
-- ---------------------------------------------------------------------------

create or replace function public.preorder_items_decrement_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_id uuid;
begin
  update public.products
  set stock = stock - new.quantity,
      updated_at = now()
  where id = new.product_id
    and stock >= new.quantity
  returning id into updated_id;

  if updated_id is null then
    raise exception 'Insufficient stock for product % (requested %)', new.product_id, new.quantity;
  end if;

  return new;
end;
$$;

drop trigger if exists preorder_items_decrement_stock on public.preorder_order_items;
create trigger preorder_items_decrement_stock
  before insert on public.preorder_order_items
  for each row execute function public.preorder_items_decrement_stock();

-- Restore stock if a pending preorder is cancelled
create or replace function public.preorder_orders_restore_stock_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'CANCELLED'
     and old.status is distinct from 'CANCELLED' then
    update public.products p
    set stock = p.stock + oi.quantity,
        updated_at = now()
    from public.preorder_order_items oi
    where oi.order_id = new.id
      and oi.product_id = p.id;
  end if;
  return new;
end;
$$;

drop trigger if exists preorder_orders_restore_stock_on_cancel on public.preorder_orders;
create trigger preorder_orders_restore_stock_on_cancel
  after update of status on public.preorder_orders
  for each row execute function public.preorder_orders_restore_stock_on_cancel();

-- ---------------------------------------------------------------------------
-- 6. Atomic create RPC + handoff completion telemetry
-- ---------------------------------------------------------------------------

create or replace function public.create_preorder_pickup(
  p_vendor_user_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_payment_method public.preorder_payment_method,
  p_event_id uuid default null,
  p_fulfillment_label text default 'PICKUP AT STOREFRONT'
)
returns public.preorder_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shopper uuid := auth.uid();
  v_price numeric(12, 2);
  v_product_vendor uuid;
  v_order public.preorder_orders;
  v_pay_status public.preorder_payment_status;
begin
  if v_shopper is null then
    raise exception 'Not authenticated';
  end if;
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantity must be at least 1';
  end if;

  select p.price::numeric, v.user_id
  into v_price, v_product_vendor
  from public.products p
  join public.vendors v on v.id = p.vendor_id
  where p.id = p_product_id
    and p.status = 'active';

  if v_price is null then
    raise exception 'Product not found or inactive';
  end if;
  if v_product_vendor is distinct from p_vendor_user_id then
    raise exception 'Vendor mismatch for product';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_vendor_user_id and role in ('vendor', 'farmer')
  ) then
    raise exception 'Vendor profile must be vendor or farmer';
  end if;

  -- Ensure shopper profile row exists for FK (auth.uid = profiles.id)
  insert into public.profiles (id, role)
  values (v_shopper, 'shopper')
  on conflict (id) do nothing;

  v_pay_status := case
    when p_payment_method = 'STRIPE_ONLINE' then 'PAID'::public.preorder_payment_status
    else 'PENDING'::public.preorder_payment_status
  end;

  insert into public.preorder_orders (
    shopper_id,
    vendor_id,
    event_id,
    status,
    payment_method,
    payment_status,
    total_amount,
    fulfillment_label
  )
  values (
    v_shopper,
    p_vendor_user_id,
    p_event_id,
    'PENDING_PICKUP',
    p_payment_method,
    v_pay_status,
    round(v_price * p_quantity, 2),
    coalesce(nullif(trim(p_fulfillment_label), ''), 'PICKUP AT STOREFRONT')
  )
  returning * into v_order;

  insert into public.preorder_order_items (order_id, product_id, quantity, unit_price)
  values (v_order.id, p_product_id, p_quantity, v_price);

  return v_order;
end;
$$;

revoke all on function public.create_preorder_pickup(uuid, uuid, integer, public.preorder_payment_method, uuid, text) from public;
grant execute on function public.create_preorder_pickup(uuid, uuid, integer, public.preorder_payment_method, uuid, text) to authenticated;

create or replace function public.complete_preorder_handoff(
  p_order_id uuid,
  p_pickup_code text
)
returns public.preorder_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.preorder_orders;
  v_vendor_row_id uuid;
begin
  select * into v_order
  from public.preorder_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Pre-order not found';
  end if;
  if v_order.vendor_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Only the vendor can complete this hand-off';
  end if;
  if v_order.status <> 'PENDING_PICKUP' then
    raise exception 'Pre-order is not awaiting pickup';
  end if;
  if upper(trim(p_pickup_code)) is distinct from v_order.pickup_code then
    raise exception 'Pickup code does not match';
  end if;

  update public.preorder_orders
  set
    status = 'COMPLETED',
    payment_status = case
      when payment_method = 'PAY_AT_HANDOFF' then 'PAID'::public.preorder_payment_status
      else payment_status
    end,
    completed_at = now()
  where id = p_order_id
  returning * into v_order;

  select id into v_vendor_row_id
  from public.vendors
  where user_id = v_order.vendor_id
  limit 1;

  if v_vendor_row_id is not null then
    insert into public.inventory_transactions (
      vendor_id,
      product_id,
      event_id,
      transaction_type,
      quantity_change,
      source,
      notes
    )
    select
      v_vendor_row_id,
      oi.product_id,
      v_order.event_id,
      'sale_digital',
      -oi.quantity,
      'preorder:' || v_order.id::text,
      'Hand-off completed · ' || v_order.pickup_code || ' · volume ' || v_order.total_amount::text
    from public.preorder_order_items oi
    where oi.order_id = v_order.id;
  end if;

  return v_order;
end;
$$;

revoke all on function public.complete_preorder_handoff(uuid, text) from public;
grant execute on function public.complete_preorder_handoff(uuid, text) to authenticated;
