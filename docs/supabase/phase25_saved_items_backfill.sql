-- Vendorly Phase 25: backfill legacy shopper favorites into unified saved_items
--
-- Mobile + web have migrated to the unified `saved_items` table (phase22), but
-- earlier favorites were stored in the legacy arrays `shoppers.saved_vendors`
-- and `shoppers.saved_events`. This script copies those into `saved_items`.
--
-- Safe to run multiple times: each insert is guarded by NOT EXISTS, and only
-- references rows that still exist (FK-safe). The legacy arrays are intentionally
-- left intact so any remaining legacy code paths keep working.

-- ---------------------------------------------------------------------------
-- A. Saved vendors  ->  saved_items(item_type = 'vendor')
-- ---------------------------------------------------------------------------
insert into public.saved_items (customer_id, item_type, vendor_id)
select s.user_id, 'vendor', v.vendor_id
from public.shoppers s
cross join lateral unnest(coalesce(s.saved_vendors, '{}')) as v(vendor_id)
where v.vendor_id is not null
  and exists (select 1 from public.vendors ve where ve.id = v.vendor_id)
  and not exists (
    select 1
    from public.saved_items si
    where si.customer_id = s.user_id
      and si.item_type = 'vendor'
      and si.vendor_id = v.vendor_id
  );

-- ---------------------------------------------------------------------------
-- B. Saved events  ->  saved_items(item_type = 'event')
-- ---------------------------------------------------------------------------
insert into public.saved_items (customer_id, item_type, event_id)
select s.user_id, 'event', e.event_id
from public.shoppers s
cross join lateral unnest(coalesce(s.saved_events, '{}')) as e(event_id)
where e.event_id is not null
  and exists (select 1 from public.events ev where ev.id = e.event_id)
  and not exists (
    select 1
    from public.saved_items si
    where si.customer_id = s.user_id
      and si.item_type = 'event'
      and si.event_id = e.event_id
  );

-- ---------------------------------------------------------------------------
-- Verification (optional): compare counts
--   select 'legacy_vendor_favorites' as metric,
--          coalesce(sum(array_length(saved_vendors, 1)), 0) as count
--   from public.shoppers
--   union all
--   select 'saved_items_vendor', count(*) from public.saved_items where item_type = 'vendor';
-- ---------------------------------------------------------------------------
