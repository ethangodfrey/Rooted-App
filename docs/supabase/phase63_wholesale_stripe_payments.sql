-- Vendorly Phase 63 — Wholesale Stripe PaymentIntent bridge
-- Run in Supabase SQL Editor after phase62 (PENDING/OVERDUE).
--
-- Extends:
--   * wholesale_order_status — PAYMENT_SETTLED
--   * wholesale_invoices.stripe_payment_intent_id / stripe_payment_status
-- Telemetry: PAYMENT_INTENT_CREATED, FUNDS_SETTLED, PAYMENT_SETTLED

-- ---------------------------------------------------------------------------
-- A. Order lifecycle: delivery confirmed → funds settled
-- ---------------------------------------------------------------------------
alter type public.wholesale_order_status
  add value if not exists 'PAYMENT_SETTLED';

-- ---------------------------------------------------------------------------
-- B. Invoice ↔ Stripe PaymentIntent linkage
-- ---------------------------------------------------------------------------
alter table public.wholesale_invoices
  add column if not exists stripe_payment_intent_id text;

alter table public.wholesale_invoices
  add column if not exists stripe_payment_status text;

comment on column public.wholesale_invoices.stripe_payment_intent_id is
  'Stripe PaymentIntent id created on ORDER_DELIVERY_CONFIRMED for Connect payout.';

comment on column public.wholesale_invoices.stripe_payment_status is
  'Stripe PaymentIntent status mirror (e.g. requires_payment_method, succeeded).';

create unique index if not exists wholesale_invoices_stripe_pi_uidx
  on public.wholesale_invoices (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
