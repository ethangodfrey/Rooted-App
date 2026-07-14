-- Vendorly Phase 46: encrypted POS OAuth credential vault + token column hardening.
--
-- Design: docs/supabase/PHASE46_ENCRYPTED_CREDENTIALS_DESIGN.md
-- Apply after phase45_pos_webhook_analytics.sql.
-- Idempotent: safe to re-run in the Supabase SQL Editor.

begin;

-- ---------------------------------------------------------------------------
-- vendor_pos_connections — safe display fields (non-secret)
-- ---------------------------------------------------------------------------

alter table public.vendor_pos_connections
  add column if not exists merchant_display_name text;

-- ---------------------------------------------------------------------------
-- encrypted_credentials — AES-256-GCM vault (service-role only)
-- ---------------------------------------------------------------------------

create table if not exists public.encrypted_credentials (
  id                     uuid primary key default gen_random_uuid(),
  vendor_id              uuid not null references public.vendors (id) on delete cascade,
  connection_id          uuid references public.vendor_pos_connections (id) on delete set null,
  provider               public.pos_integration_provider not null,
  square_merchant_id     text,
  provider_location_id   text,
  token_expires_at       timestamptz,
  merchant_display_name  text,
  secret_cipher          text not null,
  cipher_iv              text not null,
  cipher_auth_tag        text not null,
  key_version            integer not null default 1,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint encrypted_credentials_vendor_provider_key
    unique (vendor_id, provider)
);

create index if not exists encrypted_credentials_square_merchant_id_idx
  on public.encrypted_credentials (square_merchant_id)
  where square_merchant_id is not null;

create index if not exists encrypted_credentials_connection_id_idx
  on public.encrypted_credentials (connection_id)
  where connection_id is not null;

create unique index if not exists encrypted_credentials_connection_id_key
  on public.encrypted_credentials (connection_id)
  where connection_id is not null;

alter table public.encrypted_credentials enable row level security;

-- Ciphertext is never exposed to browser keys. service_role bypasses RLS.
revoke all on table public.encrypted_credentials from anon, authenticated;
grant all on table public.encrypted_credentials to service_role;

-- Vendor-readable metadata only (no cipher columns). Filter by ownership.
create or replace function public.list_my_encrypted_credential_status()
returns table (
  id uuid,
  vendor_id uuid,
  connection_id uuid,
  provider public.pos_integration_provider,
  square_merchant_id text,
  provider_location_id text,
  token_expires_at timestamptz,
  merchant_display_name text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ec.id,
    ec.vendor_id,
    ec.connection_id,
    ec.provider,
    ec.square_merchant_id,
    ec.provider_location_id,
    ec.token_expires_at,
    ec.merchant_display_name,
    ec.created_at,
    ec.updated_at
  from public.encrypted_credentials ec
  where ec.vendor_id in (
    select v.id from public.vendors v where v.user_id = auth.uid()
  );
$$;

revoke all on function public.list_my_encrypted_credential_status() from public;
grant execute on function public.list_my_encrypted_credential_status() to authenticated;

-- ---------------------------------------------------------------------------
-- Public connection view — add merchant_display_name; never expose tokens
-- ---------------------------------------------------------------------------

create or replace view public.vendor_pos_connections_public as
select
  id,
  vendor_id,
  user_id,
  provider,
  provider_merchant_id,
  provider_location_id,
  merchant_display_name,
  status,
  token_expires_at,
  created_at,
  updated_at
from public.vendor_pos_connections;

grant select on public.vendor_pos_connections_public to authenticated;

-- ---------------------------------------------------------------------------
-- Harden vendor_pos_connections: strip token columns from authenticated SELECT
-- ---------------------------------------------------------------------------

revoke select on table public.vendor_pos_connections from anon, authenticated;

do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
  into cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'vendor_pos_connections'
    and column_name not in ('access_token', 'refresh_token', 'oauth_state');

  if cols is null or length(cols) = 0 then
    raise exception 'vendor_pos_connections has no grantable columns';
  end if;

  execute format(
    'grant select (%s) on table public.vendor_pos_connections to authenticated',
    cols
  );
end $$;

commit;
