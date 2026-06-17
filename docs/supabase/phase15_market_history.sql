-- Rooted Phase 15: market history + local timezone for correct event times
-- Run after phase14_market_details.sql

alter table public.events
  add column if not exists market_history text,
  add column if not exists timezone text;

comment on column public.events.market_history is
  'Background, founding story, and community role of the market';
comment on column public.events.timezone is
  'IANA timezone for local market hours, e.g. America/Chicago';
