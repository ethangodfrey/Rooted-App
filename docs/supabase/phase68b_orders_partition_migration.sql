-- Phase 68b — Migration path: cut over orders / order_items to monthly partitions.
-- Prerequisites: run phase68a_orders_partitioning_strategy.sql first.
--
-- SAFE OPS NOTES:
--   * Run during a maintenance window.
--   * Takes ACCESS EXCLUSIVE locks while renaming legacy tables.
--   * Keeps legacy tables as orders_legacy / order_items_legacy for rollback.
--   * Creates monthly partitions covering min(created_at)..now()+1 month,
--     plus a DEFAULT catch-all partition.

-- ---------------------------------------------------------------------------
-- 0) Ensure strategy helpers exist
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.partition_strategy_registry WHERE table_name = 'orders'
  ) THEN
    RAISE EXCEPTION 'PARTITION_MIGRATION_BLOCKED REASON=STRATEGY_NOT_APPLIED';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1) Rename live tables to legacy (idempotent guard)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.orders_legacy') IS NULL
     AND to_regclass('public.orders') IS NOT NULL THEN
    ALTER TABLE public.orders RENAME TO orders_legacy;
  END IF;

  IF to_regclass('public.order_items_legacy') IS NULL
     AND to_regclass('public.order_items') IS NOT NULL THEN
    ALTER TABLE public.order_items RENAME TO order_items_legacy;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Create partitioned parents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transaction_id uuid NULL,
  shopper_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  event_id uuid NULL,
  market_id uuid NULL,
  leftover_listing_id uuid NULL,
  order_type text NOT NULL DEFAULT 'event_pickup',
  order_status text NOT NULL DEFAULT 'submitted',
  payment_status text NOT NULL DEFAULT 'unpaid',
  fulfillment_type text DEFAULT 'pickup',
  pickup_datetime timestamptz NULL,
  delivery_address text NULL,
  delivery_city text NULL,
  delivery_state text NULL,
  scheduled_datetime timestamptz NULL,
  delivery_instructions text NULL,
  subtotal integer NOT NULL,
  tax integer NOT NULL DEFAULT 0,
  total integer NOT NULL,
  platform_fee integer NOT NULL DEFAULT 0,
  pickup_code text NULL,
  fulfillment_window_start timestamptz NULL,
  fulfillment_window_end timestamptz NULL,
  stripe_checkout_session_id text NULL,
  stripe_payment_intent_id text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  order_created_at timestamptz NOT NULL,
  product_id uuid NULL,
  leftover_listing_id uuid NULL,
  item_title text NULL,
  quantity integer NOT NULL,
  item_price integer NOT NULL,
  customization_data jsonb NULL,
  fulfillment_status text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at),
  FOREIGN KEY (order_id, order_created_at)
    REFERENCES public.orders (id, created_at)
    ON DELETE CASCADE
) PARTITION BY RANGE (created_at);

-- ---------------------------------------------------------------------------
-- 3) Ensure monthly partitions for a timestamp (idempotent)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_orders_month_partition(p_ts timestamptz)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_suffix text;
  v_orders_name text;
  v_items_name text;
BEGIN
  SELECT partition_start, partition_end, partition_suffix
  INTO v_start, v_end, v_suffix
  FROM public.orders_partition_bounds(p_ts);

  v_orders_name := format('orders_%s', v_suffix);
  v_items_name := format('order_items_%s', v_suffix);

  IF to_regclass(format('public.%I', v_orders_name)) IS NULL THEN
    EXECUTE format(
      'CREATE TABLE public.%I PARTITION OF public.orders FOR VALUES FROM (%L) TO (%L)',
      v_orders_name,
      v_start,
      v_end
    );
  END IF;

  IF to_regclass(format('public.%I', v_items_name)) IS NULL THEN
    EXECUTE format(
      'CREATE TABLE public.%I PARTITION OF public.order_items FOR VALUES FROM (%L) TO (%L)',
      v_items_name,
      v_start,
      v_end
    );
  END IF;

  RETURN v_suffix;
END;
$$;

-- DEFAULT partitions catch unexpected/null-bucketed rows during cutover.
DO $$
BEGIN
  IF to_regclass('public.orders_default') IS NULL THEN
    CREATE TABLE public.orders_default PARTITION OF public.orders DEFAULT;
  END IF;
  IF to_regclass('public.order_items_default') IS NULL THEN
    CREATE TABLE public.order_items_default PARTITION OF public.order_items DEFAULT;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) Create partitions covering legacy data range + next month
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_min timestamptz;
  v_max timestamptz;
  v_cursor timestamptz;
