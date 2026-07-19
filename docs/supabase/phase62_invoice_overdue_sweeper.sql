-- Vendorly Phase 62 — Automated Net-30 Compliance & Overdue Sweeper
-- Run in Supabase SQL Editor after phase61_invoice_reconciliation.sql.
--
-- Extends:
--   * wholesale_invoice_status — PENDING (unpaid AR) + OVERDUE
--   * migrates legacy ISSUED unpaid rows → PENDING
-- Telemetry: CRON_SWEEP_EXECUTED, INVOICES_MARKED_OVERDUE
--
-- Note: If UPDATE fails with "unsafe use of new value", re-run section B alone
-- after section A has committed (Postgres enum ADD VALUE same-tx restriction).

-- ---------------------------------------------------------------------------
-- A. Enum: PENDING (AR open) + OVERDUE (past due_at)
-- ---------------------------------------------------------------------------
alter type public.wholesale_invoice_status
  add value if not exists 'PENDING';

alter type public.wholesale_invoice_status
  add value if not exists 'OVERDUE';

-- ---------------------------------------------------------------------------
-- B. Align open invoices with AR PENDING semantics
--    (phase60 created rows as ISSUED; PENDING is the unpaid Net-30 state)
-- ---------------------------------------------------------------------------
update public.wholesale_invoices
set status = 'PENDING'::public.wholesale_invoice_status
where status::text = 'ISSUED'
  and paid_at is null;

comment on type public.wholesale_invoice_status is
  'Wholesale invoice AR states: ISSUED (legacy), PENDING, OVERDUE, PAID, VOID.';

-- ---------------------------------------------------------------------------
-- C. Sweep helper index (status + due_at for daily cron)
-- ---------------------------------------------------------------------------
create index if not exists wholesale_invoices_pending_due_idx
  on public.wholesale_invoices (due_at)
  where status::text = 'PENDING';
