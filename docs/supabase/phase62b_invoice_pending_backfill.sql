-- Vendorly Phase 62b — Backfill PENDING + overdue sweep index
-- Run AFTER phase62a_invoice_status_enum.sql has succeeded (separate execution).

update public.wholesale_invoices
set status = 'PENDING'::public.wholesale_invoice_status
where status::text = 'ISSUED'
  and paid_at is null;

comment on type public.wholesale_invoice_status is
  'Wholesale invoice AR states: ISSUED (legacy), PENDING, OVERDUE, PAID, VOID.';

create index if not exists wholesale_invoices_pending_due_idx
  on public.wholesale_invoices (due_at)
  where status = 'PENDING'::public.wholesale_invoice_status;
