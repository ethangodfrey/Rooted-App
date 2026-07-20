/**
 * Phase 15b — partition migration path + historical query verification.
 *
 * Usage:
 *   npm run test:orders:partition-migration
 *
 * Success lines (uppercase, no emoji):
 *   PARTITIONING_STRATEGY_APPLIED
 *   QUERY_OPTIMIZATION_VERIFIED
 *   ORDERS_PARTITION_MIGRATION_VERIFIED
 */

import { formatPartitionStrategyAppliedLog } from '../backend/src/modules/orders/orders-partitioning.strategy';
import {
  assertHistoricalQueryPrunable,
  assertMigratedHistoryMatches,
  buildHistoricalOrdersQuery,
  formatQueryOptimizationVerifiedLog,
  migrateLegacyOrdersInMemory,
  PARTITION_INDEX_MAINTENANCE_PLAN,
} from '../backend/src/modules/orders/orders-partition-migration.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  log(formatPartitionStrategyAppliedLog('orders'));
  log(formatPartitionStrategyAppliedLog('order_items'));

  const legacyOrders = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      createdAt: '2026-06-12T10:00:00.000Z',
      total: 4200,
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      createdAt: '2026-07-03T15:30:00.000Z',
      total: 8800,
    },
  ];
  const legacyItems = [
    {
      id: '33333333-3333-4333-8333-333333333333',
      orderId: '11111111-1111-4111-8111-111111111111',
      quantity: 2,
    },
    {
      id: '44444444-4444-4444-8444-444444444444',
      orderId: '22222222-2222-4222-8222-222222222222',
      quantity: 4,
    },
  ];

  const migrated = migrateLegacyOrdersInMemory(legacyOrders, legacyItems);
  assertMigratedHistoryMatches(legacyOrders, migrated.orders);
  assert(migrated.orders[0].partition === 'y2026m06', 'PARTITION_JUNE_FAIL');
  assert(migrated.orders[1].partition === 'y2026m07', 'PARTITION_JULY_FAIL');
  assert(
    migrated.items.every((item) => item.orderCreatedAt === item.createdAt),
    'ITEM_CREATED_AT_ALIGN_FAIL',
  );

  const julyOrder = migrated.orders[1];
  const julyItems = migrated.items.filter(
    (item) => item.orderId === julyOrder.id,
  );
  assert(julyItems.length === 1, 'HISTORICAL_JULY_ITEM_COUNT_FAIL');
  assert(julyItems[0].quantity === 4, 'HISTORICAL_JULY_QTY_FAIL');
  assert(julyOrder.total === 8800, 'HISTORICAL_JULY_TOTAL_FAIL');

  const plan = buildHistoricalOrdersQuery({
    vendorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    createdAt: new Date(julyOrder.createdAt),
  });
  assertHistoricalQueryPrunable(plan);
  assert(plan.expectedPartitionSuffix === 'y2026m07', 'PRUNE_SUFFIX_FAIL');
  assert(
    PARTITION_INDEX_MAINTENANCE_PLAN.includes('orders_vendor_created_at_idx'),
    'INDEX_PLAN_FAIL',
  );

  log(formatQueryOptimizationVerifiedLog(plan));
  log('ORDERS_PARTITION_MIGRATION_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ORDERS_PARTITION_MIGRATION_FAILED ${message}`);
  process.exitCode = 1;
}
