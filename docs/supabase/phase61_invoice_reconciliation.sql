-- Vendorly Phase 61 — Invoice Reconciliation & Payment State Management
-- Run in Supabase SQL Editor after phase60_wholesale_invoices_net_terms.sql.
--
-- Extends:
--   * wholesale_invoices.paid_at — seller payment clearance timestamp
--   * seller update RLS for reconcile-to-PAID
-- Telemetry: INVOICE_MARKED_PAID, LEDGER_RECONCILED

-- ---------------------------------------------------------------------------
-- A. Payment clearance timestamp
-- ---------------------------------------------------------------------------
alter table public.wholesale_invoices
  add column if not exists paid_at timestamptz;

comment on column public.wholesale_invoices.paid_at is
  'Timestamp when seller marked Net-30 invoice PAID after external funds clear.';

create index if not exists wholesale_invoices_paid_idx
  on public.wholesale_invoices (paid_at)
  where paid_at is not null;

create index if not exists wholesale_invoices_status_due_idx
  on public.wholesale_invoices (status, due_at);

-- ---------------------------------------------------------------------------
-- B. Sellers may update their own invoices (mark PAID)
-- ---------------------------------------------------------------------------
drop policy if exists "B2B sellers reconcile wholesale invoices"
  on public.wholesale_invoices;
create policy "B2B sellers reconcile wholesale invoices"
  on public.wholesale_invoices for update
  using (
    exists (
      select 1 from public.vendors v
      where v.user_id = auth.uid()
        and v.id = seller_vendor_id
    )
  )
  with check (
    exists (
      select 1 from public.vendors v
      where v.user_id = auth.uid()
        and v.id = seller_vendor_id
    )
  );
