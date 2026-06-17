-- Rooted Phase 12b: POS integration tables (Supabase-safe).
--
-- Creates ONLY the new pos_* enums, tables, indexes, and foreign keys. It makes
-- NO changes to existing tables (vendors/products/events/etc.), so it is safe to
-- run directly against the shared Supabase database — unlike `prisma migrate`,
-- which would try to manage the whole schema.
--
-- Order of operations:
--   1) phase12_pos_integrations.sql  (patches existing tables: sale_pos type)
--   2) phase12b_pos_tables.sql       (this file: creates pos_* tables)
--   3) phase12c_pos_rls.sql          (enables RLS on pos_* tables, no policies)
--
-- This file is IDEMPOTENT: safe to re-run in the Supabase SQL Editor if a prior
-- attempt partially applied (duplicate enums/tables/indexes/constraints are skipped).
--
-- Generated via:
--   prisma migrate diff --from-schema-datamodel <existing-only> \
--     --to-schema-datamodel schema.prisma --script
-- Regenerate after schema changes; review before applying to production.

BEGIN;

-- ---------------------------------------------------------------------------
-- Enums (defensive: skip if already created)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE "PosProvider" AS ENUM ('SQUARE', 'TOAST', 'CLOVER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PosAuthType" AS ENUM ('OAUTH', 'API_KEY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PosConnectionStatus" AS ENUM ('PENDING', 'ACTIVE', 'ERROR', 'EXPIRED', 'DISCONNECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PosSyncTrigger" AS ENUM ('MANUAL', 'SCHEDULED', 'WEBHOOK', 'BACKFILL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PosSyncStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PosTransactionState" AS ENUM ('COMPLETED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'VOIDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PosWebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PosErrorScope" AS ENUM ('CONNECTION', 'SYNC', 'IMPORT', 'WEBHOOK', 'MAPPING');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "pos_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vendor_id" UUID NOT NULL,
    "provider" "PosProvider" NOT NULL,
    "auth_type" "PosAuthType" NOT NULL,
    "status" "PosConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "display_name" TEXT,
    "provider_merchant_id" TEXT,
    "provider_location_id" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "webhook_secret" TEXT,
    "oauth_state" TEXT,
    "last_synced_at" TIMESTAMPTZ(6),
    "last_cursor" TEXT,
    "sync_frequency_minutes" INTEGER NOT NULL DEFAULT 60,
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pos_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pos_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "connection_id" UUID NOT NULL,
    "secret_cipher" TEXT NOT NULL,
    "cipher_iv" TEXT NOT NULL,
    "cipher_auth_tag" TEXT NOT NULL,
    "key_version" INTEGER NOT NULL DEFAULT 1,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pos_credentials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pos_sync_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "connection_id" UUID NOT NULL,
    "trigger" "PosSyncTrigger" NOT NULL,
    "status" "PosSyncStatus" NOT NULL DEFAULT 'QUEUED',
    "window_start" TIMESTAMPTZ(6),
    "window_end" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "cursor_start" TEXT,
    "cursor_end" TEXT,
    "transactions_fetched" INTEGER NOT NULL DEFAULT 0,
    "transactions_imported" INTEGER NOT NULL DEFAULT 0,
    "transactions_skipped" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "job_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pos_imported_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "connection_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "sync_run_id" UUID,
    "provider" "PosProvider" NOT NULL,
    "provider_transaction_id" TEXT NOT NULL,
    "provider_order_id" TEXT,
    "provider_location_id" TEXT,
    "state" "PosTransactionState" NOT NULL DEFAULT 'COMPLETED',
    "sold_at" TIMESTAMPTZ(6) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "gross_amount" INTEGER NOT NULL,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "tax_amount" INTEGER NOT NULL DEFAULT 0,
    "tip_amount" INTEGER NOT NULL DEFAULT 0,
    "net_amount" INTEGER NOT NULL,
    "tender_type" TEXT,
    "card_brand" TEXT,
    "event_id" UUID,
    "raw_payload" JSONB NOT NULL,
    "imported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_imported_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pos_imported_line_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transaction_id" UUID NOT NULL,
    "provider_line_item_id" TEXT,
    "provider_catalog_object_id" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" INTEGER NOT NULL,
    "gross_amount" INTEGER NOT NULL,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "tax_amount" INTEGER NOT NULL DEFAULT 0,
    "product_id" UUID,
    "inventory_transaction_id" UUID,
    "raw_payload" JSONB,

    CONSTRAINT "pos_imported_line_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pos_product_mappings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "connection_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "provider" "PosProvider" NOT NULL,
    "provider_catalog_object_id" TEXT NOT NULL,
    "provider_item_name" TEXT,
    "product_id" UUID,
    "auto_matched" BOOLEAN NOT NULL DEFAULT false,
    "ignored" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pos_product_mappings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pos_location_mappings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "connection_id" UUID NOT NULL,
    "provider" "PosProvider" NOT NULL,
    "provider_location_id" TEXT NOT NULL,
    "provider_location_name" TEXT,
    "event_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pos_location_mappings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pos_webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "connection_id" UUID,
    "provider" "PosProvider" NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "status" "PosWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "signature_valid" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    "error" TEXT,

    CONSTRAINT "pos_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pos_sync_errors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "connection_id" UUID NOT NULL,
    "sync_run_id" UUID,
    "scope" "PosErrorScope" NOT NULL,
    "code" TEXT,
    "message" TEXT NOT NULL,
    "provider_reference" TEXT,
    "payload" JSONB,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_sync_errors_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "pos_connections_status_idx" ON "pos_connections"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "pos_connections_vendor_id_provider_provider_merchant_id_key" ON "pos_connections"("vendor_id", "provider", "provider_merchant_id");

CREATE UNIQUE INDEX IF NOT EXISTS "pos_credentials_connection_id_key" ON "pos_credentials"("connection_id");

CREATE INDEX IF NOT EXISTS "pos_sync_runs_connection_id_status_idx" ON "pos_sync_runs"("connection_id", "status");

CREATE INDEX IF NOT EXISTS "pos_imported_transactions_vendor_id_sold_at_idx" ON "pos_imported_transactions"("vendor_id", "sold_at");

CREATE UNIQUE INDEX IF NOT EXISTS "pos_imported_transactions_connection_id_provider_transactio_key" ON "pos_imported_transactions"("connection_id", "provider_transaction_id");

CREATE UNIQUE INDEX IF NOT EXISTS "pos_imported_line_items_inventory_transaction_id_key" ON "pos_imported_line_items"("inventory_transaction_id");

CREATE INDEX IF NOT EXISTS "pos_imported_line_items_transaction_id_idx" ON "pos_imported_line_items"("transaction_id");

CREATE INDEX IF NOT EXISTS "pos_imported_line_items_provider_catalog_object_id_idx" ON "pos_imported_line_items"("provider_catalog_object_id");

CREATE INDEX IF NOT EXISTS "pos_product_mappings_vendor_id_idx" ON "pos_product_mappings"("vendor_id");

CREATE UNIQUE INDEX IF NOT EXISTS "pos_product_mappings_connection_id_provider_catalog_object__key" ON "pos_product_mappings"("connection_id", "provider_catalog_object_id");

CREATE UNIQUE INDEX IF NOT EXISTS "pos_location_mappings_connection_id_provider_location_id_key" ON "pos_location_mappings"("connection_id", "provider_location_id");

CREATE INDEX IF NOT EXISTS "pos_webhook_events_status_idx" ON "pos_webhook_events"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "pos_webhook_events_provider_provider_event_id_key" ON "pos_webhook_events"("provider", "provider_event_id");

CREATE INDEX IF NOT EXISTS "pos_sync_errors_connection_id_scope_idx" ON "pos_sync_errors"("connection_id", "scope");

-- ---------------------------------------------------------------------------
-- Foreign keys (defensive: skip if already added)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
    ALTER TABLE "pos_connections" ADD CONSTRAINT "pos_connections_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "pos_credentials" ADD CONSTRAINT "pos_credentials_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "pos_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "pos_sync_runs" ADD CONSTRAINT "pos_sync_runs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "pos_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "pos_imported_transactions" ADD CONSTRAINT "pos_imported_transactions_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "pos_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "pos_imported_transactions" ADD CONSTRAINT "pos_imported_transactions_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "pos_imported_transactions" ADD CONSTRAINT "pos_imported_transactions_sync_run_id_fkey" FOREIGN KEY ("sync_run_id") REFERENCES "pos_sync_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "pos_imported_line_items" ADD CONSTRAINT "pos_imported_line_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "pos_imported_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "pos_imported_line_items" ADD CONSTRAINT "pos_imported_line_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "pos_product_mappings" ADD CONSTRAINT "pos_product_mappings_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "pos_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "pos_product_mappings" ADD CONSTRAINT "pos_product_mappings_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "pos_product_mappings" ADD CONSTRAINT "pos_product_mappings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "pos_location_mappings" ADD CONSTRAINT "pos_location_mappings_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "pos_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "pos_location_mappings" ADD CONSTRAINT "pos_location_mappings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "pos_webhook_events" ADD CONSTRAINT "pos_webhook_events_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "pos_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "pos_sync_errors" ADD CONSTRAINT "pos_sync_errors_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "pos_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "pos_sync_errors" ADD CONSTRAINT "pos_sync_errors_sync_run_id_fkey" FOREIGN KEY ("sync_run_id") REFERENCES "pos_sync_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

COMMIT;
