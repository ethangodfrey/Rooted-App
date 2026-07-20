/**
 * Phase 16a — partition-aware Elasticsearch sync for partitioned orders / order_items.
 * Partial indexing prioritizes active/recent monthly partitions.
 * Telemetry: SEARCH_OPTIMIZATION_INITIALIZED
 */

import {
  monthlyPartitionBounds,
  partitionSuffixForMonth,
  type PartitionedOrdersTable,
} from '../orders/orders-partitioning.strategy';

/** Default lookback: current month + previous N-1 months (active/recent only). */
export const PARTIAL_INDEX_RECENT_MONTHS = 3 as const;

export type PartitionWindow = {
  suffix: string;
  start: Date;
  end: Date;
  priority: number;
  tableName: PartitionedOrdersTable;
};

export type PartialIndexPriorityPlan = {
  tables: readonly PartitionedOrdersTable[];
  windows: PartitionWindow[];
  monthsBack: number;
  routingField: 'vendor_id' | 'created_at';
};

/**
 * Build UTC month windows for partial indexing, newest first (priority 0 = hottest).
 */
export function recentPartitionWindows(
  reference: Date = new Date(),
  monthsBack: number = PARTIAL_INDEX_RECENT_MONTHS,
  tables: readonly PartitionedOrdersTable[] = ['orders', 'order_items'],
): PartitionWindow[] {
  const count = Math.max(1, Math.floor(monthsBack));
  const windows: PartitionWindow[] = [];

  for (let offset = 0; offset < count; offset += 1) {
    const monthDate = new Date(
      Date.UTC(
        reference.getUTCFullYear(),
        reference.getUTCMonth() - offset,
        1,
        0,
        0,
        0,
        0,
      ),
    );
    const bounds = monthlyPartitionBounds(monthDate);
    for (const tableName of tables) {
      windows.push({
        suffix: bounds.suffix,
        start: bounds.start,
        end: bounds.end,
        priority: offset,
        tableName,
      });
    }
  }

  return windows;
}

export function buildPartialIndexPriorityPlan(input?: {
  reference?: Date;
  monthsBack?: number;
  routingField?: 'vendor_id' | 'created_at';
}): PartialIndexPriorityPlan {
  const monthsBack = input?.monthsBack ?? PARTIAL_INDEX_RECENT_MONTHS;
  const tables: readonly PartitionedOrdersTable[] = ['orders', 'order_items'];
  return {
    tables,
    windows: recentPartitionWindows(
      input?.reference ?? new Date(),
      monthsBack,
      tables,
    ),
    monthsBack,
    routingField: input?.routingField ?? 'vendor_id',
  };
}

/** Elasticsearch routing key — vendor shard affinity for discovery product docs. */
export function elasticsearchRoutingKey(vendorId: string): string {
  const trimmed = vendorId.trim();
  if (!trimmed) {
    throw new Error('ELASTICSEARCH_ROUTING_INVALID VENDOR_ID_EMPTY');
  }
  return trimmed;
}

/** Routing by created_at month partition suffix (order activity docs). */
export function elasticsearchCreatedAtRoutingKey(createdAt: Date): string {
  return partitionSuffixForMonth(createdAt);
}

/**
 * SQL fragment that forces Postgres to prune to recent monthly partitions.
 * Always includes created_at lower/upper bounds on the partitioned parent.
 */
export function buildPartitionPrunePredicate(input: {
  alias: string;
  start: Date;
  end: Date;
}): string {
  return [
    `${input.alias}.created_at >= TIMESTAMPTZ '${input.start.toISOString()}'`,
    `${input.alias}.created_at <  TIMESTAMPTZ '${input.end.toISOString()}'`,
  ].join('\n  AND ');
}

/**
 * Sync query for order-driven catalog signals — only recent partitions.
 * Joins orders ↔ order_items with composite partition-key equality.
 */
export function buildPartialOrderActivitySyncSql(input: {
  start: Date;
  end: Date;
  limit?: number;
}): {
  sql: string;
  partitionSuffix: string;
  prunePredicatePresent: boolean;
} {
  const limit = Math.min(Math.max(input.limit ?? 500, 1), 5000);
  const suffix = partitionSuffixForMonth(input.start);
  const sql = [
    'SELECT',
    '  o.vendor_id,',
    '  oi.product_id,',
    '  COUNT(*)::int AS order_line_count,',
    '  MAX(o.created_at) AS last_ordered_at',
    'FROM public.orders o',
    'JOIN public.order_items oi',
    '  ON oi.order_id = o.id',
    ' AND oi.order_created_at = o.created_at',
    `WHERE ${buildPartitionPrunePredicate({ alias: 'o', start: input.start, end: input.end })}`,
    `  AND ${buildPartitionPrunePredicate({ alias: 'oi', start: input.start, end: input.end })}`,
    'GROUP BY o.vendor_id, oi.product_id',
    `LIMIT ${limit}`,
  ].join('\n');

  return {
    sql,
    partitionSuffix: suffix,
    prunePredicatePresent:
      sql.includes('o.created_at >=') && sql.includes('oi.created_at >='),
  };
}

export function assertPartialIndexPlanValid(plan: PartialIndexPriorityPlan): void {
  if (plan.windows.length === 0) {
    throw new Error('PARTIAL_INDEX_PLAN_INVALID EMPTY_WINDOWS');
  }
  if (plan.monthsBack < 1) {
    throw new Error('PARTIAL_INDEX_PLAN_INVALID MONTHS_BACK');
  }
  const priorities = plan.windows.map((w) => w.priority);
  if (priorities[0] !== 0) {
    throw new Error('PARTIAL_INDEX_PLAN_INVALID HOT_PARTITION_NOT_FIRST');
  }
  for (const window of plan.windows) {
    if (window.end.getTime() <= window.start.getTime()) {
      throw new Error(
        `PARTIAL_INDEX_PLAN_INVALID BOUNDS PARTITION=${window.suffix}`,
      );
    }
  }
}

export function formatSearchOptimizationInitializedLog(
  plan: PartialIndexPriorityPlan,
): string {
  const suffixes = [
    ...new Set(plan.windows.map((w) => w.suffix)),
  ].join(',');
  return `SEARCH_OPTIMIZATION_INITIALIZED TABLES=${plan.tables.join(',')} MONTHS=${plan.monthsBack} PARTITIONS=${suffixes} ROUTING=${plan.routingField} PARTIAL=1`;
}
