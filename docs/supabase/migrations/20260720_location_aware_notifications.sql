-- Phase 69 — Location-aware market notifications for shoppers
-- Apply after notification_center migration (20260718_notification_center.sql).
--
-- Adds:
--   user_settings (enable_market_alerts, alert_radius_km, last geo)
--   MARKET_ALERT notification type
--   deep_link + market_id on notification_logs
--   market_alert_dispatches dedupe
--   enqueue_market_notification helper

-- ---------------------------------------------------------------------------
-- 1. Extend notification_type enum
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'notification_type'
      and e.enumlabel = 'MARKET_ALERT'
  ) then
    alter type public.notification_type add value 'MARKET_ALERT';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. user_settings
-- ---------------------------------------------------------------------------

create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  enable_market_alerts boolean not null default true,
  alert_radius_km numeric(8, 2) not null default 25.00
    check (alert_radius_km > 0 and alert_radius_km <= 200),
  last_latitude numeric(10, 7),
  last_longitude numeric(10, 7),
  last_location_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_settings_lat_lng_pair check (
    (last_latitude is null and last_longitude is null)
    or (
      last_latitude is not null
      and last_longitude is not null
      and last_latitude between -90 and 90
      and last_longitude between -180 and 180
    )
  )
);

comment on table public.user_settings is
  'Shopper notification preferences including location-aware market alerts.';

create index if not exists user_settings_alerts_geo_idx
  on public.user_settings (enable_market_alerts)
  where enable_market_alerts = true
    and last_latitude is not null
    and last_longitude is not null;

alter table public.user_settings enable row level security;

drop policy if exists "Users read own settings" on public.user_settings;
create policy "Users read own settings"
  on public.user_settings for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users upsert own settings" on public.user_settings;
create policy "Users upsert own settings"
  on public.user_settings for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users update own settings" on public.user_settings;
create policy "Users update own settings"
  on public.user_settings for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. notification_logs deep link columns
-- ---------------------------------------------------------------------------

alter table public.notification_logs
  add column if not exists market_id uuid references public.events (id) on delete set null;

alter table public.notification_logs
  add column if not exists deep_link text;

alter table public.notification_logs
  add column if not exists payload jsonb not null default '{}'::jsonb;

create index if not exists notification_logs_market_id_idx
  on public.notification_logs (market_id)
  where market_id is not null;

-- ---------------------------------------------------------------------------
-- 4. Dedupe dispatches (one alert per user/market/start window)
-- ---------------------------------------------------------------------------

create table if not exists public.market_alert_dispatches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  market_id uuid not null references public.events (id) on delete cascade,
  event_start_at timestamptz not null,
  notification_id uuid references public.notification_logs (id) on delete set null,
  distance_km numeric(10, 3),
  created_at timestamptz not null default now(),
  constraint market_alert_dispatches_unique unique (user_id, market_id, event_start_at)
);

create index if not exists market_alert_dispatches_market_idx
  on public.market_alert_dispatches (market_id, event_start_at desc);

alter table public.market_alert_dispatches enable row level security;

drop policy if exists "Users read own market alert dispatches" on public.market_alert_dispatches;
create policy "Users read own market alert dispatches"
  on public.market_alert_dispatches for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. enqueue_market_notification
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_market_notification(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_market_id uuid,
  p_deep_link text default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  link text;
begin
  if p_user_id is null or p_market_id is null then
    return null;
  end if;

  link := coalesce(
    nullif(btrim(p_deep_link), ''),
    '/markets/' || p_market_id::text
  );

  insert into public.notification_logs (
    user_id,
    title,
    body,
    notification_type,
    market_id,
    deep_link,
    payload
  ) values (
    p_user_id,
    upper(btrim(p_title)),
    btrim(p_body),
    'MARKET_ALERT'::public.notification_type,
    p_market_id,
    link,
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('market_id', p_market_id::text)
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.enqueue_market_notification(uuid, text, text, uuid, text, jsonb) from public;
grant execute on function public.enqueue_market_notification(uuid, text, text, uuid, text, jsonb) to service_role;
