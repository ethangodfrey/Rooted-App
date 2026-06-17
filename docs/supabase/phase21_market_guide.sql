-- Rooted Phase 21: AI market guide fields (what to look for, highlights/news)
-- Run after phase15_market_history.sql

alter table public.events
  add column if not exists what_to_look_for text,
  add column if not exists market_highlights text;

comment on column public.events.what_to_look_for is
  'AI-generated shopper guide: signature items, seasonal peaks, local specialties.';
comment on column public.events.market_highlights is
  'AI-generated community news, seasonal happenings, awards, or market updates.';
