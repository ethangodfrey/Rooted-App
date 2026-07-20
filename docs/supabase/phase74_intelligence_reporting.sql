-- Phase 74 — Automated intelligence: partner reports + anomaly alerts
-- Apply after phase73 (engagement_metrics) and notification_center (phase / 20260718).
--
-- Adds:
--   partner_reports (weekly performance summaries + email delivery status)
--   notification_type values: PERFORMANCE_REPORT, PERFORMANCE_ANOMALY

-- ---------------------------------------------------------------------------
-- 1. Notification enum extensions
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'notification_type'
  ) and not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'notification_type'
      and e.enumlabel = 'PERFORMANCE_REPORT'
  ) then
    alter type public.notification_type add value 'PERFORMANCE_REPORT';
  end if;

  if exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'notification_type'
  ) and not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'notification_type'
      and e.enumlabel = 'PERFORMANCE_ANOMALY'
  ) then
    alter type public.notification_type add value 'PERFORMANCE_ANOMALY';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. partner_reports
-- ---------------------------------------------------------------------------

create table if not exists public.partner_reports (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null,
  entity_type text not null
    check (entity_type in ('FARMER', 'VENDOR')),
  user_id uuid not null references public.profiles (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  report_type text not null default 'WEEKLY'
    check (report_type in ('WEEKLY', 'ANOMALY')),
  summary_text text not null,
  metrics jsonb not null default '{}'::jsonb,
  email_to text,
  email_status text not null default 'PENDING'
    check (email_status in ('PENDING', 'SENT', 'SKIPPED', 'FAILED')),
  email_sent_at timestamptz,
  notification_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_reports_period_order check (period_end >= period_start),
  constraint partner_reports_summary_not_blank check (char_length(btrim(summary_text)) > 0)
);

comment on table public.partner_reports is
  'Automated weekly performance summaries and anomaly alerts for vendors/farmers.';

create unique index if not exists partner_reports_weekly_entity_period_uidx
  on public.partner_reports (entity_id, entity_type, report_type, period_start, period_end)
  where report_type = 'WEEKLY';

create index if not exists partner_reports_user_created_idx
  on public.partner_reports (user_id, created_at desc);

create index if not exists partner_reports_entity_created_idx
  on public.partner_reports (entity_id, created_at desc);

alter table public.partner_reports enable row level security;

drop policy if exists "Partners read own reports" on public.partner_reports;
create policy "Partners read own reports"
  on public.partner_reports for select
  to authenticated
  using (
    user_id = auth.uid()
    or entity_id in (select id from public.vendors where user_id = auth.uid())
    or entity_id in (select id from public.farmers where user_id = auth.uid())
    or public.is_admin()
  );

-- No direct client inserts; Nest service role / security definer paths write reports.
