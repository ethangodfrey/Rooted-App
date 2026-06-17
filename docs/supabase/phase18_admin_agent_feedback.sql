-- Rooted Phase 18: AI admin feedback loop
-- Run in Supabase SQL Editor after phase17_admin_agent.sql.
-- Records when admins approve/reject vs what the AI suggested, so future reviews learn.

create table if not exists public.vendor_review_feedback (
  id                 uuid primary key default gen_random_uuid(),
  suggestion_id      uuid references public.vendor_review_suggestions (id) on delete set null,
  vendor_id          uuid not null references public.vendors (id) on delete cascade,
  admin_user_id      uuid not null references public.users (id) on delete cascade,
  ai_recommendation  text
    check (ai_recommendation is null or ai_recommendation in ('approve', 'reject', 'needs_review')),
  admin_action       text not null
    check (admin_action in ('approved', 'rejected')),
  outcome            text not null
    check (outcome in ('accepted', 'overridden', 'no_ai_suggestion')),
  notes              text,
  vendor_snapshot    jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

create index if not exists vendor_review_feedback_created_idx
  on public.vendor_review_feedback (created_at desc);

create index if not exists vendor_review_feedback_outcome_idx
  on public.vendor_review_feedback (outcome, created_at desc);

alter table public.vendor_review_feedback enable row level security;

create policy "Admins read vendor review feedback"
  on public.vendor_review_feedback for select
  using (public.is_admin());

create policy "Admins insert vendor review feedback"
  on public.vendor_review_feedback for insert
  with check (public.is_admin() and admin_user_id = auth.uid());
