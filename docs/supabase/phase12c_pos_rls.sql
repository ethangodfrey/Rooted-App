-- Rooted Phase 12c: POS table Row Level Security hardening
-- Run in Supabase SQL Editor AFTER phase12b_pos_tables.sql.
--
-- The pos_* tables are written and read only by the NestJS backend, which
-- connects with the database `postgres` role (direct/session connection).
-- That role bypasses RLS, so the backend is unaffected.
--
-- The mobile app never queries pos_* via PostgREST; it uses the backend REST
-- API with a Supabase JWT. Enabling RLS here with NO policies blocks the
-- anon/authenticated Supabase API roles from reading or writing POS data
-- (including encrypted credentials in pos_credentials).
--
-- If you later need vendor-scoped read access through PostgREST, add explicit
-- policies per table — do not leave these tables wide open.

BEGIN;

alter table public.pos_connections enable row level security;
alter table public.pos_credentials enable row level security;
alter table public.pos_sync_runs enable row level security;
alter table public.pos_imported_transactions enable row level security;
alter table public.pos_imported_line_items enable row level security;
alter table public.pos_product_mappings enable row level security;
alter table public.pos_location_mappings enable row level security;
alter table public.pos_webhook_events enable row level security;
alter table public.pos_sync_errors enable row level security;

COMMIT;
