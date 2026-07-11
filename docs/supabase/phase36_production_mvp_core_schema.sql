-- Vendorly Phase 36 — Production MVP core marketplace schema
-- Run in Supabase SQL Editor after phase35_search_event_schedule.sql.
--
-- Safe to RE-RUN (columns use IF NOT EXISTS; policies use DROP IF EXISTS).
-- This phase is additive: it preserves the existing Rooted reservation flow
-- (`orders.order_status`, `posts.caption`) while adding the MVP transaction,
-- certification, media-feed, and vendor-profile fields needed by newer clients.

-- ---------------------------------------------------------------------------
-- A. Vendor profile extensions
-- ---------------------------------------------------------------------------
alter table public.vendors
  add column if not exists portfolio_gallery text[] not null default '{}',
  add column if not exists payouts_enabled boolean not null default false;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vendors'
      and column_name = 'stripe_payouts_enabled'
  ) then
    execute 'update public.vendors set payouts_enabled = stripe_payouts_enabled where payouts_enabled = false';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- B. Posts compatibility extensions
-- ---------------------------------------------------------------------------
alter table public.posts
  add column if not exists content text;

update public.posts
set content = caption
where content is null
  and caption is not null;

alter table public.posts
  add column if not exists media_type text not null default 'image';

alter table public.posts drop constraint if exists posts_media_type_check;
alter table public.posts
  add constraint posts_media_type_check
  check (media_type in ('image', 'video'));

create index if not exists posts_vendor_idx on public.posts (vendor_id);

-- ---------------------------------------------------------------------------
-- C. Vendor certifications
-- ---------------------------------------------------------------------------
create table if not exists public.vendor_certifications (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  cert_name text not null,
  issuing_body text,
  cert_number text,
  expiration_date date,
  document_url text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vendor_certifications_vendor_idx
  on public.vendor_certifications (vendor_id);

create index if not exists vendor_certifications_status_idx
  on public.vendor_certifications (status, expiration_date);

alter table public.vendor_certifications enable row level security;

drop policy if exists "Vendors manage own certifications" on public.vendor_certifications;
create policy "Vendors manage own certifications"
  on public.vendor_certifications for all
  using (vendor_id in (select id from public.vendors where user_id = auth.uid()))
  with check (vendor_id in (select id from public.vendors where user_id = auth.uid()));

drop policy if exists "Admins read vendor certifications" on public.vendor_certifications;
create policy "Admins read vendor certifications"
  on public.vendor_certifications for select using (public.is_admin());

drop policy if exists "Admins update vendor certifications" on public.vendor_certifications;
create policy "Admins update vendor certifications"
  on public.vendor_certifications for update using (public.is_admin());

-- ---------------------------------------------------------------------------
-- D. Global checkout transactions
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.users (id) on delete cascade,
  stripe_payment_intent_id text,
  total_amount integer not null check (total_amount >= 0),
  status text not null default 'authorized'
    check (status in ('authorized', 'captured', 'refunded')),
  created_at timestamptz not null default now()
);

create unique index if not exists transactions_stripe_payment_intent_uidx
  on public.transactions (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create index if not exists transactions_customer_created_idx
  on public.transactions (customer_id, created_at desc);

alter table public.transactions enable row level security;

drop policy if exists "Customers read own transactions" on public.transactions;
create policy "Customers read own transactions"
  on public.transactions for select using (auth.uid() = customer_id);

drop policy if exists "Customers insert own transactions" on public.transactions;
create policy "Customers insert own transactions"
  on public.transactions for insert with check (auth.uid() = customer_id);

drop policy if exists "Admins read all transactions" on public.transactions;
create policy "Admins read all transactions"
  on public.transactions for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- E. Vendor sub-order fields
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists transaction_id uuid references public.transactions (id) on delete set null,
  add column if not exists platform_fee integer not null default 0 check (platform_fee >= 0),
  add column if not exists pickup_code text,
  add column if not exists fulfillment_window_start timestamptz,
  add column if not exists fulfillment_window_end timestamptz;

create index if not exists orders_transaction_idx
  on public.orders (transaction_id)
  where transaction_id is not null;

create unique index if not exists orders_pickup_code_uidx
  on public.orders (pickup_code)
  where pickup_code is not null;

alter table public.orders drop constraint if exists orders_pickup_code_format_check;
alter table public.orders
  add constraint orders_pickup_code_format_check
  check (pickup_code is null or pickup_code ~ '^[A-Z0-9]{6}$');

alter table public.orders drop constraint if exists orders_order_status_check;
alter table public.orders
  add constraint orders_order_status_check
  check (order_status in (
    'submitted', 'pending_review', 'accepted', 'declined',
    'preparing', 'ready_for_pickup', 'fulfilled', 'cancelled',
    'pending', 'completed', 'canceled'
  ));

comment on column public.posts.content is
  'MVP feed body. Existing clients may continue writing caption; content is backfilled from caption.';
comment on column public.vendors.portfolio_gallery is
  'Vendor profile portfolio media URLs for the production MVP.';
comment on column public.vendors.payouts_enabled is
  'Marketplace payout eligibility flag, mirrored from Stripe Connect status when available.';
comment on table public.transactions is
  'Global customer checkout transaction grouping one or more vendor sub-orders.';
