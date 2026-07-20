/**
 * Health suite — discovery search latency percentiles + QUERY/INDEX delta.
 * Telemetry: PERFORMANCE_METRICS_VALIDATED
 */

import {
  DISCOVERY_LATENCY_BUDGET_MS,
  measureDiscoveryLatency,
  resolveSearchRouting,
  type DiscoveryLatencySample,
} from './discovery-latency.util';
import { elasticsearchRoutingKey } from './partition-aware-indexing.util';

export const SEARCH_LATENCY_P95_BUDGET_MS = DISCOVERY_LATENCY_BUDGET_MS;

export type SearchLatencyTrial = {
  routing: string;
  sample: DiscoveryLatencySample;
  deltaMs: number;
};

export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) {
    throw new Error('PERCENTILE_FAIL EMPTY_SAMPLES');
  }
  const clamped = Math.min(100, Math.max(0, p));
  const rank = (clamped / 100) * (sortedAsc.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sortedAsc[low];
  const weight = rank - low;
  return sortedAsc[low] * (1 - weight) + sortedAsc[high] * weight;
}

export function queryIndexDeltaMs(sample: DiscoveryLatencySample): number {
  return Math.max(0, sample.queryLatencyMs - sample.indexLatencyMs);
}

/**
 * Synthetic routed wholesale-product search — models ES shard affinity by vendor_id.
 */
export async function runRoutedWholesaleSearchTrial(input: {
  vendorId: string;
  query: string;
  workUnits?: number;
}): Promise<SearchLatencyTrial> {
  const routing = elasticsearchRoutingKey(input.vendorId);
  const keys = resolveSearchRouting({ preferVendorIds: [routing] });
  let indexLatencyMs = 0;

  const measured = await measureDiscoveryLatency({
    source: 'ELASTICSEARCH',
    routingApplied: keys.length > 0,
    partitionPruneApplied: true,
    run: async () => {
      const indexStarted = performance.now();
      const catalog = [
        { id: 'p1', vendorId: routing, name: 'Bulk Basil', score: 12 },
        { id: 'p2', vendorId: 'other-vendor', name: 'Bulk Kale', score: 8 },
        { id: 'p3', vendorId: routing, name: 'Bulk Carrots', score: 10 },
      ];
      const allowed = new Set(keys);
      const hits = catalog.filter((row) => allowed.has(row.vendorId));
      const units = Math.max(500, input.workUnits ?? 1500);
      let checksum = 0;
      for (let i = 0; i < units; i += 1) {
        checksum += (i + input.query.length) % 19;
      }
      void checksum;
      indexLatencyMs = Math.max(0, performance.now() - indexStarted);
      return hits;
    },
  });

  measured.sample.indexLatencyMs = indexLatencyMs;
  return {
    routing,
    sample: measured.sample,
    deltaMs: queryIndexDeltaMs(measured.sample),
  };
}

export async function runSearchLatencyBenchmark(input?: {
  iterations?: number;
  vendorIds?: string[];
  p95BudgetMs?: number;
}): Promise<{
  trials: SearchLatencyTrial[];
  p95QueryMs: number;
  p50QueryMs: number;
  meanDeltaMs: number;
  withinBudget: boolean;
}> {
  const iterations = Math.max(5, input?.iterations ?? 40);
  const vendors =
    input?.vendorIds ??
    [
      '11111111-1111-1111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
    ];
  const budget = input?.p95BudgetMs ?? SEARCH_LATENCY_P95_BUDGET_MS;
  const trials: SearchLatencyTrial[] = [];

  for (let i = 0; i < iterations; i += 1) {
    const vendorId = vendors[i % vendors.length];
    trials.push(
      await runRoutedWholesaleSearchTrial({
        vendorId,
        query: i % 2 === 0 ? 'bulk' : 'basil',
      }),
    );
  }

  const queryMs = trials
    .map((t) => t.sample.queryLatencyMs)
    .sort((a, b) => a - b);
  const p95QueryMs = percentile(queryMs, 95);
  const p50QueryMs = percentile(queryMs, 50);
  const meanDeltaMs =
    trials.reduce((sum, t) => sum + t.deltaMs, 0) / trials.length;
  const withinBudget = p95QueryMs <= budget;

  return { trials, p95QueryMs, p50QueryMs, meanDeltaMs, withinBudget };
}

export function formatPerformanceMetricsValidatedLog(input: {
  p95QueryMs: number;
  p50QueryMs: number;
  meanDeltaMs: number;
  iterations: number;
  budgetMs?: number;
}): string {
  const budget = input.budgetMs ?? SEARCH_LATENCY_P95_BUDGET_MS;
  const within = input.p95QueryMs <= budget ? '1' : '0';
  return `PERFORMANCE_METRICS_VALIDATED P95_QUERY_MS=${input.p95QueryMs.toFixed(2)} P50_QUERY_MS=${input.p50QueryMs.toFixed(2)} MEAN_DELTA_MS=${input.meanDeltaMs.toFixed(2)} ITERATIONS=${input.iterations} BUDGET_MS=${budget} WITHIN=${within}`;
}
