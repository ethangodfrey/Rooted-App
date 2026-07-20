-- Phase 76 — Precision Rewards (shopper loyalty reciprocal actions + vendor boosts)
-- Apply after phase75 (shopper_loyalty) and preferably phase71/72 for RSVP/catering hooks.
--
-- Adds:
--   vendors.rewards_opt_in + rewards_boost_balance_cents
--   loyalty_action_ledger (point ticks)
--   vendor_rewards_boost (double-point sponsorship windows)
--   loyalty_redemptions
--   Extends shopper_loyalty with action counters

-- ---------------------------------------------------------------------------
-- 1. Vendor rewards program opt-in + boost balance
-- ---------------------------------------------------------------------------

alter table public.vendors
  add column if not exists rewards_opt_in boolean not null default false;

alter table public.vendors
  add column if not exists rewards_boost_balance_cents integer not null default 0
    check (rewards_boost_balance_cents >= 0);

comment on column public.vendors.rewards_opt_in is
  'When true, shoppers may redeem Precision Rewards at this vendor.';

comment on column public.vendors.rewards_boost_balance_cents is
  'Vendor-funded balance for double-point boost micro-fees (integer cents).';

create index if not exists vendors_rewards_opt_in_idx
  on public.vendors (rewards_opt_in)
  where rewards_opt_in = true;

-- ---------------------------------------------------------------------------
-- 2. Extend shopper_loyalty with reciprocal action counters
-- ---------------------------------------------------------------------------

alter table public.shopper_loyalty
  add column if not exists rsvp_points integer not null default 0
    check (rsvp_points >= 0);

alter table public.shopper_loyalty
  add column if not exists catering_points integer not null default 0
    check (catering_points >= 0);

alter table public.shopper_loyalty
  add column if not exists collaboration_points integer not null default 0
    check (collaboration_points >= 0);

alter table public.shopper_loyalty
  add column if not exists boosted_points integer not null default 0
    check (boosted_points >= 0);

comment on table public.shopper_loyalty is
  'Precision Rewards summary: RSVP +10, catering inquiry +50, collaboration purchase +100 (boosts may double).';

-- ---------------------------------------------------------------------------
-- 3. loyalty_action_ledger — individual point ticks
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'loyalty_action_type'
  ) then
    create type public.loyalty_action_type as enum (
      'RSVP_MARKET_EVENT',
      'CATERING_INQUIRY',
      'COLLABORATION_PURCHASE',
      'REDEMPTION'
    );
  end if;
end $$;

create table if not exists public.loyalty_action_ledger (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid not null references public.shoppers (id) on delete cascade,
  vendor_id uuid references public.vendors (id) on delete set null,
  action_type public.loyalty_action_type not null,
  base_points integer not null,
  bonus_points integer not null default 0
    check (bonus_points >= 0),
  points_awarded integer not null,
  boost_id uuid,
  reference_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint loyalty_action_ledger_points_check
    check (points_awarded = base_points + bonus_points)
);

comment on table public.loyalty_action_ledger is
  'Append-only Precision Rewards ticks (LOYALTY_TICK_PROCESSED).';

create index if not exists loyalty_action_ledger_shopper_idx
  on public.loyalty_action_ledger (shopper_id, created_at desc);

create index if not exists loyalty_action_ledger_vendor_idx
  on public.loyalty_action_ledger (vendor_id, created_at desc)
  where vendor_id is not null;

alter table public.loyalty_action_ledger enable row level security;

drop policy if exists "Shoppers read own loyalty ledger" on public.loyalty_action_ledger;
create policy "Shoppers read own loyalty ledger"
  on public.loyalty_action_ledger for select
  to authenticated
  using (
    shopper_id in (select id from public.shoppers where user_id = auth.uid())
    or vendor_id in (select id from public.vendors where user_id = auth.uid())
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- 4. vendor_rewards_boost — Double Point sponsorship windows
-- ---------------------------------------------------------------------------

create table if not exists public.vendor_rewards_boost (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  label text not null default 'DOUBLE_POINTS',
  multiplier numeric(4, 2) not null default 2.00
    check (multiplier >= 1.00 and multiplier <= 5.00),
  -- Micro-fee charged to vendor per bonus point (integer cents).
  micro_fee_cents_per_bonus_point integer not null default 1
    check (micro_fee_cents_per_bonus_point >= 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendor_rewards_boost_window check (ends_at > starts_at)
);

comment on table public.vendor_rewards_boost is
  'Vendor-funded Double Point boost windows; bonus points deduct vendor micro-fee balance.';

create index if not exists vendor_rewards_boost_active_idx
  on public.vendor_rewards_boost (vendor_id, starts_at, ends_at)
  where is_active = true;

alter table public.vendor_rewards_boost enable row level security;

drop policy if exists "Public read active boosts" on public.vendor_rewards_boost;
create policy "Public read active boosts"
  on public.vendor_rewards_boost for select
  to authenticated, anon
  using (is_active = true and starts_at <= now() and ends_at >= now());

drop policy if exists "Vendors manage own boosts" on public.vendor_rewards_boost;
create policy "Vendors manage own boosts"
  on public.vendor_rewards_boost for all
  to authenticated
  using (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
    or public.is_admin()
  )
  with check (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
    or public.is_admin()
  );

-- FK from ledger.boost_id (added after boost table exists)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'loyalty_action_ledger'
      and constraint_name = 'loyalty_action_ledger_boost_fk'
  ) then
    alter table public.loyalty_action_ledger
      add constraint loyalty_action_ledger_boost_fk
      foreign key (boost_id) references public.vendor_rewards_boost (id)
      on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. loyalty_redemptions
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'loyalty_redemption_tier'
  ) then
    create type public.loyalty_redemption_tier as enum (
      'VOUCHER_5',
      'EARLY_ACCESS_CATERING'
    );
  end if;
end $$;

create table if not exists public.loyalty_redemptions (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid not null references public.shoppers (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  tier public.loyalty_redemption_tier not null,
  points_spent integer not null
    check (points_spent > 0),
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'USED', 'CANCELLED')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.loyalty_redemptions is
  'Shopper redemptions at rewards-opted vendors (500=$5 voucher, 1000=early catering access).';

create index if not exists loyalty_redemptions_shopper_idx
  on public.loyalty_redemptions (shopper_id, created_at desc);

create index if not exists loyalty_redemptions_vendor_idx
  on public.loyalty_redemptions (vendor_id, created_at desc);

alter table public.loyalty_redemptions enable row level security;

drop policy if exists "Parties read loyalty redemptions" on public.loyalty_redemptions;
create policy "Parties read loyalty redemptions"
  on public.loyalty_redemptions for select
  to authenticated
  using (
    shopper_id in (select id from public.shoppers where user_id = auth.uid())
    or vendor_id in (select id from public.vendors where user_id = auth.uid())
    or public.is_admin()
  );
