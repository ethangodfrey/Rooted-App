-- Rooted Phase 17: AI admin agent (vendor review suggestions)
-- Run in Supabase SQL Editor after phase12_admin.sql.
-- The NestJS admin agent writes suggestions; humans still approve/reject vendors.

create table if not exists public.admin_agent_runs (
  id                uuid primary key default gen_random_uuid(),
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  status            text not null default 'running'
    check (status in ('running', 'success', 'partial', 'failed')),
  agent_type        text not null default 'vendor_review',
  reviewed          int not null default 0,
  suggestions_count int not null default 0,
  skipped           int not null default 0,
  errors            jsonb not null default '[]'::jsonb,
  agent_version     text,
  notes             text
);

create index if not exists admin_agent_runs_started_idx
  on public.admin_agent_runs (started_at desc);

create table if not exists public.vendor_review_suggestions (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid references public.admin_agent_runs (id) on delete set null,
  vendor_id       uuid not null references public.vendors (id) on delete cascade,
  recommendation  text not null
    check (recommendation in ('approve', 'reject', 'needs_review')),
  confidence      numeric(4, 3) not null default 0.5,
  summary         text not null,
  flags           jsonb not null default '[]'::jsonb,
  reasons         jsonb not null default '[]'::jsonb,
  agent_version   text,
  created_at      timestamptz not null default now()
);

create index if not exists vendor_review_suggestions_vendor_idx
  on public.vendor_review_suggestions (vendor_id, created_at desc);

alter table public.admin_agent_runs enable row level security;
alter table public.vendor_review_suggestions enable row level security;

create policy "Admins read admin agent runs"
  on public.admin_agent_runs for select
  using (public.is_admin());

create policy "Admins read vendor review suggestions"
  on public.vendor_review_suggestions for select
  using (public.is_admin());
