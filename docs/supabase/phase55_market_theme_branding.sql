-- Vendorly Phase 55 — Market theme branding for tenant isolation injection
-- Run in Supabase SQL Editor after phase53_nationwide_directory_geo.sql.
--
-- Adds optional localized branding fields on public.markets so edge tenant
-- layouts can inject CSS variables and regional description banners from the
-- active directory slug (subdomain).

alter table public.markets
  add column if not exists description text;

alter table public.markets
  add column if not exists theme_primary_color text;

alter table public.markets
  add column if not exists theme_accent_color text;

comment on column public.markets.description is
  'Regional description banner copy for tenant theme injection';
comment on column public.markets.theme_primary_color is
  'Optional CSS primary color for subdomain tenant layouts';
comment on column public.markets.theme_accent_color is
  'Optional CSS accent color for subdomain tenant layouts';
