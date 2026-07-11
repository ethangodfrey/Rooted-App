-- Vendorly Phase 41 — Stripe webhook idempotency ledger
-- Run in Supabase SQL Editor after phase40_markets_image_url.sql.

create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  status text not null check (status in ('processed', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists stripe_webhook_events_created_at_idx
  on public.stripe_webhook_events (created_at desc);

alter table public.stripe_webhook_events enable row level security;

comment on table public.stripe_webhook_events is
  'Idempotency + audit log for Stripe webhook deliveries processed by the NestJS API.';
