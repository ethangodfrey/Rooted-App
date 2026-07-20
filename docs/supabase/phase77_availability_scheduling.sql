-- Phase 77 — Automated Availability Scheduling (Phase 2)
-- Apply after phase75 (vendor_availability) and phase72 (catering_inquiries).
--
-- Extends catering_inquiries for conflict detection:
--   status PENDING_REVIEW
--   conflict_detected + conflict_warning

-- ---------------------------------------------------------------------------
-- 1. Allow PENDING_REVIEW on catering inquiries
-- ---------------------------------------------------------------------------

alter table public.catering_inquiries
  drop constraint if exists catering_inquiries_status_check;

alter table public.catering_inquiries
  add constraint catering_inquiries_status_check
  check (status in ('OPEN', 'REPLIED', 'CLOSED', 'PENDING_REVIEW'));

alter table public.catering_inquiries
  add column if not exists conflict_detected boolean not null default false;

alter table public.catering_inquiries
  add column if not exists conflict_warning text;

comment on column public.catering_inquiries.conflict_detected is
  'True when event_date overlaps a vendor_availability block (Conflict Detected).';

comment on column public.catering_inquiries.conflict_warning is
  'Human-readable conflict note for vendor dashboard (e.g. Conflict Detected).';

create index if not exists catering_inquiries_pending_review_idx
  on public.catering_inquiries (vendor_id, created_at desc)
  where status = 'PENDING_REVIEW';

-- ---------------------------------------------------------------------------
-- 2. Public read of blocked dates (for Request Catering modal)
-- ---------------------------------------------------------------------------

drop policy if exists "Public read vendor availability blocks" on public.vendor_availability;
create policy "Public read vendor availability blocks"
  on public.vendor_availability for select
  to authenticated, anon
  using (true);
