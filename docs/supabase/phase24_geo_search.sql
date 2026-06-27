-- Vendorly Phase 24 — Hyperlocal geo-ranked discovery (PostGIS)
-- Run in Supabase SQL Editor after phase23c_verification_docs.sql.
--
-- Implements enhanced-plan section 6 (Hyperlocal). Adds PostGIS, generated
-- geography columns + GiST indexes for fast distance ranking, and SECURITY
-- DEFINER RPCs callable via supabase.rpc() that return rows ordered by distance
-- from a caller-supplied (lat, lng). Functions enforce the same visibility
-- filters used elsewhere (events.visibility_status = 'public',
-- vendors.approval_status = 'approved', active leftover listings) and are
-- resilient to null coordinates.
--
-- Idempotent: `create extension if not exists`, `add column if not exists`,
-- `create index if not exists`, `create or replace function`.

-- ---------------------------------------------------------------------------
-- A. Extension
-- ---------------------------------------------------------------------------
create extension if not exists postgis;

-- ---------------------------------------------------------------------------
-- B. Generated geography columns + spatial indexes
-- ---------------------------------------------------------------------------

-- Events already store NOT NULL latitude/longitude (numeric).
alter table public.events
  add column if not exists geog geography(Point, 4326)
    generated always as (
      st_setsrid(st_makepoint(longitude::float8, latitude::float8), 4326)::geography
    ) stored;

create index if not exists events_geog_gist
  on public.events using gist (geog);

-- Vendors have no coordinates yet (only sell_city/sell_state). Add nullable
-- lat/lng so they can be geo-ranked once populated; geography is null until set.
alter table public.vendors
  add column if not exists latitude numeric,
  add column if not exists longitude numeric;

alter table public.vendors
  add column if not exists geog geography(Point, 4326)
    generated always as (
      case
        when latitude is not null and longitude is not null
          then st_setsrid(st_makepoint(longitude::float8, latitude::float8), 4326)::geography
        else null
      end
    ) stored;

create index if not exists vendors_geog_gist
  on public.vendors using gist (geog);

-- Leftover listings store nullable pickup_latitude/pickup_longitude.
alter table public.leftover_listings
  add column if not exists pickup_geog geography(Point, 4326)
    generated always as (
      case
        when pickup_latitude is not null and pickup_longitude is not null
          then st_setsrid(st_makepoint(pickup_longitude::float8, pickup_latitude::float8), 4326)::geography
        else null
      end
    ) stored;

create index if not exists leftover_listings_geog_gist
  on public.leftover_listings using gist (pickup_geog);

-- ---------------------------------------------------------------------------
-- C. RPC: nearby public events ordered by distance
-- ---------------------------------------------------------------------------
create or replace function public.find_nearby_events(
  p_lat        double precision,
  p_lng        double precision,
  p_radius_km  double precision default 80,
  p_limit      integer default 50,
  p_search     text default null
)
returns table (
  id             uuid,
  name           text,
  description    text,
  banner_url     text,
  start_datetime timestamptz,
  end_datetime   timestamptz,
  address        text,
  city           text,
  state          text,
  latitude       numeric,
  longitude      numeric,
  event_status   text,
  distance_km    double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with origin as (
    select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g
  )
  select
    e.id,
    e.name,
    e.description,
    e.banner_url,
    e.start_datetime,
    e.end_datetime,
    e.address,
    e.city,
    e.state,
    e.latitude,
    e.longitude,
    e.event_status,
    st_distance(e.geog, origin.g) / 1000.0 as distance_km
  from public.events e, origin
  where p_lat is not null
    and p_lng is not null
    and e.geog is not null
    and e.visibility_status = 'public'
    and (p_search is null or btrim(p_search) = '' or e.name ilike '%' || btrim(p_search) || '%')
    and st_dwithin(e.geog, origin.g, greatest(coalesce(p_radius_km, 80), 0) * 1000.0)
  order by e.geog <-> origin.g
  limit greatest(coalesce(p_limit, 50), 1);
$$;

-- ---------------------------------------------------------------------------
-- D. RPC: nearby approved vendors ordered by distance
--    (returns rows only for vendors with populated coordinates)
-- ---------------------------------------------------------------------------
create or replace function public.find_nearby_vendors(
  p_lat        double precision,
  p_lng        double precision,
  p_radius_km  double precision default 80,
  p_limit      integer default 50,
  p_search     text default null
)
returns table (
  id            uuid,
  business_name text,
  category      text,
  vendor_type   text,
  sell_city     text,
  sell_state    text,
  latitude      numeric,
  longitude     numeric,
  distance_km   double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with origin as (
    select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g
  )
  select
    v.id,
    v.business_name,
    v.category,
    v.vendor_type,
    v.sell_city,
    v.sell_state,
    v.latitude,
    v.longitude,
    st_distance(v.geog, origin.g) / 1000.0 as distance_km
  from public.vendors v, origin
  where p_lat is not null
    and p_lng is not null
    and v.geog is not null
    and v.approval_status = 'approved'
    and (p_search is null or btrim(p_search) = '' or v.business_name ilike '%' || btrim(p_search) || '%')
    and st_dwithin(v.geog, origin.g, greatest(coalesce(p_radius_km, 80), 0) * 1000.0)
  order by v.geog <-> origin.g
  limit greatest(coalesce(p_limit, 50), 1);
$$;

-- ---------------------------------------------------------------------------
-- E. RPC: nearby active leftover listings ordered by distance
-- ---------------------------------------------------------------------------
create or replace function public.find_nearby_leftovers(
  p_lat        double precision,
  p_lng        double precision,
  p_radius_km  double precision default 80,
  p_limit      integer default 50
)
returns table (
  id                 uuid,
  vendor_id          uuid,
  title              text,
  description        text,
  media_url          text,
  price_cents        integer,
  quantity_remaining integer,
  expires_at         timestamptz,
  pickup_city        text,
  pickup_state       text,
  pickup_latitude    numeric,
  pickup_longitude   numeric,
  distance_km        double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with origin as (
    select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g
  )
  select
    l.id,
    l.vendor_id,
    l.title,
    l.description,
    l.media_url,
    l.price_cents,
    l.quantity_remaining,
    l.expires_at,
    l.pickup_city,
    l.pickup_state,
    l.pickup_latitude,
    l.pickup_longitude,
    st_distance(l.pickup_geog, origin.g) / 1000.0 as distance_km
  from public.leftover_listings l
  join public.vendors v on v.id = l.vendor_id and v.approval_status = 'approved'
  cross join origin
  where p_lat is not null
    and p_lng is not null
    and l.pickup_geog is not null
    and l.status = 'active'
    and l.quantity_remaining > 0
    and l.expires_at > now()
    and l.available_from <= now()
    and st_dwithin(l.pickup_geog, origin.g, greatest(coalesce(p_radius_km, 80), 0) * 1000.0)
  order by l.pickup_geog <-> origin.g
  limit greatest(coalesce(p_limit, 50), 1);
$$;

-- ---------------------------------------------------------------------------
-- F. Grants — public read parity (anon + authenticated), matching existing
--    public-read RLS on events / approved vendors / active leftovers.
-- ---------------------------------------------------------------------------
grant execute on function public.find_nearby_events(double precision, double precision, double precision, integer, text) to anon, authenticated;
grant execute on function public.find_nearby_vendors(double precision, double precision, double precision, integer, text) to anon, authenticated;
grant execute on function public.find_nearby_leftovers(double precision, double precision, double precision, integer) to anon, authenticated;
