/**
 * Discovery Engine — partition-aware partial indexing (PR #206a).
 *
 * Usage:
 *   npm run test:discovery:partition-indexing
 *
 * Success lines (uppercase, no emoji):
 *   SEARCH_OPTIMIZATION_INITIALIZED
 *   DISCOVERY_PARTITION_INDEXING_VERIFIED
 */

import {
  assertPartialIndexPlanValid,
  buildPartialIndexPriorityPlan,
  buildPartialOrderActivitySyncSql,
  elasticsearchCreatedAtRoutingKey,
  elasticsearchRoutingKey,
  formatSearchOptimizationInitializedLog,
  recentPartitionWindows,
} from '../backend/src/modules/search/partition-aware-indexing.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  const reference = new Date(Date.UTC(2026, 6, 20, 12, 0, 0));
  const plan = buildPartialIndexPriorityPlan({
    reference,
    monthsBack: 3,
    routingField: 'vendor_id',
  });

  assertPartialIndexPlanValid(plan);
  log(formatSearchOptimizationInitializedLog(plan));

  const windows = recentPartitionWindows(reference, 3, ['orders']);
  assert(windows.length === 3, 'WINDOW_COUNT_FAIL');
  assert(windows[0].suffix === 'y2026m07', `HOT_SUFFIX_FAIL=${windows[0].suffix}`);
  assert(windows[0].priority === 0, 'HOT_PRIORITY_FAIL');
  assert(windows[1].suffix === 'y2026m06', `PREV_SUFFIX_FAIL=${windows[1].suffix}`);
  assert(windows[2].suffix === 'y2026m05', `OLDER_SUFFIX_FAIL=${windows[2].suffix}`);

  const sync = buildPartialOrderActivitySyncSql({
    start: windows[0].start,
    end: windows[0].end,
    limit: 100,
  });
  assert(sync.prunePredicatePresent, 'PRUNE_PREDICATE_MISSING');
  assert(sync.partitionSuffix === 'y2026m07', 'SYNC_SUFFIX_FAIL');
  assert(sync.sql.includes('oi.order_created_at = o.created_at'), 'COMPOSITE_JOIN_FAIL');
  assert(sync.sql.includes('o.created_at >='), 'ORDERS_PRUNE_FAIL');
  assert(sync.sql.includes('oi.created_at >='), 'ITEMS_PRUNE_FAIL');

  const vendorId = '11111111-1111-1111-8111-111111111111';
  assert(
    elasticsearchRoutingKey(vendorId) === vendorId,
    'VENDOR_ROUTING_FAIL',
  );
  assert(
    elasticsearchCreatedAtRoutingKey(windows[0].start) === 'y2026m07',
    'CREATED_AT_ROUTING_FAIL',
  );

  let threw = false;
  try {
    elasticsearchRoutingKey('  ');
  } catch {
    threw = true;
  }
  assert(threw, 'EMPTY_ROUTING_SHOULD_THROW');

  // Partial indexing must not include partitions older than monthsBack.
  const allSuffixes = new Set(plan.windows.map((w) => w.suffix));
  assert(!allSuffixes.has('y2026m04'), 'STALE_PARTITION_INCLUDED');
  assert(allSuffixes.has('y2026m07'), 'CURRENT_PARTITION_MISSING');

  log(
    `PARTITION_AWARE_SYNC_COMPLETED PARTITION=${sync.partitionSuffix} ROWS=0 INDEXED=0`,
  );
  log('DISCOVERY_PARTITION_INDEXING_VERIFIED');
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`DISCOVERY_PARTITION_INDEXING_FAILED ERROR=${message}`);
  process.exit(1);
}
