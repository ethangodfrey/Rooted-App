-- Vendorly Phase 45: POS webhook audit log + normalized analytics_sales.
--
-- Complements phase43 `pos_transactions` (ledger) and phase44 `market_sales_snapshots`
-- with:
--   • pos_webhook_logs — immutable raw payload audit for every inbound sales webhook
--   • analytics_sales  — processed financial rows (net, tax, fees, status, location)
--
-- Apply after phase44c_national_harvester_pos_analytics_rls.sql.
-- Idempotent: safe to re-run in the Supabase SQL Editor.
-- Service-role (workers / edge) bypasses RLS for inserts.

begin;

-- ---------------------------------------------------------------------------
-- A. pos_webhook_logs — raw JSON audit trail
-- ---------------------------------------------------------------------------

create table if not exists public.pos_webhook_logs (
  id                   uuid primary key default gen_random_uuid(),
  provider             public.pos_integration_provider not null,
  provider_event_id    text,
  event_type           text,
  signature_valid      boolean,
  accepted             boolean not null default false,
  http_status          integer,
  provider_merchant_id text,
  provider_location_id text,
  vendor_id            uuid references public.vendors (id) on delete set null,
  tenant_id            uuid references public.tenants (id) on delete set null,
  connection_id        uuid references public.vendor_pos_connections (id) on delete set null,
  raw_body             text not null default '',
  raw_payload          jsonb not null default '{}'::jsonb,
  headers              jsonb not null default '{}'::jsonb,
  error_message        text,
  received_at          timestamptz not null default now(),
  created_at           timestamptz not null default now()
);

comment on table public.pos_webhook_logs is
  'Immutable audit log of inbound POS sales webhook payloads (Square/Toast/Clover).';

create index if not exists pos_webhook_logs_received_at_idx
  on public.pos_webhook_logs (received_at desc);

create index if not exists pos_webhook_logs_provider_event_idx
  on public.pos_webhook_logs (provider, provider_event_id);

create index if not exists pos_webhook_logs_vendor_id_idx
  on public.pos_webhook_logs (vendor_id);

create index if not exists pos_webhook_logs_tenant_id_idx
  on public.pos_webhook_logs (tenant_id);

-- ---------------------------------------------------------------------------
-- B. analytics_sales — normalized financial sales rows
-- ---------------------------------------------------------------------------

create table if not exists public.analytics_sales (
  id                      uuid primary key default gen_random_uuid(),
  vendor_id               uuid not null references public.vendors (id) on delete cascade,
  tenant_id               uuid references public.tenants (id) on delete set null,
  connection_id           uuid references public.vendor_pos_connections (id) on delete set null,
  webhook_log_id          uuid references public.pos_webhook_logs (id) on delete set null,
  provider                public.pos_integration_provider not null,
  external_transaction_id text not null,
  provider_location_id    text,
  provider_order_id       text,
  status                  text not null default 'completed'
    check (status in ('completed', 'refunded', 'partially_refunded', 'voided', 'pending')),
  currency                text not null default 'USD',
  gross_sales_cents       bigint not null default 0 check (gross_sales_cents >= 0),
  tax_cents               bigint not null default 0 check (tax_cents >= 0),
  processing_fee_cents    bigint not null default 0 check (processing_fee_cents >= 0),
  platform_fee_cents      bigint not null default 0 check (platform_fee_cents >= 0),
  net_sales_cents         bigint not null default 0,
  tender_type             text,
  sold_at                 timestamptz not null,
  metadata                jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint analytics_sales_provider_external_id_key
    unique (provider, external_transaction_id)
);

comment on table public.analytics_sales is
  'Processed POS sales financial rows for analytics dashboards (complement to pos_transactions ledger).';

create index if not exists analytics_sales_vendor_sold_at_idx
  on public.analytics_sales (vendor_id, sold_at desc);

create index if not exists analytics_sales_tenant_sold_at_idx
  on public.analytics_sales (tenant_id, sold_at desc);

create index if not exists analytics_sales_location_idx
  on public.analytics_sales (provider_location_id);

create index if not exists analytics_sales_status_idx
  on public.analytics_sales (status);

-- ---------------------------------------------------------------------------
-- C. RLS — vendor/tenant isolation (service-role bypasses for workers)
-- ---------------------------------------------------------------------------

alter table public.pos_webhook_logs enable row level security;
alter table public.analytics_sales enable row level security;

-- No anon/authenticated INSERT/UPDATE/DELETE — service-role only for writes.

drop policy if exists vendor_pos_webhook_logs_select_own on public.pos_webhook_logs;
create policy vendor_pos_webhook_logs_select_own
  on public.pos_webhook_logs
  for select
  to authenticated
  using (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
  );

drop policy if exists admin_pos_webhook_logs_select on public.pos_webhook_logs;
create policy admin_pos_webhook_logs_select
  on public.pos_webhook_logs
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists vendor_analytics_sales_select_own on public.analytics_sales;
create policy vendor_analytics_sales_select_own
  on public.analytics_sales
  for select
  to authenticated
  using (
    vendor_id in (select id from public.vendors where user_id = auth.uid())
  );

drop policy if exists admin_analytics_sales_select on public.analytics_sales;
create policy admin_analytics_sales_select
  on public.analytics_sales
  for select
  to authenticated
  using (public.is_admin());

commit;
