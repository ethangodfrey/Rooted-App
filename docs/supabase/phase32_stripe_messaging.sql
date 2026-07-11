-- Vendorly Phase 32 — Stripe Connect + in-app messaging foundation
-- Run in Supabase SQL Editor after phase31_leftovers_search.sql
--
-- Safe to RE-RUN (policies use DROP IF EXISTS; columns use IF NOT EXISTS).
-- Stripe columns support Connect onboarding + Checkout prepay on orders.
-- Messaging uses Supabase Realtime from mobile/web clients (RLS below).

-- ---------------------------------------------------------------------------
-- A. Stripe Connect — vendor + chef payout accounts
-- ---------------------------------------------------------------------------
alter table public.vendors
  add column if not exists stripe_account_id text,
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_payouts_enabled boolean not null default false;

create unique index if not exists vendors_stripe_account_id_uidx
  on public.vendors (stripe_account_id)
  where stripe_account_id is not null;

alter table public.chefs
  add column if not exists stripe_account_id text,
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_payouts_enabled boolean not null default false;

create unique index if not exists chefs_stripe_account_id_uidx
  on public.chefs (stripe_account_id)
  where stripe_account_id is not null;

-- ---------------------------------------------------------------------------
-- B. Orders — online prepay via Stripe Checkout
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text;

create unique index if not exists orders_stripe_checkout_session_uidx
  on public.orders (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

alter table public.orders drop constraint if exists orders_payment_status_check;

alter table public.orders
  add constraint orders_payment_status_check
  check (payment_status in ('unpaid', 'paid_at_pickup', 'stripe_pending', 'paid_online'));

-- ---------------------------------------------------------------------------
-- C. Chef bookings — Stripe deposit / full payment
-- ---------------------------------------------------------------------------
alter table public.chef_bookings
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text;

alter table public.chef_bookings drop constraint if exists chef_bookings_payment_status_check;

alter table public.chef_bookings
  add constraint chef_bookings_payment_status_check
  check (payment_status in (
    'unpaid', 'deposit_paid', 'paid_in_full',
    'stripe_pending', 'paid_online'
  ));

-- ---------------------------------------------------------------------------
-- D. Messaging — threads + messages (Supabase Realtime from clients)
-- ---------------------------------------------------------------------------
create table if not exists public.conversation_threads (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references public.users (id) on delete cascade,
  vendor_id uuid references public.vendors (id) on delete set null,
  chef_id uuid references public.chefs (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  booking_id uuid references public.chef_bookings (id) on delete set null,
  subject text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint conversation_threads_one_counterparty_chk check (
    (vendor_id is not null)::int + (chef_id is not null)::int = 1
  )
);

create index if not exists conversation_threads_customer_idx
  on public.conversation_threads (customer_user_id, last_message_at desc);

create index if not exists conversation_threads_vendor_idx
  on public.conversation_threads (vendor_id, last_message_at desc)
  where vendor_id is not null;

create index if not exists conversation_threads_chef_idx
  on public.conversation_threads (chef_id, last_message_at desc)
  where chef_id is not null;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.conversation_threads (id) on delete cascade,
  sender_user_id uuid not null references public.users (id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists messages_thread_created_idx
  on public.messages (thread_id, created_at asc);

alter table public.conversation_threads enable row level security;
alter table public.messages enable row level security;

-- Thread visibility: customer, counterparty vendor/chef, or admin
drop policy if exists "Participants read conversation threads" on public.conversation_threads;
create policy "Participants read conversation threads"
  on public.conversation_threads for select
  using (
    auth.uid() = customer_user_id
    or vendor_id in (select id from public.vendors where user_id = auth.uid())
    or chef_id in (select id from public.chefs where user_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists "Customers create conversation threads" on public.conversation_threads;
create policy "Customers create conversation threads"
  on public.conversation_threads for insert
  with check (auth.uid() = customer_user_id);

drop policy if exists "Participants update conversation threads" on public.conversation_threads;
create policy "Participants update conversation threads"
  on public.conversation_threads for update
  using (
    auth.uid() = customer_user_id
    or vendor_id in (select id from public.vendors where user_id = auth.uid())
    or chef_id in (select id from public.chefs where user_id = auth.uid())
  );

drop policy if exists "Participants read messages" on public.messages;
create policy "Participants read messages"
  on public.messages for select
  using (
    thread_id in (
      select id from public.conversation_threads
      where customer_user_id = auth.uid()
         or vendor_id in (select id from public.vendors where user_id = auth.uid())
         or chef_id in (select id from public.chefs where user_id = auth.uid())
         or public.is_admin()
    )
  );

drop policy if exists "Participants insert messages" on public.messages;
create policy "Participants insert messages"
  on public.messages for insert
  with check (
    auth.uid() = sender_user_id
    and thread_id in (
      select id from public.conversation_threads
      where customer_user_id = auth.uid()
         or vendor_id in (select id from public.vendors where user_id = auth.uid())
         or chef_id in (select id from public.chefs where user_id = auth.uid())
    )
  );

-- Bump thread timestamp when a message is posted (for inbox sorting)
create or replace function public.bump_conversation_thread_last_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.conversation_threads
  set last_message_at = new.created_at
  where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists messages_bump_thread on public.messages;
create trigger messages_bump_thread
  after insert on public.messages
  for each row execute function public.bump_conversation_thread_last_message();

-- Realtime: clients subscribe with supabase.channel('messages:thread_id').on('postgres_changes', ...)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
