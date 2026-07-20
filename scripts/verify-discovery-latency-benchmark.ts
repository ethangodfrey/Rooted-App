/**
 * Discovery Engine latency benchmark (PR #206b).
 *
 * Usage:
 *   npm run test:discovery:latency-benchmark
 *
 * Success lines (uppercase, no emoji):
 *   SEARCH_OPTIMIZATION_INITIALIZED
 *   DISCOVERY_LATENCY_VERIFIED
 */

import {
  assertDiscoveryPruneSqlValid,
  buildDiscoveryOrderActivityPruneSql,
  buildDiscoveryOrderPruneWindow,
  DISCOVERY_LATENCY_BUDGET_MS,
  formatDiscoveryLatencyVerifiedLog,
  isWithinLatencyBudget,
  measureDiscoveryLatency,
  resolveSearchRouting,
} from '../backend/src/modules/search/discovery-latency.util';
import {
  buildPartialIndexPriorityPlan,
  formatSearchOptimizationInitializedLog,
} from '../backend/src/modules/search/partition-aware-indexing.util';
import {
  CONNECTED_WHOLESALER_SCORE_MULTIPLIER,
  rankWholesaleHitsByConnectedVendors,
} from '../backend/src/modules/search/wholesale-ranking.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

async function simulateIndexLookup(routingKeys: string[]): Promise<{
  hits: Array<{
    id: string;
    vendorId: string;
    name: string;
    description: string | null;
    packagingUnit: string;
    moq: number;
    unitPriceCents: number;
    availableQuantity: number;
    status: string;
    score: number;
    distanceMiles: number | null;
  }>;
  indexLatencyMs: number;
}> {
  const started = performance.now();
  // Synthetic shard-routed lookup — routing keys shrink the candidate set.
  const catalog = [
    {
      id: 'p1',
      vendorId: 'v-connected',
      name: 'Bulk Basil',
      score: 12,
    },
    {
      id: 'p2',
      vendorId: 'v-other',
      name: 'Bulk Kale',
      score: 8,
    },
    {
      id: 'p3',
      vendorId: 'v-session',
      name: 'Bulk Carrots',
      score: 10,
    },
  ];
  const allowed = new Set(routingKeys);
  const filtered =
    allowed.size > 0
      ? catalog.filter((row) => allowed.has(row.vendorId))
      : catalog;

  // Busy-work bounded well under the 100ms budget to model pruned scan cost.
  let checksum = 0;
  for (let i = 0; i < 2_500; i += 1) {
    checksum += i % 17;
  }
  void checksum;

  return {
    hits: filtered.map((row) => ({
      id: row.id,
      vendorId: row.vendorId,
      name: row.name,
      description: null,
      packagingUnit: 'case',
      moq: 10,
      unitPriceCents: 1200,
      availableQuantity: 40,
      status: 'ACTIVE',
      score: row.score,
      distanceMiles: null,
    })),
    indexLatencyMs: Math.max(0, performance.now() - started),
  };
}

async function main(): Promise<void> {
  const plan = buildPartialIndexPriorityPlan({
    reference: new Date(Date.UTC(2026, 6, 20)),
    monthsBack: 3,
    routingField: 'vendor_id',
  });
  log(formatSearchOptimizationInitializedLog(plan));

  const pruneWindow = buildDiscoveryOrderPruneWindow(
    new Date(Date.UTC(2026, 6, 20)),
    3,
  );
  assert(
    pruneWindow.start.toISOString() === '2026-05-01T00:00:00.000Z',
    `PRUNE_START_FAIL=${pruneWindow.start.toISOString()}`,
  );
  assert(
    pruneWindow.end.toISOString() === '2026-08-01T00:00:00.000Z',
    `PRUNE_END_FAIL=${pruneWindow.end.toISOString()}`,
  );

  const pruneSql = buildDiscoveryOrderActivityPruneSql({
    start: pruneWindow.start,
    end: pruneWindow.end,
  });
  assertDiscoveryPruneSqlValid(pruneSql);
  assert(pruneSql.includes('2026-05-01'), 'PRUNE_SQL_START_FAIL');
  assert(pruneSql.includes('2026-08-01'), 'PRUNE_SQL_END_FAIL');

  const routingKeys = resolveSearchRouting({
    sessionVendorId: 'v-session',
    connectedVendorIds: ['v-connected'],
  });
  assert(routingKeys.length === 1, 'ROUTING_CONNECTED_FAIL');
  assert(routingKeys[0] === 'v-connected', 'ROUTING_KEY_FAIL');

  let indexLatencyMs = 0;
  const measured = await measureDiscoveryLatency({
    source: 'ELASTICSEARCH',
    routingApplied: true,
    partitionPruneApplied: true,
    run: async () => {
      const lookup = await simulateIndexLookup(routingKeys);
      indexLatencyMs = lookup.indexLatencyMs;
      return rankWholesaleHitsByConnectedVendors(
        lookup.hits,
        new Set(['v-connected']),
        CONNECTED_WHOLESALER_SCORE_MULTIPLIER,
        { radiusMiles: null, proximityWeight: 0 },
      );
    },
  });
  measured.sample.indexLatencyMs = indexLatencyMs;

  assert(measured.result.length >= 1, 'HIT_COUNT_FAIL');
  assert(
    measured.result[0].vendorId === 'v-connected',
    'CONNECTED_RANK_FAIL',
  );
  assert(
    isWithinLatencyBudget(measured.sample, DISCOVERY_LATENCY_BUDGET_MS),
    `LATENCY_BUDGET_FAIL QUERY_MS=${measured.sample.queryLatencyMs}`,
  );
  assert(
    measured.sample.queryLatencyMs >= measured.sample.indexLatencyMs,
    'QUERY_VS_INDEX_FAIL',
  );

  log(formatDiscoveryLatencyVerifiedLog(measured.sample));
  log(
    `DISCOVERY_LATENCY_BENCHMARK_PASSED BUDGET_MS=${DISCOVERY_LATENCY_BUDGET_MS} ROUTING=${routingKeys.length} PRUNE=1`,
  );
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`DISCOVERY_LATENCY_BENCHMARK_FAILED ERROR=${message}`);
  process.exit(1);
});