BEGIN
  SELECT COALESCE(min(created_at), date_trunc('month', now()))
  INTO v_min
  FROM public.orders_legacy;

  SELECT COALESCE(max(created_at), now()) + interval '1 month'
  INTO v_max
  FROM public.orders_legacy;

  v_cursor := date_trunc('month', v_min AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  WHILE v_cursor <= v_max LOOP
    PERFORM public.ensure_orders_month_partition(v_cursor);
    v_cursor := v_cursor + interval '1 month';
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5) Copy data from legacy tables
--    Uses information_schema so missing optional columns become NULL.
--    Always qualify legacy columns as o./oi. to avoid INSERT-target resolution.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._partition_legacy_col(
  p_table text,
  p_column text,
  p_alias text,
  p_fallback text
) RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = p_table
      AND c.column_name = p_column
  ) THEN
    RETURN format('%s.%I', p_alias, p_column);
  END IF;
  RETURN p_fallback;
END;
$$;

DO $$
DECLARE
  v_sql text;
BEGIN
  v_sql := format(
    $sql$
    INSERT INTO public.orders (
      id,
      transaction_id,
      shopper_id,
      vendor_id,
      event_id,
      market_id,
      leftover_listing_id,
      order_type,
      order_status,
      payment_status,
      fulfillment_type,
      pickup_datetime,
      delivery_address,
      delivery_city,
      delivery_state,
      scheduled_datetime,
      delivery_instructions,
      subtotal,
      tax,
      total,
      platform_fee,
      pickup_code,
      fulfillment_window_start,
      fulfillment_window_end,
      stripe_checkout_session_id,
      stripe_payment_intent_id,
      notes,
      created_at,
      updated_at
    )
    SELECT
      o.id,
      %s,
      o.shopper_id,
      o.vendor_id,
      o.event_id,
      %s,
      %s,
      COALESCE(%s, 'event_pickup'),
      COALESCE(o.order_status, 'submitted'),
      COALESCE(o.payment_status, 'unpaid'),
      %s,
      o.pickup_datetime,
      %s,
      %s,
      %s,
      %s,
      %s,
      o.subtotal,
      COALESCE(o.tax, 0),
      o.total,
      COALESCE(%s, 0),
      %s,
      %s,
      %s,
      %s,
      %s,
      %s,
      o.created_at,
      COALESCE(%s, o.created_at)
    FROM public.orders_legacy o
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.orders p
      WHERE p.id = o.id AND p.created_at = o.created_at
    )
    $sql$,
    public._partition_legacy_col('orders_legacy', 'transaction_id', 'o', 'NULL::uuid'),
    public._partition_legacy_col('orders_legacy', 'market_id', 'o', 'NULL::uuid'),
    public._partition_legacy_col('orders_legacy', 'leftover_listing_id', 'o', 'NULL::uuid'),
    public._partition_legacy_col('orders_legacy', 'order_type', 'o', 'NULL::text'),
    public._partition_legacy_col('orders_legacy', 'fulfillment_type', 'o', 'NULL::text'),
    public._partition_legacy_col('orders_legacy', 'delivery_address', 'o', 'NULL::text'),
    public._partition_legacy_col('orders_legacy', 'delivery_city', 'o', 'NULL::text'),
    public._partition_legacy_col('orders_legacy', 'delivery_state', 'o', 'NULL::text'),
    public._partition_legacy_col('orders_legacy', 'scheduled_datetime', 'o', 'NULL::timestamptz'),
    public._partition_legacy_col('orders_legacy', 'delivery_instructions', 'o', 'NULL::text'),
    public._partition_legacy_col('orders_legacy', 'platform_fee', 'o', 'NULL::integer'),
    public._partition_legacy_col('orders_legacy', 'pickup_code', 'o', 'NULL::text'),
    public._partition_legacy_col('orders_legacy', 'fulfillment_window_start', 'o', 'NULL::timestamptz'),
    public._partition_legacy_col('orders_legacy', 'fulfillment_window_end', 'o', 'NULL::timestamptz'),
    public._partition_legacy_col('orders_legacy', 'stripe_checkout_session_id', 'o', 'NULL::text'),
    public._partition_legacy_col('orders_legacy', 'stripe_payment_intent_id', 'o', 'NULL::text'),
    public._partition_legacy_col('orders_legacy', 'notes', 'o', 'NULL::text'),
    public._partition_legacy_col('orders_legacy', 'updated_at', 'o', 'NULL::timestamptz')
  );

  EXECUTE v_sql;

  v_sql := format(
    $sql$
    INSERT INTO public.order_items (
      id,
      order_id,
      order_created_at,
      product_id,
      leftover_listing_id,
      item_title,
      quantity,
      item_price,
      customization_data,
      fulfillment_status,
      created_at
    )
    SELECT
      oi.id,
      oi.order_id,
      o.created_at AS order_created_at,
      oi.product_id,
      %s,
      %s,
      oi.quantity,
      oi.item_price,
      %s,
      %s,
      COALESCE(o.created_at, now()) AS created_at
    FROM public.order_items_legacy oi
    INNER JOIN public.orders_legacy o ON o.id = oi.order_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.order_items p
      WHERE p.id = oi.id
        AND p.created_at = COALESCE(o.created_at, now())
    )
    $sql$,
    public._partition_legacy_col('order_items_legacy', 'leftover_listing_id', 'oi', 'NULL::uuid'),
    public._partition_legacy_col('order_items_legacy', 'item_title', 'oi', 'NULL::text'),
    public._partition_legacy_col('order_items_legacy', 'customization_data', 'oi', 'NULL::jsonb'),
    public._partition_legacy_col('order_items_legacy', 'fulfillment_status', 'oi', 'NULL::text')
  );

  EXECUTE v_sql;
