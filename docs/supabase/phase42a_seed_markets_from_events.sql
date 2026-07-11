-- Vendorly Phase 42a — seed markets.event_id from legacy public events
-- Run in Supabase SQL Editor AFTER phase42_regional_markets.sql
-- and BEFORE phase42b_backfill_orders_market_id.sql.
--
-- Idempotent: skips events that already have a markets row. Creates a default
-- US region when missing. Adjust region slug/name for your rollout.

insert into public.regions (name, slug, timezone, status)
values ('United States', 'us', 'America/Denver', 'ACTIVE')
on conflict (slug) do nothing;

insert into public.markets (
  region_id,
  name,
  slug,
  location_address,
  city,
  state,
  latitude,
  longitude,
  event_id,
  status
)
select
  r.id,
  e.name,
  left(
    lower(regexp_replace(trim(e.name), '[^a-zA-Z0-9]+', '-', 'g'))
    || '-'
    || left(replace(e.id::text, '-', ''), 8),
    120
  ),
  e.address,
  e.city,
  e.state,
  e.latitude,
  e.longitude,
  e.id,
  'ACTIVE'::public.market_status
from public.events e
cross join lateral (
  select id from public.regions where slug = 'us' limit 1
) r
where e.visibility_status = 'public'
  and not exists (
    select 1 from public.markets m where m.event_id = e.id
  );

-- Preflight for phase42b (run manually):
-- select count(*) as markets_with_event_bridge from public.markets where event_id is not null;
-- select count(*) as orders_awaiting_backfill
--   from public.orders where market_id is null and event_id is not null;
