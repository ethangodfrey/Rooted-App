-- Vendorly Phase 64 — Peer-to-Peer Connection Engine (Phase 11a)
-- Run in Supabase SQL Editor after phase63_wholesale_stripe_payments.sql.
--
-- NOTE: public.vendor_connections is reserved for profile-level social handshakes
-- (sender_id/receiver_id on profiles). Phase 11 wholesale peer edges live here as
-- public.vendor_peer_connections with requestor_id / recipient_id and
-- PENDING | ACCEPTED | BLOCKED.
--
-- Telemetry: CONNECTION_REQUEST_INITIATED, WHOLESALE_RELATIONSHIP_ESTABLISHED

-- ---------------------------------------------------------------------------
-- A. Enum
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.vendor_peer_connection_status as enum (
    'PENDING',
    'ACCEPTED',
    'BLOCKED'
  );
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- B. Peer connection requests (directory Vendor ids)
-- ---------------------------------------------------------------------------
create table if not exists public.vendor_peer_connections (
  id uuid primary key default gen_random_uuid(),
  requestor_id uuid not null references public.vendors (id) on delete cascade,
  recipient_id uuid not null references public.vendors (id) on delete cascade,
  status public.vendor_peer_connection_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendor_peer_connections_no_self
    check (requestor_id <> recipient_id),
  constraint vendor_peer_connections_pair_key
    unique (requestor_id, recipient_id)
);

comment on table public.vendor_peer_connections is
  'Phase 11 wholesale peer connection requests (PENDING/ACCEPTED/BLOCKED).';

create index if not exists vendor_peer_connections_requestor_idx
  on public.vendor_peer_connections (requestor_id, status);

create index if not exists vendor_peer_connections_recipient_idx
  on public.vendor_peer_connections (recipient_id, status);

create index if not exists vendor_peer_connections_created_idx
  on public.vendor_peer_connections (created_at);

create or replace function public.set_vendor_peer_connections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vendor_peer_connections_set_updated_at
  on public.vendor_peer_connections;
create trigger vendor_peer_connections_set_updated_at
  before update on public.vendor_peer_connections
  for each row execute function public.set_vendor_peer_connections_updated_at();

-- ---------------------------------------------------------------------------
-- C. RLS — participants only (service role / Nest bypasses via direct DB)
-- ---------------------------------------------------------------------------
alter table public.vendor_peer_connections enable row level security;

drop policy if exists vendor_peer_connections_select_participant
  on public.vendor_peer_connections;
create policy vendor_peer_connections_select_participant
  on public.vendor_peer_connections for select
  using (
    exists (
      select 1 from public.vendors v
      where v.user_id = auth.uid()
        and (v.id = requestor_id or v.id = recipient_id)
    )
  );

drop policy if exists vendor_peer_connections_insert_requestor
  on public.vendor_peer_connections;
create policy vendor_peer_connections_insert_requestor
  on public.vendor_peer_connections for insert
  with check (
    exists (
      select 1 from public.vendors v
      where v.user_id = auth.uid()
        and v.id = requestor_id
    )
  );

drop policy if exists vendor_peer_connections_update_participant
  on public.vendor_peer_connections;
create policy vendor_peer_connections_update_participant
  on public.vendor_peer_connections for update
  using (
    exists (
      select 1 from public.vendors v
      where v.user_id = auth.uid()
        and (v.id = requestor_id or v.id = recipient_id)
    )
  )
  with check (
    exists (
      select 1 from public.vendors v
      where v.user_id = auth.uid()
        and (v.id = requestor_id or v.id = recipient_id)
    )
  );
