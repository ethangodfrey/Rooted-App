/**
 * Health suite module 1 — Database Partitioning Integrity.
 *
 * Usage:
 *   npm run test:health:partition-integrity
 *
 * Success lines:
 *   HEALTH_TEST_STARTED
 *   PERFORMANCE_METRICS_VALIDATED
 */

import {
  assertPartitionPruningForSingleMonth,
  buildSingleMonthOrdersExplainPlan,
  countTouchedPartitions,
  MAX_PARTITIONS_PER_SINGLE_MONTH_QUERY,
  samplePrunedExplainAnalyze,
  sampleUnprunedExplainAnalyze,
} from '../backend/src/modules/orders/partition-pruning-integrity.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  log('HEALTH_TEST_STARTED MODULE=PARTITION_INTEGRITY');

  const reference = new Date(Date.UTC(2026, 6, 20, 12, 0, 0));
  const plan = buildSingleMonthOrdersExplainPlan(reference);
  assert(plan.monthSuffix === 'y2026m07', `SUFFIX_FAIL=${plan.monthSuffix}`);
  assert(plan.explainSql.includes('EXPLAIN (ANALYZE'), 'EXPLAIN_ANALYZE_MISSING');
  assert(plan.sql.includes('created_at >='), 'FILTER_LOWER_MISSING');
  assert(plan.sql.includes('created_at <'), 'FILTER_UPPER_MISSING');

  const pruned = samplePrunedExplainAnalyze(plan.monthSuffix);
  const prunedResult = assertPartitionPruningForSingleMonth({
    explainText: pruned,
    expectedSuffix: plan.monthSuffix,
  });
  assert(prunedResult.touched.length <= MAX_PARTITIONS_PER_SINGLE_MONTH_QUERY, 'PRUNED_TOUCH_FAIL');
  assert(countTouchedPartitions(pruned) === 1, 'PRUNED_COUNT_FAIL');

  const unpruned = sampleUnprunedExplainAnalyze();
  let failed = false;
  try {
    assertPartitionPruningForSingleMonth({
      explainText: unpruned,
      expectedSuffix: plan.monthSuffix,
    });
  } catch {
    failed = true;
  }
  assert(failed, 'UNPRUNED_SHOULD_FAIL');
  assert(
    countTouchedPartitions(unpruned) > MAX_PARTITIONS_PER_SINGLE_MONTH_QUERY,
    'UNPRUNED_COUNT_FAIL',
  );

  log(
    `PERFORMANCE_METRICS_VALIDATED MODULE=PARTITION_INTEGRITY TOUCHED=${prunedResult.touched.length} MAX=${MAX_PARTITIONS_PER_SINGLE_MONTH_QUERY} EXPECTED=${plan.monthSuffix} PRUNE=1`,
  );
  log('HEALTH_PARTITION_INTEGRITY_VERIFIED');
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`HEALTH_PARTITION_INTEGRITY_FAILED ERROR=${message}`);
  process.exit(1);
}
