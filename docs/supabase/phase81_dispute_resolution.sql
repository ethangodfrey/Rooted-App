-- Phase 81 — Dispute Resolution Engine (Phase 8)
-- Apply after phase78/79/80 (escrow ledger + fleet + Stripe).
--
-- Adds:
--   financial_transaction_status.FROZEN
--   disputes (OPEN | IN_REVIEW | RESOLVED_REFUNDED | RESOLVED_RELEASED)

-- ---------------------------------------------------------------------------
-- 1. Extend financial_transaction_status with FROZEN
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'financial_transaction_status'
      and e.enumlabel = 'FROZEN'
  ) then
    alter type public.financial_transaction_status add value 'FROZEN';
  end if;
end $$;

comment on type public.financial_transaction_status is
  'PENDING|HELD_IN_ESCROW|FROZEN|SETTLED|REFUNDED — FROZEN blocks fulfillment release.';

-- ---------------------------------------------------------------------------
-- 2. disputes table
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'dispute_status'
  ) then
    create type public.dispute_status as enum (
      'OPEN',
      'IN_REVIEW',
      'RESOLVED_REFUNDED',
      'RESOLVED_RELEASED'
    );
  end if;
end $$;

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null
    references public.financial_transactions (id) on delete cascade,
  initiator_id uuid not null,
  reason text not null,
  status public.dispute_status not null
    default 'OPEN'::public.dispute_status,
  resolution_notes text,
  resolved_by uuid,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.disputes is
  'Dispute Resolution Engine (DISPUTE_ENGINE_INITIALIZED): freezes escrow until admin refund/dismiss.';

create index if not exists disputes_status_idx
  on public.disputes (status, created_at desc);

create index if not exists disputes_transaction_idx
  on public.disputes (transaction_id, created_at desc);

create unique index if not exists disputes_open_transaction_uidx
  on public.disputes (transaction_id)
  where status in (
    'OPEN'::public.dispute_status,
    'IN_REVIEW'::public.dispute_status
  );

alter table public.disputes enable row level security;

drop policy if exists "Admins manage disputes" on public.disputes;
create policy "Admins manage disputes"
  on public.disputes for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Initiators read own disputes" on public.disputes;
create policy "Initiators read own disputes"
  on public.disputes for select
  to authenticated
  using (
    initiator_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "Authenticated raise disputes" on public.disputes;
create policy "Authenticated raise disputes"
  on public.disputes for insert
  to authenticated
  with check (initiator_id = auth.uid() or public.is_admin());
