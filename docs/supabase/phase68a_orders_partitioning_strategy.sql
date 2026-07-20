-- Phase 68a — Operational scale: monthly RANGE partitioning strategy
-- for public.orders and public.order_items (PostgreSQL declarative partitioning).
--
-- STRICT RULES:
--   1. Partition key = created_at (monthly RANGE)
--   2. Primary keys MUST include the partition key: (id, created_at)
--   3. order_items stores order_created_at to support FK to partitioned orders
--
-- This file DEFINES the target structure (strategy). Data cutover lives in
-- phase68b_orders_partition_migration.sql.

-- ---------------------------------------------------------------------------
-- Target parent: orders (PARTITION BY RANGE created_at)
-- ---------------------------------------------------------------------------
-- Example DDL (applied by phase68b migration against a renamed legacy table):
--
-- CREATE TABLE public.orders (
--   id uuid NOT NULL DEFAULT gen_random_uuid(),
--   ... existing columns ...,
--   created_at timestamptz NOT NULL DEFAULT now(),
--   updated_at timestamptz NOT NULL DEFAULT now(),
--   PRIMARY KEY (id, created_at)
-- ) PARTITION BY RANGE (created_at);
--
-- CREATE TABLE public.orders_y2026m01 PARTITION OF public.orders
--   FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- ---------------------------------------------------------------------------
-- Target parent: order_items (PARTITION BY RANGE created_at)
-- ---------------------------------------------------------------------------
-- CREATE TABLE public.order_items (
--   id uuid NOT NULL DEFAULT gen_random_uuid(),
--   order_id uuid NOT NULL,
--   order_created_at timestamptz NOT NULL,
--   ... existing columns ...,
--   created_at timestamptz NOT NULL DEFAULT now(),
--   PRIMARY KEY (id, created_at),
--   FOREIGN KEY (order_id, order_created_at)
--     REFERENCES public.orders (id, created_at)
--     ON DELETE CASCADE
-- ) PARTITION BY RANGE (created_at);

-- ---------------------------------------------------------------------------
-- Strategy metadata (idempotent registry for ops / verify scripts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partition_strategy_registry (
  table_name text PRIMARY KEY,
  partition_method text NOT NULL,
  partition_key text NOT NULL,
  primary_key_columns text[] NOT NULL,
  interval_label text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

INSERT INTO public.partition_strategy_registry AS psr (
  table_name,
  partition_method,
  partition_key,
  primary_key_columns,
  interval_label,
  notes
) VALUES
  (
    'orders',
    'RANGE',
    'created_at',
    ARRAY['id', 'created_at'],
    'monthly',
    'PARTITIONING_STRATEGY_APPLIED TABLE=orders KEY=created_at INTERVAL=monthly'
  ),
  (
    'order_items',
    'RANGE',
    'created_at',
    ARRAY['id', 'created_at'],
    'monthly',
    'PARTITIONING_STRATEGY_APPLIED TABLE=order_items KEY=created_at INTERVAL=monthly'
  )
ON CONFLICT (table_name) DO UPDATE
SET
  partition_method = EXCLUDED.partition_method,
  partition_key = EXCLUDED.partition_key,
  primary_key_columns = EXCLUDED.primary_key_columns,
  interval_label = EXCLUDED.interval_label,
  applied_at = now(),
  notes = EXCLUDED.notes;

-- Helper: compute monthly partition bounds (UTC)
CREATE OR REPLACE FUNCTION public.orders_partition_bounds(p_ts timestamptz)
RETURNS TABLE (partition_start timestamptz, partition_end timestamptz, partition_suffix text)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    date_trunc('month', p_ts AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS partition_start,
    (date_trunc('month', p_ts AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC' AS partition_end,
    to_char(date_trunc('month', p_ts AT TIME ZONE 'UTC'), '"y"YYYY"m"MM') AS partition_suffix;
$$;

COMMENT ON FUNCTION public.orders_partition_bounds(timestamptz) IS
  'PARTITIONING_STRATEGY_APPLIED HELPER=orders_partition_bounds INTERVAL=monthly';
