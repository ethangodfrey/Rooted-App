-- Vendorly Marketplace — Phase 32: multi-tenant routing
-- Run in Supabase SQL Editor after phase31_leftovers_search.sql
--
-- Adds tenant marketplace instances with custom-domain + subdomain routing,
-- plus tenant-scoped POS integration metadata (public keys only).

-- ---------------------------------------------------------------------------
-- A. Tenant status enum
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.tenant_status as enum ('ACTIVE', 'SUSPENDED', 'ARCHIVED');
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- B. Tenants
-- ---------------------------------------------------------------------------
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  display_name text not null,
  status public.tenant_status not null default 'ACTIVE',
  event_id uuid references public.events (id) on delete set null,
  logo_url text,
  favicon_url text,
  primary_color text,
  accent_color text,
  tagline text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_slug_key unique (slug)
);

create index if not exists tenants_status_idx on public.tenants (status);
create index if not exists tenants_event_id_idx on public.tenants (event_id);

-- ---------------------------------------------------------------------------
-- C. Tenant domains (custom domains + explicit subdomain aliases)
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  host text not null,
  is_primary boolean not null default false,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  constraint tenant_domains_host_key unique (host)
);

create index if not exists tenant_domains_tenant_id_idx on public.tenant_domains (tenant_id);
create index if not exists tenant_domains_tenant_primary_idx on public.tenant_domains (tenant_id, is_primary);

-- ---------------------------------------------------------------------------
-- D. Tenant POS integrations (public metadata only — no credential vault)
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_pos_integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  provider text not null check (provider in ('SQUARE', 'TOAST', 'CLOVER')),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'ACTIVE', 'ERROR', 'EXPIRED', 'DISCONNECTED')),
  provider_app_id text,
  provider_location_id text,
  webhook_endpoint text,
  metadata jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_pos_integrations_tenant_provider_key unique (tenant_id, provider)
);

create index if not exists tenant_pos_integrations_tenant_active_idx
  on public.tenant_pos_integrations (tenant_id, active);
create index if not exists tenant_pos_integrations_tenant_provider_active_idx
  on public.tenant_pos_integrations (tenant_id, provider, active);

-- ---------------------------------------------------------------------------
-- E. RLS — public read for active tenants; admin write
-- ---------------------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.tenant_domains enable row level security;
alter table public.tenant_pos_integrations enable row level security;

drop policy if exists "Public read active tenants" on public.tenants;
create policy "Public read active tenants"
  on public.tenants for select using (status = 'ACTIVE');

drop policy if exists "Admins manage tenants" on public.tenants;
create policy "Admins manage tenants"
  on public.tenants for all using (public.is_admin());

drop policy if exists "Public read verified tenant domains" on public.tenant_domains;
create policy "Public read verified tenant domains"
  on public.tenant_domains for select using (
    verified = true
    and tenant_id in (select id from public.tenants where status = 'ACTIVE')
  );

drop policy if exists "Admins manage tenant domains" on public.tenant_domains;
create policy "Admins manage tenant domains"
  on public.tenant_domains for all using (public.is_admin());

drop policy if exists "Public read active tenant POS integrations" on public.tenant_pos_integrations;
create policy "Public read active tenant POS integrations"
  on public.tenant_pos_integrations for select using (
    active = true
    and tenant_id in (select id from public.tenants where status = 'ACTIVE')
  );

drop policy if exists "Admins manage tenant POS integrations" on public.tenant_pos_integrations;
create policy "Admins manage tenant POS integrations"
  on public.tenant_pos_integrations for all using (public.is_admin());
