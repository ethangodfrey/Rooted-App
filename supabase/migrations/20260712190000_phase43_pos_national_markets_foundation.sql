-- Vendorly Phase 43: POS integration foundation + national farmers market registry.
--
-- Complements existing phase12 pos_* tables with streamlined OAuth ledger tables and a
-- dedicated PostGIS-backed national market aggregation table.
--
-- Apply after phase42b_backfill_orders_market_id.sql (and all prior phases).
-- Idempotent: safe to re-run in the Supabase SQL Editor.

begin;

-- ---------------------------------------------------------------------------
-- Geospatial extension
-- ---------------------------------------------------------------------------

create extension if not exists postgis;

-- ---------------------------------------------------------------------------
-- POS provider enum (lowercase slug — distinct from legacy "PosProvider" enum)
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.pos_integration_provider as enum ('square', 'toast', 'clover');
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- vendor_pos_connections — OAuth credential vault (vendor ↔ auth user)
-- ---------------------------------------------------------------------------

create table if not exists public.vendor_pos_connections (
  id                  uuid primary key default gen_random_uuid(),
  vendor_id           uuid not null references public.vendors (id) on delete cascade,
  user_id             uuid not null references public.users (id) on delete cascade,
  provider            public.pos_integration_provider not null,
  access_token        text,
  refresh_token       text,
  token_expires_at    timestamptz,
  provider_merchant_id text,
  provider_location_id text,
  oauth_state         text,
  status              text not null default 'pending'
    check (status in ('pending', 'active', 'error', 'expired', 'disconnected')),
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint vendor_pos_connections_vendor_provider_key
    unique (vendor_id, provider)
);

create index if not exists vendor_pos_connections_user_id_idx
  on public.vendor_pos_connections (user_id);

create index if not exists vendor_pos_connections_provider_status_idx
  on public.vendor_pos_connections (provider, status);

-- ---------------------------------------------------------------------------
-- pos_transactions — normalized sales ledger with platform fee split
-- ---------------------------------------------------------------------------

create table if not exists public.pos_transactions (
  id                      uuid primary key default gen_random_uuid(),
  vendor_id               uuid not null references public.vendors (id) on delete cascade,
  connection_id           uuid references public.vendor_pos_connections (id) on delete set null,
  provider                public.pos_integration_provider not null,
  external_transaction_id text not null,
  gross_amount            bigint not null check (gross_amount >= 0),
  platform_fee            bigint not null default 0 check (platform_fee >= 0),
  net_amount              bigint generated always as (gross_amount - platform_fee) stored,
  currency                text not null default 'USD',
  sold_at                 timestamptz not null,
  raw_payload             jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create unique index if not exists pos_transactions_provider_external_id_key
  on public.pos_transactions (provider, external_transaction_id);

create index if not exists pos_transactions_vendor_sold_at_idx
  on public.pos_transactions (vendor_id, sold_at desc);

create index if not exists pos_transactions_connection_id_idx
  on public.pos_transactions (connection_id);

-- ---------------------------------------------------------------------------
-- national_farmers_markets — aggregated USDA / national directory registry
-- ---------------------------------------------------------------------------

create table if not exists public.national_farmers_markets (
  id                  uuid primary key default gen_random_uuid(),
  market_name         text not null,
  street_address      text,
  city                text not null,
  state               text not null,
  zip_code            text,
  operating_schedules jsonb not null default '[]'::jsonb,
  latitude            numeric,
  longitude           numeric,
  coordinates         geography(point, 4326) generated always as (
    case
      when latitude is not null and longitude is not null
        then st_setsrid(st_makepoint(longitude::float8, latitude::float8), 4326)::geography
      else null
    end
  ) stored,
  source              text,
  external_id         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint national_farmers_markets_name_city_state_key
    unique (market_name, city, state)
);

create index if not exists national_farmers_markets_city_state_idx
  on public.national_farmers_markets (state, city);

create index if not exists national_farmers_markets_coordinates_gist_idx
  on public.national_farmers_markets using gist (coordinates);

-- ---------------------------------------------------------------------------
-- Row-level security (service-role writes; block anon/authenticated PostgREST)
-- ---------------------------------------------------------------------------

alter table public.vendor_pos_connections enable row level security;
alter table public.pos_transactions enable row level security;
alter table public.national_farmers_markets enable row level security;

-- Vendors may read their own POS connections (no token columns exposed via view).
create or replace view public.vendor_pos_connections_public as
select
  id,
  vendor_id,
  user_id,
  provider,
  provider_merchant_id,
  provider_location_id,
  status,
  token_expires_at,
  created_at,
  updated_at
from public.vendor_pos_connections;

grant select on public.vendor_pos_connections_public to authenticated;

commit;
