-- Vendorly Phase 57 — Wholesale Order Acceptance & Inventory Commit
-- Run in Supabase SQL Editor after phase56_wholesale_order_drafts.sql.
--
-- Extends:
--   * wholesale_order_status — ORDER_ACCEPTED_BY_SELLER, ORDER_REJECTED_BY_SELLER
--   * wholesale_products.available_quantity — seller stock for reservation
--   * seller update RLS on wholesale_orders
-- Telemetry: ORDER_ACCEPTED_BY_SELLER, INVENTORY_RESERVATION_SUCCESS

-- ---------------------------------------------------------------------------
-- A. Status enum extensions
-- ---------------------------------------------------------------------------
alter type public.wholesale_order_status
  add value if not exists 'ORDER_ACCEPTED_BY_SELLER';
alter type public.wholesale_order_status
  add value if not exists 'ORDER_REJECTED_BY_SELLER';

-- ---------------------------------------------------------------------------
-- B. Wholesale product available stock
-- ---------------------------------------------------------------------------
alter table public.wholesale_products
  add column if not exists available_quantity integer;

update public.wholesale_products
set available_quantity = 0
where available_quantity is null;

alter table public.wholesale_products
  alter column available_quantity set default 0,
  alter column available_quantity set not null;

do $$
begin
  alter table public.wholesale_products
    add constraint wholesale_products_available_quantity_nonneg
    check (available_quantity >= 0);
exception
  when duplicate_object then null;
end $$;

comment on column public.wholesale_products.available_quantity is
  'Units available for wholesale reservation; decremented on ORDER_ACCEPTED_BY_SELLER.';

create index if not exists wholesale_products_vendor_available_idx
  on public.wholesale_products (vendor_id, available_quantity)
  where status = 'ACTIVE';

-- ---------------------------------------------------------------------------
-- C. Seller may update inbound wholesale order status
-- ---------------------------------------------------------------------------
drop policy if exists "B2B sellers update wholesale order status"
  on public.wholesale_orders;
create policy "B2B sellers update wholesale order status"
  on public.wholesale_orders for update
  using (
    exists (
      select 1 from public.vendors v
      where v.user_id = auth.uid()
        and v.id = seller_vendor_id
    )
  )
  with check (
    exists (
      select 1 from public.vendors v
      where v.user_id = auth.uid()
        and v.id = seller_vendor_id
    )
  );

-- Sellers mutate own SKU stock during reservation (service role also used by Nest).
drop policy if exists "Vendors update own wholesale product stock"
  on public.wholesale_products;
create policy "Vendors update own wholesale product stock"
  on public.wholesale_products for update
  using (
    exists (
      select 1 from public.vendors v
      where v.user_id = auth.uid() and v.id = vendor_id
    )
  )
  with check (
    exists (
      select 1 from public.vendors v
      where v.user_id = auth.uid() and v.id = vendor_id
    )
  );
