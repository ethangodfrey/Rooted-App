-- Vendorly Phase 39 — payments KYC, escrow, and tax compliance ledger
-- Run in Supabase SQL Editor after phase38_ranked_vendor_feed.sql.

create table if not exists public.vendor_settlements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  transaction_id uuid references public.transactions (id) on delete set null,
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  stripe_payment_intent_id text,
  gross_amount integer not null check (gross_amount >= 0),
  platform_fee integer not null default 0 check (platform_fee >= 0),
  net_amount integer not null check (net_amount >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'available', 'released', 'held')),
  hold_until timestamptz not null default (now() + interval '2 days'),
  created_at timestamptz not null default now(),
  released_at timestamptz
);

create unique index if not exists vendor_settlements_order_uidx
  on public.vendor_settlements (order_id);

create index if not exists vendor_settlements_vendor_status_idx
  on public.vendor_settlements (vendor_id, status, hold_until);

alter table public.vendor_settlements enable row level security;

drop policy if exists "Vendors read own settlements" on public.vendor_settlements;
create policy "Vendors read own settlements"
  on public.vendor_settlements for select
  using (vendor_id in (select id from public.vendors where user_id = auth.uid()));

drop policy if exists "Admins read settlements" on public.vendor_settlements;
create policy "Admins read settlements"
  on public.vendor_settlements for select using (public.is_admin());

create table if not exists public.vendor_tax_compliance (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  tax_year integer not null,
  gross_volume integer not null default 0,
  transaction_count integer not null default 0,
  needs_1099k boolean not null default false,
  threshold_reason text,
  updated_at timestamptz not null default now(),
  unique (vendor_id, tax_year)
);

create index if not exists vendor_tax_compliance_needs_1099k_idx
  on public.vendor_tax_compliance (tax_year, needs_1099k);

alter table public.vendor_tax_compliance enable row level security;

drop policy if exists "Vendors read own tax compliance" on public.vendor_tax_compliance;
create policy "Vendors read own tax compliance"
  on public.vendor_tax_compliance for select
  using (vendor_id in (select id from public.vendors where user_id = auth.uid()));

drop policy if exists "Admins read tax compliance" on public.vendor_tax_compliance;
create policy "Admins read tax compliance"
  on public.vendor_tax_compliance for select using (public.is_admin());

create or replace function public.mark_available_vendor_settlements()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.vendor_settlements
  set status = 'available'
  where status = 'pending'
    and hold_until <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('vendor-settlements-available-hourly');
    perform cron.schedule(
      'vendor-settlements-available-hourly',
      '7 * * * *',
      'select public.mark_available_vendor_settlements();'
    );
  end if;
exception
  when undefined_function then null;
end $$;
