-- Phase 68b RECOVERY — resume after failed data copy.
-- Use when orders_legacy / order_items_legacy already exist and partitioned
-- parents were created, but INSERT failed on missing legacy columns.

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
  IF to_regclass('public.orders_legacy') IS NULL THEN
    RAISE EXCEPTION 'PARTITION_RECOVERY_BLOCKED REASON=ORDERS_LEGACY_MISSING';
  END IF;
  IF to_regclass('public.order_items_legacy') IS NULL THEN
    RAISE EXCEPTION 'PARTITION_RECOVERY_BLOCKED REASON=ORDER_ITEMS_LEGACY_MISSING';
  END IF;

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

CREATE UNIQUE INDEX IF NOT EXISTS orders_pickup_code_created_at_uidx
  ON public.orders (pickup_code, created_at)
  WHERE pickup_code IS NOT NULL;

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

SELECT public.maintain_orders_partitions(2);
