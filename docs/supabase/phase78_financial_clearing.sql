-- Phase 78 — Financial Clearing & Escrow Infrastructure (Phase 4)
-- Apply after phase76 (loyalty redemptions) and phase77 (catering PENDING_REVIEW).
--
-- Adds:
--   financial_transactions (platform capital ledger)
--   vendor_balances (internal digital wallets)
--   Extends catering_inquiries status for ACCEPTED / FULFILLED escrow milestones

-- ---------------------------------------------------------------------------
-- 1. Catering inquiry escrow statuses
-- ---------------------------------------------------------------------------

alter table public.catering_inquiries
  drop constraint if exists catering_inquiries_status_check;

alter table public.catering_inquiries
  add constraint catering_inquiries_status_check
  check (status in (
    'OPEN',
    'REPLIED',
    'CLOSED',
    'PENDING_REVIEW',
    'ACCEPTED',
    'FULFILLED'
  ));

alter table public.catering_inquiries
  add column if not exists deposit_cents integer
    check (deposit_cents is null or deposit_cents >= 0);

alter table public.catering_inquiries
  add column if not exists voucher_cents_applied integer not null default 0
    check (voucher_cents_applied >= 0);

alter table public.catering_inquiries
  add column if not exists escrow_transaction_id uuid;

comment on column public.catering_inquiries.deposit_cents is
  'Catering deposit amount in integer cents before voucher deduction.';

comment on column public.catering_inquiries.voucher_cents_applied is
  'Loyalty voucher cents deducted from deposit via RedemptionService.';

-- ---------------------------------------------------------------------------
-- 2. financial_transactions — platform capital ledger
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'financial_transaction_status'
  ) then
    create type public.financial_transaction_status as enum (
      'PENDING',
      'HELD_IN_ESCROW',
      'SETTLED',
      'REFUNDED'
    );
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'financial_transaction_type'
  ) then
    create type public.financial_transaction_type as enum (
      'WHOLESALE',
      'CATERING_DEPOSIT',
      'LOYALTY_BOOST'
    );
  end if;
end $$;

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid,
  destination_id uuid,
  amount_cents integer not null
    check (amount_cents >= 0),
  voucher_cents integer not null default 0
    check (voucher_cents >= 0),
  net_amount_cents integer not null
    check (net_amount_cents >= 0),
  status public.financial_transaction_status not null
    default 'PENDING'::public.financial_transaction_status,
  transaction_type public.financial_transaction_type not null,
  reference_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_transactions_net_check
    check (net_amount_cents = amount_cents - voucher_cents)
);

comment on table public.financial_transactions is
  'Platform capital ledger (ESCROW_LEDGER_ACTIVE): PENDING|HELD_IN_ESCROW|SETTLED|REFUNDED.';

create index if not exists financial_transactions_status_idx
  on public.financial_transactions (status, created_at desc);

create index if not exists financial_transactions_reference_idx
  on public.financial_transactions (reference_id, transaction_type)
  where reference_id is not null;

create index if not exists financial_transactions_destination_idx
  on public.financial_transactions (destination_id, created_at desc)
  where destination_id is not null;

alter table public.financial_transactions enable row level security;

drop policy if exists "Admins and parties read financial transactions" on public.financial_transactions;
create policy "Admins and parties read financial transactions"
  on public.financial_transactions for select
  to authenticated
  using (
    public.is_admin()
    or destination_id in (select id from public.vendors where user_id = auth.uid())
    or source_id in (select id from public.shoppers where user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3. vendor_balances — internal digital wallets
-- ---------------------------------------------------------------------------

create table if not exists public.vendor_balances (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null unique references public.vendors (id) on delete cascade,
  available_cents integer not null default 0
    check (available_cents >= 0),
  escrow_held_cents integer not null default 0
    check (escrow_held_cents >= 0),
  loyalty_liability_cents integer not null default 0
    check (loyalty_liability_cents >= 0),
  micro_fee_cents integer not null default 0
    check (micro_fee_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.vendor_balances is
  'Internal digital wallets: available funds, escrow holds, loyalty liabilities, platform micro-fees.';

create index if not exists vendor_balances_vendor_idx
  on public.vendor_balances (vendor_id);

alter table public.vendor_balances enable row level security;

drop policy if exists "Vendors read own balances" on public.vendor_balances;
create policy "Vendors read own balances"
  on public.vendor_balances for select
  to authenticated
  using (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
    or public.is_admin()
  );

-- Optional FK from catering inquiry → escrow transaction
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'catering_inquiries'
      and constraint_name = 'catering_inquiries_escrow_fk'
  ) then
    alter table public.catering_inquiries
      add constraint catering_inquiries_escrow_fk
      foreign key (escrow_transaction_id)
      references public.financial_transactions (id)
      on delete set null;
  end if;
end $$;
