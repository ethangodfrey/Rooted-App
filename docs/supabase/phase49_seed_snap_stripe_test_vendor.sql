-- Vendorly Phase 49 — local smoke-test seed (Supabase SQL Editor)
-- Prerequisites: phase32 + phase49 applied; replace :vendor_id with a real approved vendor UUID.
--
-- Product-language → actual columns:
--   stripe_connect_id            → stripe_account_id
--   stripe_onboarding_completed  → stripe_charges_enabled (+ non-null stripe_account_id)
--   payment_policy = 'choice'    → preorder_payment_policy = 'pickup_or_stripe'

-- 1) Pick a vendor (or paste a UUID into the updates below)
-- select id, business_name, approval_status
-- from public.vendors
-- where approval_status = 'approved'
-- order by updated_at desc
-- limit 10;

-- 2) Mark booth Stripe-ready + shopper choice + SNAP discovery
update public.vendors
set
  stripe_account_id = coalesce(nullif(stripe_account_id, ''), 'acct_phase49_test'),
  stripe_charges_enabled = true,
  stripe_payouts_enabled = true,
  preorder_payment_policy = 'pickup_or_stripe', -- Let Shopper Choose (Pay Now or Pay at Pickup)
  accepts_snap_ebt = true,
  updated_at = now()
where id = '00000000-0000-0000-0000-000000000000'::uuid; -- ← replace

-- 3) Tag active SKUs as SNAP/EBT eligible (emerald badges / filters)
update public.products
set
  is_snap_eligible = true,
  updated_at = now()
where vendor_id = '00000000-0000-0000-0000-000000000000'::uuid -- ← same vendor
  and status = 'active';

-- 4) Sanity check
-- select
--   v.id,
--   v.business_name,
--   v.stripe_account_id,
--   v.stripe_charges_enabled,
--   v.preorder_payment_policy,
--   v.accepts_snap_ebt,
--   count(p.id) filter (where p.is_snap_eligible) as snap_skus
-- from public.vendors v
-- left join public.products p on p.vendor_id = v.id
-- where v.id = '00000000-0000-0000-0000-000000000000'::uuid
-- group by v.id;
