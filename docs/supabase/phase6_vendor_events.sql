-- Rooted Phase 6: vendor <-> event participation
-- Run in Supabase SQL Editor after Phase 1 and Phase 4.

create table public.vendor_events (
  id                   uuid primary key default gen_random_uuid(),
  vendor_id            uuid not null references public.vendors (id) on delete cascade,
  event_id             uuid not null references public.events (id) on delete cascade,
  participation_status text not null default 'requested'
    check (participation_status in ('requested', 'approved', 'declined')),
  booth_details        text,
  setup_notes          text,
  pre_order_enabled    boolean not null default true,
  created_at           timestamptz not null default now(),
  unique (vendor_id, event_id)
);

alter table public.vendor_events enable row level security;

-- A vendor can fully manage their own participation rows.
create policy "Vendors manage own participations"
  on public.vendor_events for all
  using (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
  )
  with check (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
  );

-- Anyone authenticated can read APPROVED participations for PUBLIC events
-- (used by shoppers on the event detail screen).
create policy "Read approved participations for public events"
  on public.vendor_events for select
  using (
    participation_status = 'approved'
    and event_id in (select id from public.events where visibility_status = 'public')
  );

create index vendor_events_event_id_idx on public.vendor_events (event_id);
create index vendor_events_vendor_id_idx on public.vendor_events (vendor_id);
