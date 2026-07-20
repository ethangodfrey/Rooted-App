-- Phase 71 — Meet the Makers discovery + shopper RSVP schedule
-- Apply after phase70 dual posting (+ optional phase69 user_settings).
--
-- Adds:
--   user_events (shopper RSVPs tied to markets/events + optional partnership post)
--   Ensures user_settings.alert_radius_km exists for location-prioritized feed

-- ---------------------------------------------------------------------------
-- 1. user_settings (minimal) for alert_radius_km when phase69 not yet applied
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
  updated_at timestamptz not null default now()
);

alter table public.user_settings
  add column if not exists alert_radius_km numeric(8, 2) not null default 25.00;

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
-- 2. user_events — personal RSVP schedule
-- ---------------------------------------------------------------------------

create table if not exists public.user_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  post_id uuid references public.posts (id) on delete set null,
  status text not null default 'RSVP'
    check (status in ('RSVP', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_events_user_event_uidx unique (user_id, event_id)
);

comment on table public.user_events is
  'Shopper RSVPs for market-related partnership posts; feeds personal schedule.';

create index if not exists user_events_user_created_idx
  on public.user_events (user_id, created_at desc);

create index if not exists user_events_event_idx
  on public.user_events (event_id);

create index if not exists user_events_post_idx
  on public.user_events (post_id)
  where post_id is not null;

alter table public.user_events enable row level security;

drop policy if exists "Users read own RSVPs" on public.user_events;
create policy "Users read own RSVPs"
  on public.user_events for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users insert own RSVPs" on public.user_events;
create policy "Users insert own RSVPs"
  on public.user_events for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users update own RSVPs" on public.user_events;
create policy "Users update own RSVPs"
  on public.user_events for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users delete own RSVPs" on public.user_events;
create policy "Users delete own RSVPs"
  on public.user_events for delete
  to authenticated
  using (user_id = auth.uid() or public.is_admin());
