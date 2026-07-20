-- Phase 79 — Fleet Logistics & B2B Fulfillment (Phase 5)
-- Apply after phase78 (financial_transactions + vendor_balances).
--
-- Adds:
--   delivery_routes (farmer dispatch runs)
--   delivery_stops (procurement dropoffs on a route)
--   farmer_balances (internal farmer wallets for wholesale settlement)
--   b2b_procurement_requests.escrow_transaction_id / deposit_cents

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'delivery_route_status'
  ) then
    create type public.delivery_route_status as enum (
      'SCHEDULED',
      'IN_TRANSIT',
      'COMPLETED'
    );
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'delivery_stop_status'
  ) then
    create type public.delivery_stop_status as enum (
      'PENDING',
      'DELIVERED',
      'FAILED'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. delivery_routes
-- ---------------------------------------------------------------------------

create table if not exists public.delivery_routes (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers (id) on delete cascade,
  dispatch_date date not null,
  status public.delivery_route_status not null
    default 'SCHEDULED'::public.delivery_route_status,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.delivery_routes is
  'Farmer fleet dispatch runs (LOGISTICS_ENGINE_INITIALIZED): SCHEDULED|IN_TRANSIT|COMPLETED.';

create index if not exists delivery_routes_farmer_idx
  on public.delivery_routes (farmer_id, dispatch_date desc);

create index if not exists delivery_routes_status_idx
  on public.delivery_routes (status, dispatch_date desc);

alter table public.delivery_routes enable row level security;

drop policy if exists "Farmers and admins read delivery routes" on public.delivery_routes;
create policy "Farmers and admins read delivery routes"
  on public.delivery_routes for select
  to authenticated
  using (
    public.is_admin()
    or farmer_id in (select id from public.farmers where user_id = auth.uid())
  );

drop policy if exists "Farmers manage own delivery routes" on public.delivery_routes;
create policy "Farmers manage own delivery routes"
  on public.delivery_routes for all
  to authenticated
  using (
    public.is_admin()
    or farmer_id in (select id from public.farmers where user_id = auth.uid())
  )
  with check (
    public.is_admin()
    or farmer_id in (select id from public.farmers where user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3. delivery_stops — map ACCEPTED procurement requests onto a route
-- ---------------------------------------------------------------------------

create table if not exists public.delivery_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.delivery_routes (id) on delete cascade,
  procurement_request_id uuid not null
    references public.b2b_procurement_requests (id) on delete restrict,
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  dropoff_order integer not null
    check (dropoff_order >= 1),
  status public.delivery_stop_status not null
    default 'PENDING'::public.delivery_stop_status,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_stops_route_procurement_uidx
    unique (route_id, procurement_request_id),
  constraint delivery_stops_route_order_uidx
    unique (route_id, dropoff_order)
);

comment on table public.delivery_stops is
  'B2B procurement dropoffs on a farmer delivery route (FLEET_TRACKING_ACTIVE).';

create index if not exists delivery_stops_route_idx
  on public.delivery_stops (route_id, dropoff_order);

create index if not exists delivery_stops_procurement_idx
  on public.delivery_stops (procurement_request_id);

create index if not exists delivery_stops_vendor_idx
  on public.delivery_stops (vendor_id, status);

alter table public.delivery_stops enable row level security;

drop policy if exists "Parties read delivery stops" on public.delivery_stops;
create policy "Parties read delivery stops"
  on public.delivery_stops for select
  to authenticated
  using (
    public.is_admin()
    or vendor_id in (select id from public.vendors where user_id = auth.uid())
    or route_id in (
      select id from public.delivery_routes
      where farmer_id in (select id from public.farmers where user_id = auth.uid())
    )
  );

drop policy if exists "Farmers manage delivery stops on own routes" on public.delivery_stops;
create policy "Farmers manage delivery stops on own routes"
  on public.delivery_stops for all
  to authenticated
  using (
    public.is_admin()
    or route_id in (
      select id from public.delivery_routes
      where farmer_id in (select id from public.farmers where user_id = auth.uid())
    )
  )
  with check (
    public.is_admin()
    or route_id in (
      select id from public.delivery_routes
      where farmer_id in (select id from public.farmers where user_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 4. farmer_balances — wholesale settlement wallets
-- ---------------------------------------------------------------------------

create table if not exists public.farmer_balances (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null unique references public.farmers (id) on delete cascade,
  available_cents integer not null default 0
    check (available_cents >= 0),
  escrow_held_cents integer not null default 0
    check (escrow_held_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.farmer_balances is
  'Farmer wholesale wallets: available funds and escrow holds for B2B fulfillment.';

create index if not exists farmer_balances_farmer_idx
  on public.farmer_balances (farmer_id);

alter table public.farmer_balances enable row level security;

drop policy if exists "Farmers read own balances" on public.farmer_balances;
create policy "Farmers read own balances"
  on public.farmer_balances for select
  to authenticated
  using (
    farmer_id in (select id from public.farmers where user_id = auth.uid())
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- 5. Procurement escrow columns (wholesale hold → release on dropoff)
-- ---------------------------------------------------------------------------

alter table public.b2b_procurement_requests
  add column if not exists deposit_cents integer
    check (deposit_cents is null or deposit_cents >= 0);

alter table public.b2b_procurement_requests
  add column if not exists escrow_transaction_id uuid;

comment on column public.b2b_procurement_requests.deposit_cents is
  'Wholesale amount in integer cents held in escrow for this ACCEPTED request.';

comment on column public.b2b_procurement_requests.escrow_transaction_id is
  'financial_transactions row held until delivery_stops confirmDropoff.';

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'b2b_procurement_requests'
      and constraint_name = 'b2b_procurement_escrow_fk'
  ) then
    alter table public.b2b_procurement_requests
      add constraint b2b_procurement_escrow_fk
      foreign key (escrow_transaction_id)
      references public.financial_transactions (id)
      on delete set null;
  end if;
end $$;
