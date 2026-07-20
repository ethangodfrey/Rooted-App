-- Phase 80 — Stripe Connect payment gateway (Phase 6)
-- Apply after phase78/79 (escrow ledger + fleet logistics).
--
-- Adds:
--   vendors.stripe_account_id (idempotent; may already exist from phase32)
--   farmers.stripe_account_id (Connect destination for wholesale checkout)

-- ---------------------------------------------------------------------------
-- 1. Vendor Stripe Connect account (ensure present)
-- ---------------------------------------------------------------------------

alter table public.vendors
  add column if not exists stripe_account_id text;

create unique index if not exists vendors_stripe_account_id_uidx
  on public.vendors (stripe_account_id)
  where stripe_account_id is not null;

comment on column public.vendors.stripe_account_id is
  'Stripe Connect Express account id for catering / marketplace payouts.';

-- ---------------------------------------------------------------------------
-- 2. Farmer Stripe Connect account
-- ---------------------------------------------------------------------------

alter table public.farmers
  add column if not exists stripe_account_id text;

create unique index if not exists farmers_stripe_account_id_uidx
  on public.farmers (stripe_account_id)
  where stripe_account_id is not null;

comment on column public.farmers.stripe_account_id is
  'Stripe Connect Express account id for B2B wholesale settlement destinations.';
