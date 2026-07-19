-- Vendorly Phase 60 — Wholesale Invoice Generation & Net-Terms Ledger
-- Run in Supabase SQL Editor after phase59_wholesale_delivery_settlement.sql.
--
-- Introduces:
--   * wholesale_invoices — formal Net-30 billing records linked to settled orders
-- Telemetry: WHOLESALE_INVOICE_GENERATED, BILLING_LEDGER_UPDATED

-- ---------------------------------------------------------------------------
-- A. Enums
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.wholesale_invoice_status as enum (
    'ISSUED',
    'PAID',
    'VOID'
  );
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- B. Wholesale invoices (B2B invoices table)
-- ---------------------------------------------------------------------------
create table if not exists public.wholesale_invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.wholesale_orders (id) on delete cascade,
  settlement_log_id uuid unique references public.wholesale_settlement_logs (id) on delete set null,
  invoice_number text not null unique,
  buyer_vendor_id uuid not null references public.vendors (id) on delete cascade,
  seller_vendor_id uuid not null references public.vendors (id) on delete cascade,
  buyer_business_name text,
  seller_business_name text,
  currency text not null default 'USD',
  subtotal_cents integer not null
    check (subtotal_cents >= 0),
  total_cents integer not null
    check (total_cents >= 0),
  payment_terms text not null default 'NET_30',
  line_items jsonb not null default '[]'::jsonb,
  status public.wholesale_invoice_status not null default 'ISSUED',
  issued_at timestamptz not null default now(),
  due_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.wholesale_invoices is
  'Formal B2B wholesale invoices generated on ORDER_DELIVERY_CONFIRMED with Net-30 terms.';

create index if not exists wholesale_invoices_buyer_idx
  on public.wholesale_invoices (buyer_vendor_id, issued_at desc);

create index if not exists wholesale_invoices_seller_idx
  on public.wholesale_invoices (seller_vendor_id, issued_at desc);

create index if not exists wholesale_invoices_due_idx
  on public.wholesale_invoices (due_at, status);

create or replace function public.set_wholesale_invoices_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wholesale_invoices_set_updated_at
  on public.wholesale_invoices;
create trigger wholesale_invoices_set_updated_at
  before update on public.wholesale_invoices
  for each row execute function public.set_wholesale_invoices_updated_at();

-- ---------------------------------------------------------------------------
-- C. RLS — buyer or seller may read; inserts via service role / Nest
-- ---------------------------------------------------------------------------
alter table public.wholesale_invoices enable row level security;

drop policy if exists "B2B vendors read own wholesale invoices"
  on public.wholesale_invoices;
create policy "B2B vendors read own wholesale invoices"
  on public.wholesale_invoices for select
  using (
    exists (
      select 1 from public.vendors v
      where v.user_id = auth.uid()
        and (v.id = buyer_vendor_id or v.id = seller_vendor_id)
    )
  );

drop policy if exists "B2B buyers insert wholesale invoices"
  on public.wholesale_invoices;
create policy "B2B buyers insert wholesale invoices"
  on public.wholesale_invoices for insert
  with check (
    exists (
      select 1 from public.vendors v
      where v.user_id = auth.uid()
        and v.id = buyer_vendor_id
    )
  );
