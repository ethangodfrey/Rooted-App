-- Rooted — Multi-POS Analytics & Business Telemetry (2026-07-17)
-- Apply after phase51_network_and_stickers.sql (+ 20260717_preorders_pickup.sql recommended).
--
-- Vendor-scoped POS connection registry + aggregated external sales metrics.
-- Distinct from tenant_pos_integrations (multi-tenant public metadata) and
-- Nest-backed pos_connections (credential vault / sync workers).

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'pos_analytics_provider') then
    create type public.pos_analytics_provider as enum (
      'SQUARE',
      'TOAST',
      'STRIPE_NATIVE'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'pos_sales_source') then
    create type public.pos_sales_source as enum (
      'SQUARE',
      'TOAST',
      'STRIPE_NATIVE',
      'CASH_HANDOFF'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. pos_integrations
-- ---------------------------------------------------------------------------

create table if not exists public.pos_integrations (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.profiles (id) on delete cascade,
  provider public.pos_analytics_provider not null,
  credentials_connected boolean not null default false,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pos_integrations_vendor_provider_key unique (vendor_id, provider)
);

comment on table public.pos_integrations is
  'Vendor POS provider connection state for the analytics sync center (Square / Toast / Stripe).';

create index if not exists pos_integrations_vendor_idx
  on public.pos_integrations (vendor_id);

create or replace function public.set_pos_integrations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pos_integrations_set_updated_at on public.pos_integrations;
create trigger pos_integrations_set_updated_at
  before update on public.pos_integrations
  for each row execute function public.set_pos_integrations_updated_at();

alter table public.pos_integrations enable row level security;

drop policy if exists "Vendors manage own pos integrations" on public.pos_integrations;
create policy "Vendors manage own pos integrations"
  on public.pos_integrations for all
  to authenticated
  using (vendor_id = auth.uid() or public.is_admin())
  with check (vendor_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. historical_sales_metrics
-- ---------------------------------------------------------------------------

create table if not exists public.historical_sales_metrics (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.profiles (id) on delete cascade,
  source public.pos_sales_source not null,
  amount numeric(12, 2) not null check (amount >= 0),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.historical_sales_metrics is
  'Aggregated external / platform sales rows for multi-POS telemetry dashboards.';

create index if not exists historical_sales_metrics_vendor_recorded_idx
  on public.historical_sales_metrics (vendor_id, recorded_at desc);

create index if not exists historical_sales_metrics_vendor_source_idx
  on public.historical_sales_metrics (vendor_id, source);

alter table public.historical_sales_metrics enable row level security;

drop policy if exists "Vendors read own sales metrics" on public.historical_sales_metrics;
create policy "Vendors read own sales metrics"
  on public.historical_sales_metrics for select
  to authenticated
  using (vendor_id = auth.uid() or public.is_admin());

drop policy if exists "Vendors insert own sales metrics" on public.historical_sales_metrics;
create policy "Vendors insert own sales metrics"
  on public.historical_sales_metrics for insert
  to authenticated
  with check (vendor_id = auth.uid() or public.is_admin());

drop policy if exists "Admins manage sales metrics" on public.historical_sales_metrics;
create policy "Admins manage sales metrics"
  on public.historical_sales_metrics for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. Ensure integration rows exist for known providers (idempotent helper)
-- ---------------------------------------------------------------------------

create or replace function public.ensure_pos_integration_rows(p_vendor_id uuid)
returns setof public.pos_integrations
language plpgsql
security definer
set search_path = public
as $$
declare
  provider_name public.pos_analytics_provider;
begin
  if p_vendor_id is null or p_vendor_id <> auth.uid() then
    if not public.is_admin() then
      raise exception 'Not authorized';
    end if;
  end if;

  foreach provider_name in array array[
    'SQUARE'::public.pos_analytics_provider,
    'TOAST'::public.pos_analytics_provider,
    'STRIPE_NATIVE'::public.pos_analytics_provider
  ]
  loop
    insert into public.pos_integrations (vendor_id, provider)
    values (p_vendor_id, provider_name)
    on conflict (vendor_id, provider) do nothing;
  end loop;

  return query
    select *
    from public.pos_integrations
    where vendor_id = p_vendor_id
    order by provider;
end;
$$;

revoke all on function public.ensure_pos_integration_rows(uuid) from public;
grant execute on function public.ensure_pos_integration_rows(uuid) to authenticated;