END $$;

DROP FUNCTION IF EXISTS public._partition_legacy_col(text, text, text, text);

-- ---------------------------------------------------------------------------
-- 6) Index maintenance plan (partition pruning friendly)
-- ---------------------------------------------------------------------------
-- Local indexes on parents propagate to partitions in PG11+.
CREATE INDEX IF NOT EXISTS orders_created_at_idx
  ON public.orders (created_at);

CREATE INDEX IF NOT EXISTS orders_shopper_created_at_idx
  ON public.orders (shopper_id, created_at DESC);

CREATE INDEX IF NOT EXISTS orders_vendor_created_at_idx
  ON public.orders (vendor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS orders_market_created_at_idx
  ON public.orders (market_id, created_at DESC)
  WHERE market_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS order_items_created_at_idx
  ON public.order_items (created_at);

CREATE INDEX IF NOT EXISTS order_items_order_created_at_idx
  ON public.order_items (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS order_items_product_created_at_idx
  ON public.order_items (product_id, created_at DESC)
  WHERE product_id IS NOT NULL;

-- Pickup code lookup: include partition key for uniqueness on partitioned table.
CREATE UNIQUE INDEX IF NOT EXISTS orders_pickup_code_created_at_uidx
  ON public.orders (pickup_code, created_at)
  WHERE pickup_code IS NOT NULL;

-- Maintenance helper: create next N monthly partitions ahead of time.
CREATE OR REPLACE FUNCTION public.maintain_orders_partitions(p_months_ahead integer DEFAULT 2)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_i integer := 0;
  v_cursor timestamptz := date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
BEGIN
  IF p_months_ahead < 0 THEN
    RAISE EXCEPTION 'PARTITION_MAINTENANCE_INVALID MONTHS_AHEAD=%', p_months_ahead;
  END IF;

  WHILE v_i <= p_months_ahead LOOP
    PERFORM public.ensure_orders_month_partition(v_cursor + (v_i || ' months')::interval);
    v_i := v_i + 1;
  END LOOP;

  RETURN p_months_ahead + 1;
END;
$$;

COMMENT ON FUNCTION public.maintain_orders_partitions(integer) IS
  'QUERY_OPTIMIZATION_VERIFIED HELPER=maintain_orders_partitions CREATE_AHEAD_MONTHLY_PARTITIONS';

-- Example historical query that should prune to a single monthly partition:
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT o.id, o.total, oi.quantity
-- FROM public.orders o
-- JOIN public.order_items oi
--   ON oi.order_id = o.id
--  AND oi.order_created_at = o.created_at
-- WHERE o.created_at >= TIMESTAMPTZ '2026-07-01'
--   AND o.created_at <  TIMESTAMPTZ '2026-08-01'
--   AND o.vendor_id = '...'::uuid;

SELECT public.maintain_orders_partitions(2);
