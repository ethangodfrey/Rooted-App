-- Vendorly Phase 44: National harvester + POS analytics aggregation layer.
--
-- Extends existing phase42 `markets`, phase12 `pos_connections`, and phase43
-- `vendor_pos_connections` / `national_farmers_markets` with:
--   • Geo + schedule fields on regional markets
--   • Tenant routing columns on POS connection tables
--   • `market_sales_snapshots` daily rollup table for webhook/sync analytics
--
-- Apply after phase43c_pos_data_rls.sql (and all prior phases).
-- Idempotent: safe to re-run in the Supabase SQL Editor.
-- DO NOT apply until architecture review is approved.

begin;

-- ---------------------------------------------------------------------------
-- Geospatial extension (no-op if phase43 already applied)
-- ---------------------------------------------------------------------------

create extension if not exists postgis;

-- ---------------------------------------------------------------------------
-- A. Regional markets — extend master inventory for harvester + spatial queries
--     (phase42 created base table; phase44 adds schedules + geography bridge)
-- ---------------------------------------------------------------------------

alter table public.markets
  add column if not exists zip_code text,
  add column if not exists operating_schedules jsonb not null default '[]'::jsonb,
  add column if not exists national_farmers_market_id uuid
    references public.national_farmers_markets (id) on delete set null,
  add column if not exists tenant_id uuid
    references public.tenants (id) on delete set null;

comment on column public.markets.operating_schedules is
  'JSON array of schedule windows, e.g. [{"day":"Saturday","open":"08:00","close":"13:00"}].';

comment on column public.markets.national_farmers_market_id is
  'Optional link to USDA/national registry row after harvester ingest (phase43).';

-- Generated geography from lat/lng (SRID 4326, longitude-first POINT)
do $$ begin
  alter table public.markets
    add column coordinates geography(point, 4326) generated always as (
      case
        when latitude is not null and longitude is not null
          then st_setsrid(st_makepoint(longitude::float8, latitude::float8), 4326)::geography
        else null
      end
    ) stored;
exception
  when duplicate_column then null;
end $$;

create index if not exists markets_state_idx
  on public.markets (state);

create index if not exists markets_state_city_idx
  on public.markets (state, city);

create index if not exists markets_tenant_id_idx
  on public.markets (tenant_id);

create index if not exists markets_national_farmers_market_id_idx
  on public.markets (national_farmers_market_id);

create index if not exists markets_coordinates_gist_idx
  on public.markets using gist (coordinates);

-- ---------------------------------------------------------------------------
-- B. POS connections — tenant routing on legacy + phase43 credential vaults
-- ---------------------------------------------------------------------------

-- Legacy Nest/Prisma stack (phase12b). Tokens live in pos_credentials (encrypted).
alter table public.pos_connections
  add column if not exists tenant_id uuid references public.tenants (id) on delete set null,
  add column if not exists user_id uuid references public.users (id) on delete set null;

create index if not exists pos_connections_tenant_id_idx
  on public.pos_connections (tenant_id);

create index if not exists pos_connections_tenant_provider_status_idx
  on public.pos_connections (tenant_id, provider, status);

-- Streamlined OAuth vault (phase43) — used by tenant-web edge routes.
alter table public.vendor_pos_connections
  add column if not exists tenant_id uuid references public.tenants (id) on delete set null,
  add column if not exists legacy_pos_connection_id uuid
    references public.pos_connections (id) on delete set null;

create index if not exists vendor_pos_connections_tenant_id_idx
  on public.vendor_pos_connections (tenant_id);

create unique index if not exists vendor_pos_connections_legacy_pos_connection_id_key
  on public.vendor_pos_connections (legacy_pos_connection_id)
  where legacy_pos_connection_id is not null;

-- Safe read surface — never exposes access_token / refresh_token columns.
create or replace view public.pos_connections_public as
select
  vpc.id,
  vpc.vendor_id,
  vpc.user_id,
  vpc.tenant_id,
  vpc.provider,
  vpc.provider_merchant_id,
  vpc.provider_location_id,
  vpc.status,
  vpc.token_expires_at,
  vpc.legacy_pos_connection_id,
  vpc.created_at,
  vpc.updated_at
from public.vendor_pos_connections vpc;

grant select on public.pos_connections_public to authenticated;

-- ---------------------------------------------------------------------------
-- C. market_sales_snapshots — daily POS analytics rollups per vendor + market
-- ---------------------------------------------------------------------------

