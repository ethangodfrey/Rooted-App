-- Vendorly Phase 49 — preorder payment policy + SNAP/EBT discovery flags
-- Apply after phase32 (Stripe Connect columns on vendors).

-- Vendor: how online pre-orders can be paid
alter table public.vendors
  add column if not exists preorder_payment_policy text not null default 'pickup_or_stripe';

alter table public.vendors drop constraint if exists vendors_preorder_payment_policy_check;
alter table public.vendors
  add constraint vendors_preorder_payment_policy_check
  check (preorder_payment_policy in ('pickup_only', 'stripe_only', 'pickup_or_stripe'));

-- Vendor: booth accepts SNAP/EBT (discovery filter)
alter table public.vendors
  add column if not exists accepts_snap_ebt boolean not null default false;

-- Product: SKU-level SNAP eligibility badge / filters
alter table public.products
  add column if not exists is_snap_eligible boolean not null default false;

-- Backfill booth SNAP from theme_settings.payment_methods when present
update public.vendors
set accepts_snap_ebt = true
where accepts_snap_ebt = false
  and coalesce(theme_settings::text, '') ilike '%SNAP%';

create index if not exists vendors_accepts_snap_ebt_idx
  on public.vendors (accepts_snap_ebt)
  where accepts_snap_ebt = true;

create index if not exists products_is_snap_eligible_idx
  on public.products (is_snap_eligible)
  where is_snap_eligible = true;

comment on column public.vendors.preorder_payment_policy is
  'Phase 49: pickup_only | stripe_only | pickup_or_stripe — gates cart payment CTAs.';
comment on column public.vendors.accepts_snap_ebt is
  'Phase 49: vendor booth accepts SNAP/EBT (discovery); EBT still runs on booth terminal.';
comment on column public.products.is_snap_eligible is
  'Phase 49: product is SNAP/EBT eligible for shopper discovery badges.';
