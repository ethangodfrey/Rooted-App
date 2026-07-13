-- Vendorly Phase 44c: RLS for harvester + POS analytics layer.
-- Apply after phase44_national_harvester_pos_analytics.sql.
-- Idempotent: safe to re-run in the Supabase SQL Editor.

begin;

-- ---------------------------------------------------------------------------
-- market_sales_snapshots — vendor-scoped reads; admin manage; service writes
-- ---------------------------------------------------------------------------

alter table public.market_sales_snapshots enable row level security;

drop policy if exists market_sales_snapshots_vendor_select on public.market_sales_snapshots;
create policy market_sales_snapshots_vendor_select
  on public.market_sales_snapshots
  for select
  to authenticated
  using (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
    or market_id in (select public.vendor_approved_market_ids())
  );

drop policy if exists market_sales_snapshots_admin_all on public.market_sales_snapshots;
create policy market_sales_snapshots_admin_all
  on public.market_sales_snapshots
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Extended markets — tenant-scoped read for active tenant markets
-- ---------------------------------------------------------------------------

drop policy if exists markets_tenant_read on public.markets;
create policy markets_tenant_read
  on public.markets
  for select
  to authenticated
  using (
    tenant_id is not null
    and tenant_id in (
      select id from public.tenants where status = 'ACTIVE'
    )
  );

-- ---------------------------------------------------------------------------
-- vendor_pos_connections — tenant-scoped select (additive to phase43c policy)
-- ---------------------------------------------------------------------------

drop policy if exists vendor_pos_connections_tenant_select on public.vendor_pos_connections;
create policy vendor_pos_connections_tenant_select
  on public.vendor_pos_connections
  for select
  to authenticated
  using (
    tenant_id is not null
    and user_id = auth.uid()
    and vendor_id in (select id from public.vendors where user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- pos_connections (legacy) — vendor read own rows when user_id populated
-- Tokens remain in pos_credentials; no anon/authenticated credential access.
-- ---------------------------------------------------------------------------

drop policy if exists pos_connections_vendor_select on public.pos_connections;
create policy pos_connections_vendor_select
  on public.pos_connections
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and vendor_id in (select id from public.vendors where user_id = auth.uid())
  );

drop policy if exists pos_connections_admin_all on public.pos_connections;
create policy pos_connections_admin_all
  on public.pos_connections
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

commit;