create table if not exists public.market_sales_snapshots (
  id                          uuid primary key default gen_random_uuid(),
  market_id                   uuid not null references public.markets (id) on delete cascade,
  vendor_id                   uuid not null references public.vendors (id) on delete cascade,
  tenant_id                   uuid references public.tenants (id) on delete set null,
  pos_connection_id           uuid references public.vendor_pos_connections (id) on delete set null,
  legacy_pos_connection_id    uuid references public.pos_connections (id) on delete set null,
  snapshot_date               date not null,
  gross_volume_cents          bigint not null default 0 check (gross_volume_cents >= 0),
  net_volume_cents            bigint not null default 0 check (net_volume_cents >= 0),
  platform_fee_cents          bigint not null default 0 check (platform_fee_cents >= 0),
  transaction_count           integer not null default 0 check (transaction_count >= 0),
  velocity_index              numeric(12, 4),
  payment_method_distribution jsonb not null default '{}'::jsonb,
  tender_breakdown            jsonb not null default '{}'::jsonb,
  currency                    text not null default 'USD',
  source                      text not null default 'webhook'
    check (source in ('webhook', 'sync', 'backfill', 'manual')),
  metadata                    jsonb not null default '{}'::jsonb,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  constraint market_sales_snapshots_market_vendor_date_key
    unique (market_id, vendor_id, snapshot_date)
);

comment on table public.market_sales_snapshots is
  'Daily aggregated POS sales velocity and payment mix per vendor at a regional market.';

comment on column public.market_sales_snapshots.velocity_index is
  'Normalized transactions-per-hour (or similar) for trend charts.';

comment on column public.market_sales_snapshots.payment_method_distribution is
  'Fractional mix, e.g. {"card":0.72,"cash":0.18,"other":0.10}.';

comment on column public.market_sales_snapshots.tender_breakdown is
  'Absolute counts, e.g. {"card":42,"cash":9,"digital_wallet":3}.';

create index if not exists market_sales_snapshots_market_date_idx
  on public.market_sales_snapshots (market_id, snapshot_date desc);

create index if not exists market_sales_snapshots_vendor_date_idx
  on public.market_sales_snapshots (vendor_id, snapshot_date desc);

create index if not exists market_sales_snapshots_tenant_date_idx
  on public.market_sales_snapshots (tenant_id, snapshot_date desc);

-- ---------------------------------------------------------------------------
-- D. Helper RPCs — spatial market search + snapshot upsert from pos_transactions
-- ---------------------------------------------------------------------------

create or replace function public.find_nearby_markets(
  p_lat double precision,
  p_lng double precision,
  p_radius_miles double precision default 25,
  p_limit integer default 50
)
returns table (
  id uuid,
  name text,
  city text,
  state text,
  location_address text,
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
    m.name,
    m.city,
    m.state,
    m.location_address,
    m.operating_schedules,
    m.latitude,
    m.longitude,
    (st_distance(m.coordinates, o.geog) / 1609.344)::double precision as distance_miles
  from public.markets m
  cross join origin o
  where m.status = 'ACTIVE'
    and m.coordinates is not null
    and st_dwithin(
      m.coordinates,
      o.geog,
      greatest(p_radius_miles, 0.1) * 1609.344
    )
  order by st_distance(m.coordinates, o.geog) asc
  limit greatest(least(p_limit, 200), 1);
$$;

grant execute on function public.find_nearby_markets(
  double precision,
  double precision,
  double precision,
  integer
) to anon, authenticated;

-- Upsert a daily snapshot from normalized pos_transactions rows (service/cron use).
create or replace function public.upsert_market_sales_snapshot(
  p_market_id uuid,
  p_vendor_id uuid,
  p_snapshot_date date,
  p_tenant_id uuid default null,
  p_pos_connection_id uuid default null,
  p_source text default 'sync'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_gross bigint;
  v_net bigint;
  v_fees bigint;
  v_count integer;
  v_velocity numeric(12, 4);
begin
  select
    coalesce(sum(gross_amount), 0),
    coalesce(sum(net_amount), 0),
    coalesce(sum(platform_fee), 0),
    count(*)::integer
  into v_gross, v_net, v_fees, v_count
  from public.pos_transactions
  where vendor_id = p_vendor_id
    and sold_at >= p_snapshot_date::timestamptz
    and sold_at < (p_snapshot_date + 1)::timestamptz;

  v_velocity := case
    when v_count > 0 then round((v_count::numeric / 24.0), 4)
    else 0
  end;

  insert into public.market_sales_snapshots (
    market_id,
    vendor_id,
    tenant_id,
    pos_connection_id,
    snapshot_date,
    gross_volume_cents,
    net_volume_cents,
    platform_fee_cents,
    transaction_count,
    velocity_index,
    source,
    updated_at
  )
  values (
    p_market_id,
    p_vendor_id,
    p_tenant_id,
    p_pos_connection_id,
    p_snapshot_date,
    v_gross,
    v_net,
    v_fees,
    v_count,
    v_velocity,
    coalesce(p_source, 'sync'),
    now()
  )
  on conflict (market_id, vendor_id, snapshot_date)
  do update set
    tenant_id = excluded.tenant_id,
    pos_connection_id = coalesce(excluded.pos_connection_id, market_sales_snapshots.pos_connection_id),
    gross_volume_cents = excluded.gross_volume_cents,
    net_volume_cents = excluded.net_volume_cents,
    platform_fee_cents = excluded.platform_fee_cents,
    transaction_count = excluded.transaction_count,
    velocity_index = excluded.velocity_index,
    source = excluded.source,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.upsert_market_sales_snapshot is
  'Rebuild one vendor/market/day rollup from pos_transactions. Payment mix filled by webhook workers.';

commit;
