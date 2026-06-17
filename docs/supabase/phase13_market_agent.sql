-- Rooted Phase 13: market discovery agent (external IDs + sync audit)
-- Run in Supabase SQL Editor after phase4_events.sql.

alter table public.events
  add column if not exists external_source text,
  add column if not exists external_id text,
  add column if not exists last_synced_at timestamptz,
  add column if not exists sync_metadata jsonb not null default '{}'::jsonb;

create unique index if not exists events_external_source_id_key
  on public.events (external_source, external_id)
  where external_source is not null and external_id is not null;

create index if not exists events_last_synced_at_idx
  on public.events (last_synced_at);

create table if not exists public.market_sync_runs (
  id            uuid primary key default gen_random_uuid(),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null default 'running'
    check (status in ('running', 'success', 'partial', 'failed')),
  discovered    integer not null default 0,
  inserted      integer not null default 0,
  updated       integer not null default 0,
  skipped       integer not null default 0,
  errors        jsonb not null default '[]'::jsonb,
  agent_version text,
  notes         text
);

alter table public.market_sync_runs enable row level security;

create policy "Admins read market sync runs"
  on public.market_sync_runs for select
  using (public.is_admin());
