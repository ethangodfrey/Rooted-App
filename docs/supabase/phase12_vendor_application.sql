-- Rooted Phase 12: vendor application fields for admin review
-- Run in Supabase SQL Editor after phase1_auth.sql.

alter table public.vendors
  add column if not exists sell_city text,
  add column if not exists sell_state text,
  add column if not exists product_summary text,
  add column if not exists selling_channels text[] default '{}',
  add column if not exists primary_market text,
  add column if not exists application_submitted_at timestamptz;
