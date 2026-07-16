-- National Farmers Market Directory (additive).
--
-- Complements phase43 `national_farmers_markets` with a seed-friendly directory
-- table that matches the farmers_markets_directory ingest shape (writable `geom`).
--
-- Apply after phase46 / phase47 (PostGIS already enabled by phase43).
-- Idempotent: safe to re-run in the Supabase SQL Editor.

begin;

create extension if not exists postgis;

-- ---------------------------------------------------------------------------
-- farmers_markets — national directory rows with geospatial points
-- ---------------------------------------------------------------------------

create table if not exists public.farmers_markets (
  id               uuid primary key default gen_random_uuid(),
  name             varchar(255) not null,
  street_address   varchar(255),
  city             varchar(100) not null,
  state            varchar(50) not null,
  zip_code         varchar(20),
  latitude         numeric(10, 8),
  longitude        numeric(11, 8),
  geom             geography(Point, 4326),
  operating_hours  text,
  season_start     varchar(50),
  season_end       varchar(50),
  website_url      varchar(255),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.farmers_markets is
  'National farmers market directory with PostGIS geography for radius queries. Complements national_farmers_markets.';

-- Keep geom in sync when lat/lng are provided without an explicit WKT point.
create or replace function public.farmers_markets_sync_geom()
returns trigger
language plpgsql
as $$
begin
  if new.geom is null
     and new.latitude is not null
     and new.longitude is not null then
    new.geom := st_setsrid(
      st_makepoint(new.longitude::float8, new.latitude::float8),
      4326
    )::geography;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists farmers_markets_sync_geom_trg on public.farmers_markets;
create trigger farmers_markets_sync_geom_trg
  before insert or update of latitude, longitude, geom
  on public.farmers_markets
  for each row
  execute function public.farmers_markets_sync_geom();

create index if not exists idx_farmers_markets_geom
  on public.farmers_markets using gist (geom);

create index if not exists farmers_markets_state_city_idx
  on public.farmers_markets (state, city);

-- Upsert conflict target for scripts/seed-markets.ts
alter table public.farmers_markets
  drop constraint if exists farmers_markets_name_city_state_key;
alter table public.farmers_markets
  add constraint farmers_markets_name_city_state_key
  unique (name, city, state);

alter table public.farmers_markets enable row level security;

drop policy if exists farmers_markets_public_read on public.farmers_markets;
create policy farmers_markets_public_read
  on public.farmers_markets
  for select
  to anon, authenticated
  using (true);

-- Service-role bypasses RLS for seed/ingest writes.

commit;
