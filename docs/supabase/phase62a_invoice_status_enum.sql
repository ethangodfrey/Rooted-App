-- Vendorly Phase 62a — Add PENDING + OVERDUE enum values
-- Run ALONE in Supabase SQL Editor (commit before 62b).
-- After success, run phase62b_invoice_pending_backfill.sql.

alter type public.wholesale_invoice_status
  add value if not exists 'PENDING';

alter type public.wholesale_invoice_status
  add value if not exists 'OVERDUE';
