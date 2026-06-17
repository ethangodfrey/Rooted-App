-- Rooted Phase 14: structured farmers market details (AI agent fields)
-- Run after phase13_market_agent.sql

alter table public.events
  add column if not exists market_type text,
  add column if not exists hours_summary text,
  add column if not exists website_url text,
  add column if not exists extra_info text;

comment on column public.events.market_type is
  'farmers_market | flea_market | public_market | craft_market | mixed | unknown';
comment on column public.events.hours_summary is
  'Human-readable schedule, e.g. Saturdays 8am–1pm, May–October';
comment on column public.events.extra_info is
  'Seasonal notes, vendor types, payment info, etc.';
