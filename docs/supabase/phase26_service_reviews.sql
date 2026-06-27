-- Vendorly Marketplace — Phase 26 (Service-level reviews)
-- Run in Supabase SQL Editor after phase23_vendorly_enhanced.sql
--
-- Safe to RE-RUN: additive only (add column if not exists, drop/recreate
-- constraints with drop-if-exists, create index if not exists).
-- Extends the unified reviews table so a review can target an individual
-- chef service (public.chef_services), not just the chef as a whole.

-- ---------------------------------------------------------------------------
-- 1. service_id column
-- ---------------------------------------------------------------------------
alter table public.reviews
  add column if not exists service_id uuid references public.chef_services (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 2. Allow 'service' as a target_type
--    (inline column check is auto-named reviews_target_type_check)
-- ---------------------------------------------------------------------------
alter table public.reviews
  drop constraint if exists reviews_target_type_check;
alter table public.reviews
  add constraint reviews_target_type_check
  check (target_type in ('vendor', 'chef', 'product', 'service'));

-- ---------------------------------------------------------------------------
-- 3. Tighten reviews_valid_target so each target_type requires its own id
--    and forbids the others (service reviews require service_id).
-- ---------------------------------------------------------------------------
alter table public.reviews
  drop constraint if exists reviews_valid_target;
alter table public.reviews
  add constraint reviews_valid_target check (
    (target_type = 'vendor' and vendor_id is not null and chef_id is null and product_id is null and service_id is null)
    or (target_type = 'chef' and chef_id is not null and vendor_id is null and product_id is null and service_id is null)
    or (target_type = 'product' and product_id is not null and vendor_id is null and chef_id is null and service_id is null)
    or (target_type = 'service' and service_id is not null and vendor_id is null and chef_id is null and product_id is null)
  );

-- ---------------------------------------------------------------------------
-- 4. Index for service review lookups
-- ---------------------------------------------------------------------------
create index if not exists reviews_service_idx
  on public.reviews (service_id)
  where service_id is not null;

-- ---------------------------------------------------------------------------
-- 5. RLS — existing reviews policies are generic over the table:
--      "Public read approved reviews"  (moderation_status = 'approved')
--      "Reviewers read own reviews"    (auth.uid() = reviewer_id)
--      "Customers insert reviews"      (auth.uid() = reviewer_id)
--    These already cover service reviews; no target-type-specific policy is
--    required. Re-affirm public read idempotently so this file is sufficient
--    on a fresh-ish DB.
-- ---------------------------------------------------------------------------
drop policy if exists "Public read approved reviews" on public.reviews;
create policy "Public read approved reviews"
  on public.reviews for select using (moderation_status = 'approved');

drop policy if exists "Customers insert reviews" on public.reviews;
create policy "Customers insert reviews"
  on public.reviews for insert with check (auth.uid() = reviewer_id);

comment on column public.reviews.service_id is 'Vendorly phase26 — target chef_services.id for service-level reviews';
