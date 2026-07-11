-- Vendorly Phase 29 — Auto-refresh the unified search index (pg_cron)
-- Run in Supabase SQL Editor after phase28_search_index.sql.
--
-- phase28 created the `search_index` MATERIALIZED VIEW + `refresh_search_index()`
-- but left the refresh manual ("pg_cron is intentionally NOT configured here").
-- This migration enables pg_cron (supported on Supabase) and schedules the
-- refresh on a 10-minute cadence so newly approved vendors/chefs, public events,
-- active products, and leftover listings show up in unified search without a
-- manual refresh.
--
-- Cadence rationale: REFRESH MATERIALIZED VIEW CONCURRENTLY is cheap on a small
-- index and 10 minutes keeps discovery near-real-time while bounding load. Adjust
-- the schedule expression below if the dataset grows.
--
-- Idempotent: `create extension if not exists`, and the job is unscheduled by
-- name (if present) before being re-created, so re-running never duplicates jobs.

-- ---------------------------------------------------------------------------
-- A. Extension
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- B. (Re)schedule the refresh job — guard against duplicate jobnames
-- ---------------------------------------------------------------------------
do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname = 'vendorly_refresh_search_index';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end
$$;

select cron.schedule(
  'vendorly_refresh_search_index',
  '*/10 * * * *',
  $cron$select public.refresh_search_index();$cron$
);
