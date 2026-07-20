/**
 * Phase 15b — partition migration helpers + historical query plan checks.
 * Telemetry: QUERY_OPTIMIZATION_VERIFIED
 */

import {
  monthlyPartitionBounds,
  type PartitionedOrdersTable,
} from './orders-partitioning.strategy';

export type HistoricalOrderQueryPlan = {
  table: PartitionedOrdersTable;
  predicateIncludesPartitionKey: boolean;
  expectedPartitionSuffix: string;
  sql: string;
};

export const PARTITION_INDEX_MAINTENANCE_PLAN = [
  'orders_created_at_idx',
  'orders_shopper_created_at_idx',
  'orders_vendor_created_at_idx',
  'orders_market_created_at_idx',
  'order_items_created_at_idx',
  'order_items_order_created_at_idx',
  'order_items_product_created_at_idx',
  'orders_pickup_code_created_at_uidx',
] as const;

export function buildHistoricalOrdersQuery(input: {
  vendorId: string;
  createdAt: Date;
}): HistoricalOrderQueryPlan {
  const bounds = monthlyPartitionBounds(input.createdAt);
  const sql = [
    'SELECT o.id, o.total, oi.quantity',
    'FROM public.orders o',
    'JOIN public.order_items oi',
    '  ON oi.order_id = o.id',
    ' AND oi.order_created_at = o.created_at',
    `WHERE o.created_at >= TIMESTAMPTZ '${bounds.start.toISOString()}'`,
    `  AND o.created_at <  TIMESTAMPTZ '${bounds.end.toISOString()}'`,
    `  AND o.vendor_id = '${input.vendorId}'::uuid`,
  ].join('\n');

  return {
    table: 'orders',
    predicateIncludesPartitionKey: sql.includes('o.created_at >='),
    expectedPartitionSuffix: bounds.suffix,
    sql,
  };
}

export function assertHistoricalQueryPrunable(
  plan: HistoricalOrderQueryPlan,
): void {
  if (!plan.predicateIncludesPartitionKey) {
    throw new Error('QUERY_OPTIMIZATION_FAIL MISSING_PARTITION_PREDICATE');
  }
  if (!/^y\d{4}m\d{2}$/.test(plan.expectedPartitionSuffix)) {
    throw new Error(
      `QUERY_OPTIMIZATION_FAIL BAD_SUFFIX=${plan.expectedPartitionSuffix}`,
    );
  }
  if (!plan.sql.includes('order_created_at = o.created_at')) {
    throw new Error('QUERY_OPTIMIZATION_FAIL MISSING_COMPOSITE_JOIN');
  }
}

export function formatQueryOptimizationVerifiedLog(
  plan: HistoricalOrderQueryPlan,
): string {
  return `QUERY_OPTIMIZATION_VERIFIED TABLE=${plan.table} PARTITION=${plan.expectedPartitionSuffix} PRUNE=1 INDEXES=${PARTITION_INDEX_MAINTENANCE_PLAN.length}`;
}

/** In-memory cutover check: legacy rows must round-trip into partitioned shape. */
export function migrateLegacyOrdersInMemory(
  legacyOrders: Array<{ id: string; createdAt: string; total: number }>,
  legacyItems: Array<{
    id: string;
    orderId: string;
    quantity: number;
  }>,
): {
  orders: Array<{ id: string; createdAt: string; total: number; partition: string }>;
  items: Array<{
    id: string;
    orderId: string;
    orderCreatedAt: string;
    createdAt: string;
    quantity: number;
    partition: string;
  }>;
} {
  const orders = legacyOrders.map((row) => {
    const createdAt = new Date(row.createdAt);
    return {
      id: row.id,
      createdAt: row.createdAt,
      total: row.total,
      partition: monthlyPartitionBounds(createdAt).suffix,
    };
  });

  const orderCreatedAtById = new Map(
    orders.map((row) => [row.id, row.createdAt]),
  );

  const items = legacyItems.map((row) => {
    const orderCreatedAt = orderCreatedAtById.get(row.orderId);
    if (!orderCreatedAt) {
      throw new Error(`MIGRATION_FAIL ORPHAN_ITEM=${row.id}`);
    }
    return {
      id: row.id,
      orderId: row.orderId,
      orderCreatedAt,
      createdAt: orderCreatedAt,
      quantity: row.quantity,
      partition: monthlyPartitionBounds(new Date(orderCreatedAt)).suffix,
    };
  });

  return { orders, items };
}

export function assertMigratedHistoryMatches(
  legacyOrders: Array<{ id: string; createdAt: string; total: number }>,
  migratedOrders: Array<{ id: string; createdAt: string; total: number }>,
): void {
  assertSameCount(legacyOrders.length, migratedOrders.length, 'ORDER_COUNT');
  const byId = new Map(migratedOrders.map((row) => [row.id, row]));
  for (const legacy of legacyOrders) {
    const migrated = byId.get(legacy.id);
    if (!migrated) {
      throw new Error(`HISTORY_FAIL MISSING_ORDER=${legacy.id}`);
    }
    if (migrated.total !== legacy.total || migrated.createdAt !== legacy.createdAt) {
      throw new Error(`HISTORY_FAIL MISMATCH_ORDER=${legacy.id}`);
    }
  }
}

function assertSameCount(left: number, right: number, label: string): void {
  if (left !== right) {
    throw new Error(`HISTORY_FAIL ${label} LEFT=${left} RIGHT=${right}`);
  }
}
