-- Phase 73 — Engagement analytics for farmers & vendors
-- Apply after phase70 (post_contributions) and phase72 (catering_inquiries).
-- Optional: phase71 user_events for RSVP metric backfill.
--
-- Adds:
--   interaction_events on post_contributions + catering_inquiries
--   engagement_metrics daily aggregates (VIEW | INQUIRY | RSVP)

-- ---------------------------------------------------------------------------
-- 1. Extend post_contributions — interaction event log
-- ---------------------------------------------------------------------------

alter table public.post_contributions
  add column if not exists interaction_events jsonb not null default '[]'::jsonb;

alter table public.post_contributions
  add column if not exists view_count integer not null default 0
    check (view_count >= 0);

alter table public.post_contributions
  add column if not exists click_count integer not null default 0
    check (click_count >= 0);

alter table public.post_contributions
  add column if not exists last_interaction_at timestamptz;

comment on column public.post_contributions.interaction_events is
  'Append-only log of VIEW/CLICK/INQUIRY interaction payloads for dual posts.';

create index if not exists post_contributions_last_interaction_idx
  on public.post_contributions (last_interaction_at desc nulls last);

-- ---------------------------------------------------------------------------
-- 2. Extend catering_inquiries — interaction event log
-- ---------------------------------------------------------------------------

alter table public.catering_inquiries
  add column if not exists interaction_events jsonb not null default '[]'::jsonb;

alter table public.catering_inquiries
  add column if not exists view_count integer not null default 0
    check (view_count >= 0);

alter table public.catering_inquiries
  add column if not exists click_count integer not null default 0
    check (click_count >= 0);

alter table public.catering_inquiries
  add column if not exists last_interaction_at timestamptz;

comment on column public.catering_inquiries.interaction_events is
  'Append-only log of VIEW/CLICK interaction payloads; row itself is an INQUIRY.';

-- ---------------------------------------------------------------------------
-- 3. engagement_metrics — daily aggregates
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'engagement_entity_type'
  ) then
    create type public.engagement_entity_type as enum ('FARMER', 'VENDOR');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'engagement_metric_type'
  ) then
    create type public.engagement_metric_type as enum ('VIEW', 'INQUIRY', 'RSVP');
  end if;
end $$;

create table if not exists public.engagement_metrics (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null,
  entity_type public.engagement_entity_type not null,
  metric_type public.engagement_metric_type not null,
  metric_date date not null default (timezone('utc', now()))::date,
  count integer not null default 0
    check (count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint engagement_metrics_entity_day_uidx
    unique (entity_id, entity_type, metric_type, metric_date)
);

comment on table public.engagement_metrics is
  'Daily engagement aggregates for farmer/vendor dashboards (views, inquiries, RSVPs).';

create index if not exists engagement_metrics_entity_date_idx
  on public.engagement_metrics (entity_id, metric_date desc);

create index if not exists engagement_metrics_type_date_idx
  on public.engagement_metrics (metric_type, metric_date desc);

alter table public.engagement_metrics enable row level security;

drop policy if exists "Owners read engagement metrics" on public.engagement_metrics;
create policy "Owners read engagement metrics"
  on public.engagement_metrics for select
  to authenticated
  using (
    entity_id = auth.uid()
    or entity_id in (select id from public.vendors where user_id = auth.uid())
    or entity_id in (select id from public.farmers where user_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists "Service role writes engagement metrics" on public.engagement_metrics;
-- Writes go through Nest service role / authenticated bump RPC below.

-- ---------------------------------------------------------------------------
-- 4. Helper: bump daily aggregate
-- ---------------------------------------------------------------------------

create or replace function public.bump_engagement_metric(
  p_entity_id uuid,
  p_entity_type public.engagement_entity_type,
  p_metric_type public.engagement_metric_type,
  p_delta integer default 1,
  p_metric_date date default (timezone('utc', now()))::date
)
returns public.engagement_metrics
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.engagement_metrics;
begin
  if p_delta is null or p_delta = 0 then
    p_delta := 1;
  end if;

  insert into public.engagement_metrics (
    entity_id, entity_type, metric_type, metric_date, count
  )
  values (
    p_entity_id, p_entity_type, p_metric_type, p_metric_date, greatest(p_delta, 0)
  )
  on conflict (entity_id, entity_type, metric_type, metric_date)
  do update set
    count = public.engagement_metrics.count + excluded.count,
    updated_at = now()
  returning * into row;

  return row;
end;
$$;

revoke all on function public.bump_engagement_metric(uuid, public.engagement_entity_type, public.engagement_metric_type, integer, date)
  from public;
grant execute on function public.bump_engagement_metric(uuid, public.engagement_entity_type, public.engagement_metric_type, integer, date)
  to authenticated, service_role;
