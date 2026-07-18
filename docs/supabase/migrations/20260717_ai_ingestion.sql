-- Rooted — AI Local Event Discovery & Ingestion Pipeline (2026-07-17)
-- Apply after 20260717_community_events.sql (+ verification script).
--
-- Product "events" for festivals / pop-ups / holiday markets live in
-- public.community_events (USDA directory remains public.events).
-- This migration adds AI source tracking metadata and relaxes host checks
-- so the ingestion worker can write PENDING rows with is_ai_ingested = true.

-- ---------------------------------------------------------------------------
-- 1. Metadata columns
-- ---------------------------------------------------------------------------

alter table public.community_events
  add column if not exists ai_source_metadata jsonb not null default '{}'::jsonb;

comment on column public.community_events.ai_source_metadata is
  'AI ingestion tracking: source urls, snippets, scrape confidence, worker query.';

comment on column public.community_events.is_ai_ingested is
  'True when created by the AI discovery worker; manual host publishes stay false.';

-- Optional tracking on the USDA directory table (does not change map pin flow)
alter table public.events
  add column if not exists ai_source_metadata jsonb not null default '{}'::jsonb;

comment on column public.events.ai_source_metadata is
  'Optional AI enrichment / discovery metadata for directory markets.';

create index if not exists community_events_ai_ingested_idx
  on public.community_events (is_ai_ingested, verification_status, created_at desc);

create index if not exists community_events_ai_source_metadata_gin
  on public.community_events using gin (ai_source_metadata);

-- AI worker rows may omit a host profile (admins are not vendor/farmer profiles).
alter table public.community_events
  alter column creator_id drop not null;

-- ---------------------------------------------------------------------------
-- 2. Allow AI-ingested rows without a vendor/farmer host profile
-- ---------------------------------------------------------------------------

create or replace function public.enforce_community_event_host()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- AI discovery pipeline writes PENDING rows with is_ai_ingested = true.
  if coalesce(new.is_ai_ingested, false) then
    new.verification_status := 'pending';
    new.is_ai_ingested := true;
    return new;
  end if;

  if new.creator_id is null or not public.is_community_event_host(new.creator_id) then
    raise exception 'creator_id must be a vendor or farmer profile';
  end if;
  return new;
end;
$$;

-- Force AI rows to PENDING + is_ai_ingested consistency on insert
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
  if coalesce(new.is_ai_ingested, false) then
    new.is_ai_ingested := true;
    if new.ai_source_metadata is null then
      new.ai_source_metadata := '{}'::jsonb;
    end if;
  end if;
  return new;
end;
$$;

-- Admins may insert AI-ingested community events (Nest service role also bypasses RLS)
drop policy if exists "Admins insert community events" on public.community_events;
create policy "Admins insert community events"
  on public.community_events for insert
  to authenticated
  with check (public.is_admin());
