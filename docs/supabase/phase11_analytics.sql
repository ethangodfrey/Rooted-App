-- Rooted Phase 11: inventory transactions + analytics
-- Run in Supabase SQL Editor after phase9_orders.sql.
--
-- inventory_transactions is the source of truth for units sold (digital
-- reservations fulfilled + manual in-person sales). analytics_snapshots is
-- reserved for future precomputed daily rollups; the app computes metrics live
-- for the MVP.

create table if not exists public.inventory_transactions (
  id                uuid primary key default gen_random_uuid(),
  vendor_id         uuid not null references public.vendors (id) on delete cascade,
  product_id        uuid not null references public.products (id) on delete cascade,
  event_id          uuid references public.events (id) on delete set null,
  transaction_type  text not null
    check (transaction_type in ('sale_digital', 'sale_manual', 'adjustment', 'restock')),
  quantity_change   integer not null,
  source            text,
  notes             text,
  created_at        timestamptz not null default now()
);

create index if not exists inv_tx_vendor_idx on public.inventory_transactions (vendor_id);
create index if not exists inv_tx_product_idx on public.inventory_transactions (product_id);

alter table public.inventory_transactions enable row level security;

create policy "Vendors manage own inventory transactions"
  on public.inventory_transactions for all
  using (vendor_id in (select id from public.vendors where user_id = auth.uid()))
  with check (vendor_id in (select id from public.vendors where user_id = auth.uid()));

create table if not exists public.analytics_snapshots (
  id              uuid primary key default gen_random_uuid(),
  vendor_id       uuid not null references public.vendors (id) on delete cascade,
  date            date not null,
  revenue_total   integer default 0,
  orders_total    integer default 0,
  product_views   integer default 0,
  conversions     integer default 0,
  event_sales     integer default 0,
  inperson_sales  integer default 0,
  saved_count     integer default 0,
  follower_count  integer default 0,
  unique (vendor_id, date)
);

alter table public.analytics_snapshots enable row level security;

create policy "Vendors read own analytics snapshots"
  on public.analytics_snapshots for select
  using (vendor_id in (select id from public.vendors where user_id = auth.uid()));

-- On fulfillment, record a digital sale (negative quantity_change) per item.
create or replace function public.handle_order_fulfilled()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.order_status = 'fulfilled'
     and old.order_status is distinct from 'fulfilled' then
    insert into public.inventory_transactions (
      vendor_id, product_id, event_id, transaction_type, quantity_change, source
    )
    select new.vendor_id, oi.product_id, new.event_id, 'sale_digital',
           -oi.quantity, 'order:' || new.id
    from public.order_items oi
    where oi.order_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_order_fulfilled on public.orders;
create trigger on_order_fulfilled
  after update on public.orders
  for each row execute function public.handle_order_fulfilled();
