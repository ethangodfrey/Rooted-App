-- Rooted — Community Events & Ingested Markets Engine (2026-07-17)
-- Apply after phase51_network_and_stickers.sql (profiles + vendor/farmer roles).
--
-- NOTE: public.events already stores USDA / farmers-market directory rows.
-- Community-hosted festivals, pop-ups, city markets, and flea-style markets
-- live in public.community_events (same product surface as "events" in the PR).
--
-- Orange map pins on Shopper Explore read active rows where end_time > now().

-- ---------------------------------------------------------------------------
-- 1. Enum + community_events
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'community_event_type') then
    create type public.community_event_type as enum (
      'FESTIVAL',
      'POP_UP',
      'CITY_MARKET',
      'FARMERS_MARKET'
    );
  end if;
end $$;

create or replace function public.is_community_event_host(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = profile_id and role in ('vendor', 'farmer')
  );
$$;

revoke all on function public.is_community_event_host(uuid) from public;
grant execute on function public.is_community_event_host(uuid) to authenticated;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'community_event_verification_status') then
    create type public.community_event_verification_status as enum (
      'pending',
      'approved',
      'rejected'
    );
  end if;
end $$;

create table if not exists public.community_events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null default '',
  event_type public.community_event_type not null,
  latitude numeric not null,
  longitude numeric not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  is_ai_ingested boolean not null default false,
  verification_status public.community_event_verification_status not null default 'pending',
  verified_at timestamptz,
  verified_by uuid references public.users (id) on delete set null,
  rejection_reason text,
  ai_recommendation text
    check (ai_recommendation is null or ai_recommendation in ('approve', 'reject', 'needs_review')),
  ai_confidence numeric
    check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)),
  ai_summary text,
  ai_flags text[] not null default '{}',
  ai_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_events_title_nonempty check (length(trim(title)) > 0),
  constraint community_events_time_range check (end_time > start_time),
  constraint community_events_lat_range check (latitude between -90 and 90),
  constraint community_events_lng_range check (longitude between -180 and 180)
);

comment on table public.community_events is
  'Vendor/farmer hosted community events (festival, pop-up, city market, farmers market). Orange map pins after admin approval.';

comment on column public.community_events.is_ai_ingested is
  'Reserved for automated aggregation pipelines; manual publishes stay false.';

comment on column public.community_events.verification_status is
  'Admin gate: pending until approved; only approved events appear on shopper map.';

create index if not exists community_events_end_time_idx
  on public.community_events (end_time);

create index if not exists community_events_geo_idx
  on public.community_events (latitude, longitude);

create index if not exists community_events_creator_idx
  on public.community_events (creator_id, start_time desc);

create index if not exists community_events_type_idx
  on public.community_events (event_type);

create index if not exists community_events_verification_idx
  on public.community_events (verification_status, end_time);

create or replace function public.set_community_events_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists community_events_set_updated_at on public.community_events;
create trigger community_events_set_updated_at
  before update on public.community_events
  for each row execute function public.set_community_events_updated_at();

create or replace function public.enforce_community_event_host()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_community_event_host(new.creator_id) then
    raise exception 'creator_id must be a vendor or farmer profile';
  end if;
  return new;
end;
$$;

drop trigger if exists community_events_enforce_host on public.community_events;
create trigger community_events_enforce_host
  before insert or update of creator_id
  on public.community_events
  for each row execute function public.enforce_community_event_host();

alter table public.community_events enable row level security;

drop policy if exists "Public read active community events" on public.community_events;
drop policy if exists "Public read approved community events" on public.community_events;
create policy "Public read approved community events"
  on public.community_events for select
  to anon, authenticated
  using (
    verification_status = 'approved'
    or creator_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "Hosts insert community events" on public.community_events;
create policy "Hosts insert community events"
  on public.community_events for insert
  to authenticated
  with check (
    creator_id = auth.uid()
    and public.is_community_event_host(creator_id)
  );

drop policy if exists "Hosts update own community events" on public.community_events;
drop policy if exists "Admins update community event verification" on public.community_events;
create policy "Admins update community event verification"
  on public.community_events for update
  to authenticated
  using (public.is_admin() or creator_id = auth.uid())
  with check (public.is_admin() or creator_id = auth.uid());

drop policy if exists "Hosts delete own community events" on public.community_events;
create policy "Hosts delete own community events"
  on public.community_events for delete
  to authenticated
  using (creator_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- 2. Participating platform businesses
-- ---------------------------------------------------------------------------

create table if not exists public.community_event_participants (
  id uuid primary key default gen_random_uuid(),
  community_event_id uuid not null references public.community_events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (community_event_id, profile_id)
);

comment on table public.community_event_participants is
  'Platform vendors/farmers listed on a community event map card.';

create index if not exists community_event_participants_event_idx
  on public.community_event_participants (community_event_id);

create index if not exists community_event_participants_profile_idx
  on public.community_event_participants (profile_id);

alter table public.community_event_participants enable row level security;

drop policy if exists "Public read community event participants" on public.community_event_participants;
create policy "Public read community event participants"
  on public.community_event_participants for select
  to anon, authenticated
  using (true);

drop policy if exists "Hosts manage participants on own events" on public.community_event_participants;
create policy "Hosts manage participants on own events"
  on public.community_event_participants for all
  to authenticated
  using (
    exists (
      select 1 from public.community_events ce
      where ce.id = community_event_id and ce.creator_id = auth.uid()
    )
    or profile_id = auth.uid()
  )
  with check (
    exists (
      select 1 from public.community_events ce
      where ce.id = community_event_id and ce.creator_id = auth.uid()
    )
    or profile_id = auth.uid()
  );

-- Auto-add creator as a participant on publish
create or replace function public.community_events_add_creator_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.community_event_participants (community_event_id, profile_id)
  values (new.id, new.creator_id)
  on conflict (community_event_id, profile_id) do nothing;
  return new;
end;
$$;

drop trigger if exists community_events_add_creator_participant on public.community_events;
create trigger community_events_add_creator_participant
  after insert on public.community_events
  for each row execute function public.community_events_add_creator_participant();

-- Force new publishes to pending (hosts cannot self-approve)
create or replace function public.community_events_force_pending_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.verification_status := 'pending';
  new.verified_at := null;
  new.verified_by := null;
  new.rejection_reason := null;
  return new;
end;
$$;

drop trigger if exists community_events_force_pending_on_insert on public.community_events;
create trigger community_events_force_pending_on_insert
  before insert on public.community_events
  for each row execute function public.community_events_force_pending_on_insert();

-- Non-admins cannot change verification / AI assist fields
create or replace function public.community_events_protect_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  new.verification_status := old.verification_status;
  new.verified_at := old.verified_at;
  new.verified_by := old.verified_by;
  new.rejection_reason := old.rejection_reason;
  new.ai_recommendation := old.ai_recommendation;
  new.ai_confidence := old.ai_confidence;
  new.ai_summary := old.ai_summary;
  new.ai_flags := old.ai_flags;
  new.ai_reviewed_at := old.ai_reviewed_at;
  return new;
end;
$$;

drop trigger if exists community_events_protect_verification on public.community_events;
create trigger community_events_protect_verification
  before update on public.community_events
  for each row execute function public.community_events_protect_verification();
