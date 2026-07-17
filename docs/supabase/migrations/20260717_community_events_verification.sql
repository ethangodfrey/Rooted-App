-- Rooted — Community event admin verification (2026-07-17)
-- Apply after 20260717_community_events.sql (idempotent if columns already exist).
--
-- Flow: host publishes → verification_status = pending
--       admin (+ optional AI assist) → approved | rejected
--       Shopper Explore map only shows approved + end_time > now()

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

alter table public.community_events
  add column if not exists verification_status public.community_event_verification_status
    not null default 'pending';

alter table public.community_events
  add column if not exists verified_at timestamptz;

alter table public.community_events
  add column if not exists verified_by uuid references public.users (id) on delete set null;

alter table public.community_events
  add column if not exists rejection_reason text;

alter table public.community_events
  add column if not exists ai_recommendation text
    check (ai_recommendation is null or ai_recommendation in ('approve', 'reject', 'needs_review'));

alter table public.community_events
  add column if not exists ai_confidence numeric
    check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1));

alter table public.community_events
  add column if not exists ai_summary text;

alter table public.community_events
  add column if not exists ai_flags text[] not null default '{}';

alter table public.community_events
  add column if not exists ai_reviewed_at timestamptz;

comment on column public.community_events.verification_status is
  'Admin gate: pending until approved; only approved events appear on shopper map.';

comment on column public.community_events.ai_recommendation is
  'Optional AI assist suggestion; never auto-applies status — admin must confirm.';

create index if not exists community_events_verification_idx
  on public.community_events (verification_status, end_time);

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

-- Non-admins cannot change verification fields
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

-- Tighten RLS: public sees approved only; hosts see own; admins see all
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

drop policy if exists "Admins update community event verification" on public.community_events;
create policy "Admins update community event verification"
  on public.community_events for update
  to authenticated
  using (public.is_admin() or creator_id = auth.uid())
  with check (public.is_admin() or creator_id = auth.uid());
