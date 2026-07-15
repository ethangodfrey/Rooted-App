-- Vendorly Phase 47: Platform-agnostic POS analytics ingestion schema.
--
-- Maps the analytics dashboard ingestion model onto safe table names:
--   Requested `pos_connections`     → already exists (phase12) + `vendor_pos_connections` (phase43);
--                                    this phase adds a read-oriented view for dashboards.
--   Requested `transactions`        → CANNOT use `public.transactions` (Stripe checkout, phase36);
--                                    created as `public.pos_analytics_transactions`.
--   Requested `transaction_items`   → `public.pos_analytics_transaction_items`.
--
-- Also extends phase43 `pos_transactions` with tax/tip/payment_status and adds
-- `pos_transaction_items` for the existing ledger path used by sales webhooks.
--
-- Apply after phase46_encrypted_credentials.sql.
-- Idempotent: safe to re-run in the Supabase SQL Editor.

begin;

-- ---------------------------------------------------------------------------
-- A. Dashboard-friendly connection projection (no plaintext tokens)
-- ---------------------------------------------------------------------------

create or replace view public.pos_analytics_connections as
select
  vpc.id,
  vpc.vendor_id,
  vpc.provider::text as provider,
  vpc.status,
  vpc.provider_merchant_id,
  vpc.provider_location_id,
  vpc.token_expires_at,
  (vpc.access_token is not null or exists (
    select 1
    from public.encrypted_credentials ec
    where ec.vendor_id = vpc.vendor_id
      and ec.provider = vpc.provider
  )) as has_credentials,
  vpc.created_at,
  vpc.updated_at
from public.vendor_pos_connections vpc;

comment on view public.pos_analytics_connections is
  'Platform-agnostic POS connection projection for analytics (Square/Toast/Clover). Tokens stay in vendor_pos_connections / encrypted_credentials.';

grant select on public.pos_analytics_connections to authenticated;

