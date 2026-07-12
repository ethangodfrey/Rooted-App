-- Vendorly Phase 43c: RLS policies, realtime, and nearby national markets RPC.
-- Apply after phase43_pos_national_markets_foundation.sql.
-- Idempotent: safe to re-run in the Supabase SQL Editor.

begin;

-- ---------------------------------------------------------------------------
-- Vendor-scoped read access for POS ledger (authenticated PostgREST + Realtime)
-- ---------------------------------------------------------------------------

drop policy if exists vendor_pos_transactions_select_own on public.pos_transactions;
create policy vendor_pos_transactions_select_own
  on public.pos_transactions
  for select
  to authenticated
  using (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
  );

drop policy if exists vendor_pos_connections_select_own on public.vendor_pos_connections;
create policy vendor_pos_connections_select_own
  on public.vendor_pos_connections
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and vendor_id in (select id from public.vendors where user_id = auth.uid())
  );

-- Public read for national market directory (aggregated USDA data)
drop policy if exists national_farmers_markets_public_read on public.national_farmers_markets;
create policy national_farmers_markets_public_read
  on public.national_farmers_markets
  for select
  to anon, authenticated
  using (true);

-- Realtime streaming for live POS sales on vendor dashboards
do $$ begin
  alter publication supabase_realtime add table public.pos_transactions;
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- find_nearby_national_farmers_markets — PostGIS proximity search
-- ---------------------------------------------------------------------------

create or replace function public.find_nearby_national_farmers_markets(
  p_lat double precision,
  p_lng double precision,
  p_radius_miles double precision default 25,
  p_limit integer default 50
)
returns table (
  id uuid,
  market_name text,
  street_address text,
  city text,
  state text,
  zip_code text,
  operating_schedules jsonb,
  latitude numeric,
  longitude numeric,
  distance_miles double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with origin as (
    select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as geog
  )
  select
    m.id,
    m.market_name,
    m.street_address,
    m.city,
    m.state,
    m.zip_code,
    m.operating_schedules,
    m.latitude,
    m.longitude,
    (st_distance(m.coordinates, o.geog) / 1609.344)::double precision as distance_miles
  from public.national_farmers_markets m
  cross join origin o
  where m.coordinates is not null
    and st_dwithin(
      m.coordinates,
      o.geog,
      greatest(p_radius_miles, 0.1) * 1609.344
    )
  order by st_distance(m.coordinates, o.geog) asc
  limit greatest(least(p_limit, 200), 1);
$$;

grant execute on function public.find_nearby_national_farmers_markets(
  double precision,
  double precision,
  double precision,
  integer
) to anon, authenticated;

commit;
