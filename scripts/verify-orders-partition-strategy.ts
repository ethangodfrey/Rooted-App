/**
 * Phase 15a — orders partitioning strategy verification.
 *
 * Usage:
 *   npm run test:orders:partition-strategy
 *
 * Success lines (uppercase, no emoji):
 *   PARTITIONING_STRATEGY_APPLIED
 *   ORDERS_PARTITION_STRATEGY_VERIFIED
 */

import {
  assertPartitionStrategyValid,
  formatPartitionStrategyAppliedLog,
  monthlyPartitionBounds,
  ORDERS_PARTITION_STRATEGIES,
} from '../backend/src/modules/orders/orders-partitioning.strategy';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  assertPartitionStrategyValid();
  assert(ORDERS_PARTITION_STRATEGIES.length === 2, 'STRATEGY_COUNT_FAIL');

  const july = monthlyPartitionBounds(new Date('2026-07-15T12:00:00.000Z'));
  assert(july.suffix === 'y2026m07', 'SUFFIX_FAIL');
  assert(july.start.toISOString() === '2026-07-01T00:00:00.000Z', 'START_FAIL');
  assert(july.end.toISOString() === '2026-08-01T00:00:00.000Z', 'END_FAIL');

  for (const strategy of ORDERS_PARTITION_STRATEGIES) {
    log(formatPartitionStrategyAppliedLog(strategy.tableName));
  }
  log('ORDERS_PARTITION_STRATEGY_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ORDERS_PARTITION_STRATEGY_FAILED ${message}`);
  process.exitCode = 1;
}