-- ---------------------------------------------------------------------------
-- B. pos_analytics_transactions — unified sales metadata (cents)
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.pos_analytics_payment_status as enum (
    'pending',
    'completed',
    'refunded',
    'partially_refunded',
    'voided',
    'failed'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.pos_analytics_transactions (
  id                      uuid primary key default gen_random_uuid(),
  external_transaction_id text not null,
  vendor_id               uuid not null references public.vendors (id) on delete cascade,
  pos_connection_id       uuid references public.vendor_pos_connections (id) on delete set null,
  provider                public.pos_integration_provider not null,
  total_amount_cents      bigint not null default 0 check (total_amount_cents >= 0),
  tax_amount_cents        bigint not null default 0 check (tax_amount_cents >= 0),
  tip_amount_cents        bigint not null default 0 check (tip_amount_cents >= 0),
  currency                text not null default 'USD',
  payment_status          public.pos_analytics_payment_status not null default 'completed',
  transaction_created_at  timestamptz not null,
  provider_location_id    text,
  raw_payload             jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint pos_analytics_transactions_provider_external_key
    unique (provider, external_transaction_id)
);

comment on table public.pos_analytics_transactions is
  'Unified POS sales rows for analytics dashboards. Money fields are integer cents. Upsert key: (provider, external_transaction_id).';

create index if not exists pos_analytics_transactions_vendor_created_idx
  on public.pos_analytics_transactions (vendor_id, transaction_created_at desc);

create index if not exists pos_analytics_transactions_connection_idx
  on public.pos_analytics_transactions (pos_connection_id);

create index if not exists pos_analytics_transactions_status_idx
  on public.pos_analytics_transactions (payment_status);

-- Upsert conflict target for ingest: (provider, external_transaction_id)
-- (see constraint pos_analytics_transactions_provider_external_key).

-- ---------------------------------------------------------------------------
-- C. pos_analytics_transaction_items — normalized line items (cents)
-- ---------------------------------------------------------------------------

create table if not exists public.pos_analytics_transaction_items (
  id                   uuid primary key default gen_random_uuid(),
  transaction_id       uuid not null
    references public.pos_analytics_transactions (id) on delete cascade,
  external_item_id     text,
  name                 text not null,
  quantity             numeric(12, 3) not null default 1 check (quantity > 0),
  unit_price_cents     bigint not null default 0,
  total_price_cents    bigint not null default 0,
  provider_catalog_id  text,
  raw_payload          jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.pos_analytics_transaction_items is
  'Itemized line items for pos_analytics_transactions. Money fields are integer cents.';

create index if not exists pos_analytics_transaction_items_txn_idx
  on public.pos_analytics_transaction_items (transaction_id);

create unique index if not exists pos_analytics_transaction_items_txn_external_uidx
  on public.pos_analytics_transaction_items (transaction_id, external_item_id)
  where external_item_id is not null;

-- ---------------------------------------------------------------------------
-- D. Extend phase43 ledger + line items for webhook path parity
-- ---------------------------------------------------------------------------

alter table public.pos_transactions
  add column if not exists tax_amount bigint not null default 0
    check (tax_amount >= 0);

alter table public.pos_transactions
  add column if not exists tip_amount bigint not null default 0
    check (tip_amount >= 0);

alter table public.pos_transactions
  add column if not exists payment_status text not null default 'completed'
    check (payment_status in (
      'pending', 'completed', 'refunded', 'partially_refunded', 'voided', 'failed'
    ));

create table if not exists public.pos_transaction_items (
  id                   uuid primary key default gen_random_uuid(),
  transaction_id       uuid not null
    references public.pos_transactions (id) on delete cascade,
  external_item_id     text,
  name                 text not null,
  quantity             numeric(12, 3) not null default 1 check (quantity > 0),
  unit_price_cents     bigint not null default 0,
  total_price_cents    bigint not null default 0,
  provider_catalog_id  text,
  raw_payload          jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists pos_transaction_items_txn_idx
  on public.pos_transaction_items (transaction_id);

create unique index if not exists pos_transaction_items_txn_external_uidx
  on public.pos_transaction_items (transaction_id, external_item_id)
  where external_item_id is not null;

-- ---------------------------------------------------------------------------
-- E. RLS — vendors read own analytics rows; service-role writes
-- ---------------------------------------------------------------------------

alter table public.pos_analytics_transactions enable row level security;
alter table public.pos_analytics_transaction_items enable row level security;
alter table public.pos_transaction_items enable row level security;

drop policy if exists vendor_pos_analytics_transactions_select_own
  on public.pos_analytics_transactions;
create policy vendor_pos_analytics_transactions_select_own
  on public.pos_analytics_transactions
  for select
  to authenticated
  using (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
  );

drop policy if exists admin_pos_analytics_transactions_select
  on public.pos_analytics_transactions;
create policy admin_pos_analytics_transactions_select
  on public.pos_analytics_transactions
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists vendor_pos_analytics_transaction_items_select_own
  on public.pos_analytics_transaction_items;
create policy vendor_pos_analytics_transaction_items_select_own
  on public.pos_analytics_transaction_items
  for select
  to authenticated
  using (
    transaction_id in (
      select t.id
      from public.pos_analytics_transactions t
      where t.vendor_id in (select id from public.vendors where user_id = auth.uid())
    )
  );

drop policy if exists admin_pos_analytics_transaction_items_select
  on public.pos_analytics_transaction_items;
create policy admin_pos_analytics_transaction_items_select
  on public.pos_analytics_transaction_items
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists vendor_pos_transaction_items_select_own
  on public.pos_transaction_items;
create policy vendor_pos_transaction_items_select_own
  on public.pos_transaction_items
  for select
  to authenticated
  using (
    transaction_id in (
      select t.id
      from public.pos_transactions t
      where t.vendor_id in (select id from public.vendors where user_id = auth.uid())
    )
  );

commit;
