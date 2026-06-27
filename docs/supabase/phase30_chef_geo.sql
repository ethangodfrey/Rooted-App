-- Vendorly Phase 30 — Chef hyperlocal geo (mirror of phase24 vendors)
-- Run in Supabase SQL Editor after phase29_search_refresh_cron.sql.
--
-- phase24 gave events / vendors / leftovers a generated `geography(Point,4326)`
-- column + GiST index + `find_nearby_*` RPC, but chefs were intentionally left
-- out (they only had a `home_base_coordinates` point, no lat/lng/geog and no
-- nearby RPC). phase27 added chef street-address text fields for parity. This
-- migration finishes chef geo so chefs are geo-ranked exactly like vendors:
--   * adds nullable latitude/longitude + generated geog + GiST index to chefs
--   * adds find_nearby_chefs(...) mirroring find_nearby_vendors (approved only)
--   * rebuilds the phase28 search_index matview so chef rows carry geog (they
--     previously had a hard-coded null), recreating its indexes and the
--     search_all / refresh_search_index functions dropped by the cascade.
--
-- Idempotent: `add column if not exists`, `create index if not exists`,
-- `create or replace function`, and the matview is dropped + recreated.

-- ---------------------------------------------------------------------------
-- A. Chefs — generated geography column + spatial index (mirror phase24 vendors)
-- ---------------------------------------------------------------------------
alter table public.chefs
  add column if not exists latitude  numeric,
  add column if not exists longitude numeric;

alter table public.chefs
  add column if not exists geog geography(Point, 4326)
    generated always as (
      case
        when latitude is not null and longitude is not null
          then st_setsrid(st_makepoint(longitude::float8, latitude::float8), 4326)::geography
        else null
      end
    ) stored;

create index if not exists chefs_geog_gist
  on public.chefs using gist (geog);

