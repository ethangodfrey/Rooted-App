-- Vendorly Phase 53 — Nationwide Directory Core & Geo-Spatial Routing
-- Run in Supabase SQL Editor after phase52_profile_specialties.sql.
--
-- Extends public.markets for nationwide directory routing:
--   * directory_slug (globally unique)
--   * operating_hours
--   * city/state + lat/lng indexes for bbox/haversine nearby queries
-- Vendor membership remains via vendor_market_registrations (phase42).

-- ---------------------------------------------------------------------------
-- A. Directory columns
-- ---------------------------------------------------------------------------
alter table public.markets
  add column if not exists directory_slug text;

alter table public.markets
  add column if not exists operating_hours text;

do $$
begin
  alter table public.markets
    add constraint markets_directory_slug_key unique (directory_slug);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

comment on column public.markets.directory_slug is
  'Nationwide unique slug for directory / deep-link routing';
comment on column public.markets.operating_hours is
  'Human-readable operating hours string for directory cards';

-- ---------------------------------------------------------------------------
-- B. Geo / city-state indexes
-- ---------------------------------------------------------------------------
create index if not exists markets_state_city_idx
  on public.markets (state, city);

create index if not exists markets_city_idx
  on public.markets (city);

create index if not exists markets_state_idx
  on public.markets (state);

create index if not exists markets_lat_lng_idx
  on public.markets (latitude, longitude)
  where latitude is not null and longitude is not null;

create index if not exists markets_directory_slug_idx
  on public.markets (directory_slug)
  where directory_slug is not null;

-- ---------------------------------------------------------------------------
-- C. Optional helper view for directory readiness telemetry
-- ---------------------------------------------------------------------------
create or replace view public.markets_directory_geo_ready as
select
  count(*) filter (where latitude is not null and longitude is not null) as geo_indexed,
  count(*) filter (where directory_slug is not null) as directory_slugged,
  count(*) filter (where state is not null and city is not null) as city_state_indexed,
  count(*) as total_markets
from public.markets
where status = 'ACTIVE';

comment on view public.markets_directory_geo_ready is
  'DIRECTORY_READY / GEO_INDEX_OK telemetry for nationwide markets table';
