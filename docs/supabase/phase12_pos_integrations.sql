-- Rooted Phase 12: POS integrations support
-- Run in Supabase SQL Editor after phase11_analytics.sql.
--
-- The POS_* tables themselves are owned/migrated by the NestJS/Prisma backend
-- (see backend/prisma/schema.prisma + `prisma migrate`). This file only patches
-- the EXISTING Supabase-managed tables so imported card sales can flow into the
-- live analytics that the mobile app already reads.

-- 1) Allow the POS sale transaction type written by the backend importer.
alter table public.inventory_transactions
  drop constraint if exists inventory_transactions_transaction_type_check;

alter table public.inventory_transactions
  add constraint inventory_transactions_transaction_type_check
  check (transaction_type in (
    'sale_digital',
    'sale_manual',
    'sale_pos',
    'adjustment',
    'restock'
  ));

-- 2) Helpful index for POS source lookups / idempotency audits.
create index if not exists inv_tx_source_idx
  on public.inventory_transactions (source);

-- NOTE: The backend service account connects with a role that bypasses RLS
-- (service_role / a dedicated app role). If you instead use RLS-bound access,
-- add policies allowing the backend to insert inventory_transactions and upsert
-- analytics_snapshots on behalf of any vendor.
