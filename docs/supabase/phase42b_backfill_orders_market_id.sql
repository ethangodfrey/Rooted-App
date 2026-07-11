-- Vendorly Phase 42b — backfill orders.market_id from legacy event_id bridge
-- Run in Supabase SQL Editor AFTER phase42_regional_markets.sql.
--
-- Safe, idempotent backfill: only sets market_id when null and a matching
-- active markets.event_id row exists. Does not overwrite existing market_id.

update public.orders o
set
  market_id = m.id,
  updated_at = now()
from public.markets m
where o.market_id is null
  and o.event_id is not null
  and m.event_id = o.event_id
  and m.status = 'ACTIVE';

-- Optional verification (run manually):
-- select count(*) as linked_orders from public.orders where market_id is not null;
-- select count(*) as pending_backfill from public.orders where market_id is null and event_id is not null;
