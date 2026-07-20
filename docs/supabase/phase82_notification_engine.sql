-- Phase 82 — Automated Notification Engine (Phase 9)
-- Apply after phase81 (dispute resolution).
--
-- Adds:
--   notifications_log (EMAIL | SMS delivery audit)
--   Ensures users.notification_preferences jsonb exists

-- ---------------------------------------------------------------------------
-- 1. Ensure users.notification_preferences
-- ---------------------------------------------------------------------------

alter table public.users
  add column if not exists notification_preferences jsonb
    not null default '{"emailEnabled":true,"smsEnabled":true}'::jsonb;

comment on column public.users.notification_preferences is
  'NOTIFICATION_ENGINE_ACTIVE prefs: { emailEnabled, smsEnabled }.';

-- Backfill nulls to defaults (legacy rows)
update public.users
set notification_preferences = '{"emailEnabled":true,"smsEnabled":true}'::jsonb
where notification_preferences is null
   or notification_preferences = '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- 2. notifications_log
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'notification_channel'
  ) then
    create type public.notification_channel as enum ('EMAIL', 'SMS');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'notification_status'
  ) then
    create type public.notification_status as enum ('SENT', 'FAILED');
  end if;
end $$;

create table if not exists public.notifications_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references public.users (id) on delete cascade,
  channel public.notification_channel not null,
  event_type text not null,
  status public.notification_status not null
    default 'SENT'::public.notification_status,
  destination text,
  subject text,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.notifications_log is
  'Notification Engine audit (NOTIFICATION_ENGINE_ACTIVE / EVENT_DISPATCHED).';

create index if not exists notifications_log_user_idx
  on public.notifications_log (user_id, created_at desc);

create index if not exists notifications_log_event_idx
  on public.notifications_log (event_type, created_at desc);

alter table public.notifications_log enable row level security;

drop policy if exists "Users read own notification logs" on public.notifications_log;
create policy "Users read own notification logs"
  on public.notifications_log for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Admins read all notification logs" on public.notifications_log;
create policy "Admins read all notification logs"
  on public.notifications_log for select
  to authenticated
  using (public.is_admin());