-- ---------------------------------------------------------------------------
-- B. RPC: nearby approved chefs ordered by distance (mirror find_nearby_vendors)
--    (returns rows only for chefs with populated coordinates)
-- ---------------------------------------------------------------------------
create or replace function public.find_nearby_chefs(
  p_lat        double precision,
  p_lng        double precision,
  p_radius_km  double precision default 80,
  p_limit      integer default 50,
  p_search     text default null
)
returns table (
  id                  uuid,
  display_name        text,
  cuisine_specialties text[],
  home_base_city      text,
  home_base_state     text,
  latitude            numeric,
  longitude           numeric,
  distance_km         double precision
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
    c.id,
    c.display_name,
    c.cuisine_specialties,
    c.home_base_city,
    c.home_base_state,
    c.latitude,
    c.longitude,
    st_distance(c.geog, origin.g) / 1000.0 as distance_km
  from public.chefs c, origin
  where p_lat is not null
    and p_lng is not null
    and c.geog is not null
    and c.approval_status = 'approved'
    and (p_search is null or btrim(p_search) = '' or c.display_name ilike '%' || btrim(p_search) || '%')
    and st_dwithin(c.geog, origin.g, greatest(coalesce(p_radius_km, 80), 0) * 1000.0)
  order by c.geog <-> origin.g
  limit greatest(coalesce(p_limit, 50), 1);
$$;

grant execute on function public.find_nearby_chefs(double precision, double precision, double precision, integer, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- C. Rebuild search_index so chef rows carry geog (was hard-coded null in
--    phase28). Dropping with cascade also drops the search_all function (SQL
--    language → depends on the matview); we recreate it + indexes + the refresh
--    helper below so the surface is unchanged apart from chef geo.
-- ---------------------------------------------------------------------------
drop materialized view if exists public.search_index cascade;

create materialized view public.search_index as
  -- Vendors (publicly visible = approved)
  select
    'vendor'::text                                   as entity_type,
    v.id                                             as entity_id,
    v.business_name                                  as title,
    coalesce(v.vendor_type, v.category)              as subtitle,
    coalesce(v.business_description, v.product_summary) as description,
    v.sell_city                                      as city,
    v.sell_state                                     as state,
    coalesce(v.logo_url, v.banner_url)               as image_url,
    v.geog                                           as geog,
    v.created_at                                     as created_at,
    jsonb_build_object(
      'category', v.category,
      'vendor_type', v.vendor_type
    )                                                as metadata,
    (
      setweight(to_tsvector('english', coalesce(v.business_name, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(v.vendor_type, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(v.category, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(v.sell_city, '')), 'C') ||
      setweight(to_tsvector('english', coalesce(v.business_description, '')), 'D')
    )                                                as search_tsv
  from public.vendors v
  where v.approval_status = 'approved'

  union all

  -- Chefs (publicly visible = approved). Now carries geog (phase30).
  select
    'chef'::text                                     as entity_type,
    c.id                                             as entity_id,
    c.display_name                                   as title,
    array_to_string(coalesce(c.cuisine_specialties, '{}'), ', ') as subtitle,
    c.bio                                            as description,
    c.home_base_city                                 as city,
    c.home_base_state                                as state,
    coalesce(c.profile_photo_url, c.banner_url)      as image_url,
    c.geog                                           as geog,
    c.created_at                                     as created_at,
    jsonb_build_object(
      'home_base_city', c.home_base_city,
      'home_base_state', c.home_base_state,
      'cuisine_specialties', c.cuisine_specialties
    )                                                as metadata,
    (
      setweight(to_tsvector('english', coalesce(c.display_name, '')), 'A') ||
      setweight(to_tsvector('english', array_to_string(coalesce(c.cuisine_specialties, '{}'), ' ')), 'B') ||
      setweight(to_tsvector('english', coalesce(c.home_base_city, '')), 'C') ||
      setweight(to_tsvector('english', coalesce(c.bio, '')), 'D')
    )                                                as search_tsv
  from public.chefs c
  where c.approval_status = 'approved'

  union all

  -- Events (publicly visible = public)
  select
    'event'::text                                    as entity_type,
    e.id                                             as entity_id,
    e.name                                           as title,
    e.market_type                                    as subtitle,
    e.description                                    as description,
    e.city                                           as city,
    e.state                                          as state,
    e.banner_url                                     as image_url,
    e.geog                                           as geog,
    e.created_at                                     as created_at,
    jsonb_build_object(
      'start_datetime', e.start_datetime,
      'event_status', e.event_status,
      'market_type', e.market_type
    )                                                as metadata,
    (
      setweight(to_tsvector('english', coalesce(e.name, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(e.market_type, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(e.city, '')), 'C') ||
      setweight(to_tsvector('english', coalesce(e.description, '')), 'D')
    )                                                as search_tsv
  from public.events e
  where e.visibility_status = 'public'

  union all

  -- Products (publicly visible = active). Location/geo inherited from vendor.
  select
    'product'::text                                  as entity_type,
    p.id                                             as entity_id,
    p.name                                           as title,
    v.business_name                                  as subtitle,
    p.description                                    as description,
    v.sell_city                                      as city,
    v.sell_state                                     as state,
    case when p.media_urls is not null and array_length(p.media_urls, 1) > 0
      then p.media_urls[1] else null end             as image_url,
    v.geog                                           as geog,
    p.created_at                                     as created_at,
    jsonb_build_object(
      'price', p.price,
      'vendor_id', p.vendor_id,
      'vendor_name', v.business_name,
      'category', p.category
    )                                                as metadata,
    (
      setweight(to_tsvector('english', coalesce(p.name, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(v.business_name, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(p.category, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(p.description, '')), 'D')
    )                                                as search_tsv
  from public.products p
  left join public.vendors v on v.id = p.vendor_id
  where p.status = 'active';

-- Indexes (recreated after the rebuild)
create unique index if not exists search_index_pk
  on public.search_index (entity_type, entity_id);
create index if not exists search_index_tsv_gin
  on public.search_index using gin (search_tsv);
create index if not exists search_index_geog_gist
  on public.search_index using gist (geog);
create index if not exists search_index_entity_type
  on public.search_index (entity_type);

-- ---------------------------------------------------------------------------
-- D. Recreate search_all (dropped by the cascade) — unchanged from phase28.
-- ---------------------------------------------------------------------------
create or replace function public.search_all(
  p_query        text default null,
  p_lat          double precision default null,
  p_lng          double precision default null,
  p_limit        integer default 50,
  p_entity_types text[] default null
)
returns table (
  entity_type text,
  entity_id   uuid,
  title       text,
  subtitle    text,
  description text,
  city        text,
  state       text,
  image_url   text,
  latitude    double precision,
  longitude   double precision,
  distance_km double precision,
  rank        real,
  created_at  timestamptz,
  metadata    jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select
      nullif(btrim(coalesce(p_query, '')), '') as q,
      case
        when p_lat is not null and p_lng is not null
          then st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
        else null
      end as origin
  ),
  scored as (
    select
      s.entity_type,
      s.entity_id,
      s.title,
      s.subtitle,
      s.description,
      s.city,
      s.state,
      s.image_url,
      s.metadata,
      s.created_at,
      case when s.geog is not null then st_y(s.geog::geometry) else null end as latitude,
      case when s.geog is not null then st_x(s.geog::geometry) else null end as longitude,
      case
        when p.origin is not null and s.geog is not null
          then st_distance(s.geog, p.origin) / 1000.0
        else null
      end as distance_km,
      case
        when p.q is not null then ts_rank(s.search_tsv, websearch_to_tsquery('english', p.q))
        else 0
      end as rank,
      p.q as q
    from public.search_index s
    cross join params p
    where (p_entity_types is null or s.entity_type = any (p_entity_types))
      and (
        p.q is null
        or s.search_tsv @@ websearch_to_tsquery('english', p.q)
        or s.title ilike '%' || p.q || '%'
      )
  )
  select
    entity_type,
    entity_id,
    title,
    subtitle,
    description,
    city,
    state,
    image_url,
    latitude,
    longitude,
    distance_km,
    rank,
    created_at,
    metadata
  from scored
  order by
    (rank * 10.0)
      + (case when distance_km is not null then 1.0 / (1.0 + distance_km / 5.0) else 0 end) desc,
    distance_km asc nulls last,
    created_at desc
  limit greatest(coalesce(p_limit, 50), 1);
$$;

-- ---------------------------------------------------------------------------
-- E. Recreate refresh helper (harmless even though plpgsql survives the cascade).
-- ---------------------------------------------------------------------------
create or replace function public.refresh_search_index()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.search_index;
exception
  when others then
    refresh materialized view public.search_index;
end;
$$;

-- ---------------------------------------------------------------------------
-- F. Grants — public read parity (anon + authenticated), matching phase28.
-- ---------------------------------------------------------------------------
grant execute on function public.search_all(text, double precision, double precision, integer, text[]) to anon, authenticated;
grant execute on function public.refresh_search_index() to authenticated;
