-- Rooted — Spatial Proximity Bounding (2026-07-18)
-- Apply after phase24_geo_search.sql (+ phase51 farmers / phase52 specialties).
--
-- Viewport RPC for Explore map: businesses (vendors + farmers) whose
-- latitude/longitude fall inside the map bounding box. Optional specialty
-- overlap filter against profiles.vendor_specialties / farmer_specialties.

-- ---------------------------------------------------------------------------
-- 1. PostGIS
-- ---------------------------------------------------------------------------

create extension if not exists postgis;

-- ---------------------------------------------------------------------------
-- 2. Farmers geo columns (vendors already have lat/lng/geog from phase24)
-- ---------------------------------------------------------------------------

alter table public.farmers
  add column if not exists latitude numeric,
  add column if not exists longitude numeric;

alter table public.farmers
  add column if not exists geog geography(Point, 4326)
    generated always as (
      case
        when latitude is not null and longitude is not null
          then st_setsrid(st_makepoint(longitude::float8, latitude::float8), 4326)::geography
        else null
      end
    ) stored;

create index if not exists farmers_geog_gist
  on public.farmers using gist (geog);

create index if not exists farmers_lat_lng_idx
  on public.farmers (latitude, longitude)
  where latitude is not null and longitude is not null;

create index if not exists vendors_lat_lng_idx
  on public.vendors (latitude, longitude)
  where latitude is not null and longitude is not null;

-- ---------------------------------------------------------------------------
-- 3. RPC: get_tracked_businesses_in_bounds
-- ---------------------------------------------------------------------------

create or replace function public.get_tracked_businesses_in_bounds(
  min_lat numeric,
  max_lat numeric,
  min_lng numeric,
  max_lng numeric,
  specialty_filter text[] default null
)
returns table (
  profile_id uuid,
  role text,
  display_name text,
  vendor_specialties text[],
  farmer_specialties text[],
  shopper_zip_code text,
  latitude numeric,
  longitude numeric,
  business_row_id uuid,
  entity_kind text,
  sell_city text,
  sell_state text
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select st_makeenvelope(
      least(min_lng, max_lng)::float8,
      least(min_lat, max_lat)::float8,
      greatest(min_lng, max_lng)::float8,
      greatest(min_lat, max_lat)::float8,
      4326
    ) as geom
  ),
  vendor_rows as (
    select
      p.id as profile_id,
      p.role::text as role,
      coalesce(nullif(btrim(v.business_name), ''), 'VENDOR') as display_name,
      coalesce(p.vendor_specialties, '{}'::text[]) as vendor_specialties,
      coalesce(p.farmer_specialties, '{}'::text[]) as farmer_specialties,
      p.shopper_zip_code,
      v.latitude,
      v.longitude,
      v.id as business_row_id,
      'vendor'::text as entity_kind,
      v.sell_city,
      v.sell_state
    from public.vendors v
    join public.profiles p on p.id = v.user_id
    cross join bounds b
    where v.approval_status = 'approved'
      and v.latitude is not null
      and v.longitude is not null
      and v.geog is not null
      and v.geog::geometry && b.geom
      and v.latitude >= least(min_lat, max_lat)
      and v.latitude <= greatest(min_lat, max_lat)
      and v.longitude >= least(min_lng, max_lng)
      and v.longitude <= greatest(min_lng, max_lng)
      and (
        specialty_filter is null
        or cardinality(specialty_filter) = 0
        or p.vendor_specialties && specialty_filter
        or p.farmer_specialties && specialty_filter
      )
  ),
  farmer_rows as (
    select
      p.id as profile_id,
      p.role::text as role,
      coalesce(nullif(btrim(f.farm_name), ''), 'FARMER') as display_name,
      coalesce(p.vendor_specialties, '{}'::text[]) as vendor_specialties,
      coalesce(p.farmer_specialties, '{}'::text[]) as farmer_specialties,
      p.shopper_zip_code,
      f.latitude,
      f.longitude,
      f.id as business_row_id,
      'farmer'::text as entity_kind,
      f.sell_city,
      f.sell_state
    from public.farmers f
    join public.profiles p on p.id = f.user_id
    cross join bounds b
    where f.approval_status = 'approved'
      and f.latitude is not null
      and f.longitude is not null
      and f.geog is not null
      and f.geog::geometry && b.geom
      and f.latitude >= least(min_lat, max_lat)
      and f.latitude <= greatest(min_lat, max_lat)
      and f.longitude >= least(min_lng, max_lng)
      and f.longitude <= greatest(min_lng, max_lng)
      and (
        specialty_filter is null
        or cardinality(specialty_filter) = 0
        or p.vendor_specialties && specialty_filter
        or p.farmer_specialties && specialty_filter
      )
  )
  select * from vendor_rows
  union all
  select * from farmer_rows
  order by display_name asc
  limit 500;
$$;

comment on function public.get_tracked_businesses_in_bounds(numeric, numeric, numeric, numeric, text[]) is
  'Explore map: approved vendors/farmers inside viewport N/S/E/W bounds with optional specialty overlap.';

revoke all on function public.get_tracked_businesses_in_bounds(numeric, numeric, numeric, numeric, text[]) from public;
grant execute on function public.get_tracked_businesses_in_bounds(numeric, numeric, numeric, numeric, text[]) to anon, authenticated;
