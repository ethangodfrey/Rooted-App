/**
 * Health suite module 2 — Search Engine Latency Benchmark.
 *
 * Usage:
 *   npm run test:health:search-latency
 *
 * Success lines:
 *   HEALTH_TEST_STARTED
 *   PERFORMANCE_METRICS_VALIDATED
 */

import {
  formatPerformanceMetricsValidatedLog,
  runSearchLatencyBenchmark,
  SEARCH_LATENCY_P95_BUDGET_MS,
} from '../backend/src/modules/search/discovery-latency-benchmark.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

async function main(): Promise<void> {
  log('HEALTH_TEST_STARTED MODULE=SEARCH_LATENCY');

  const result = await runSearchLatencyBenchmark({
    iterations: 40,
    p95BudgetMs: SEARCH_LATENCY_P95_BUDGET_MS,
  });

  assert(result.trials.length === 40, `TRIAL_COUNT_FAIL=${result.trials.length}`);
  assert(
    result.trials.every((t) => t.sample.routingApplied),
    'ROUTING_REQUIRED_FAIL',
  );

  for (const trial of result.trials.slice(0, 3)) {
    log(
      `SEARCH_LATENCY_SAMPLE ROUTING=${trial.routing} QUERY_MS=${trial.sample.queryLatencyMs.toFixed(2)} INDEX_MS=${trial.sample.indexLatencyMs.toFixed(2)} DELTA_MS=${trial.deltaMs.toFixed(2)}`,
    );
  }

  log(
    `SEARCH_LATENCY_DELTA MEAN_DELTA_MS=${result.meanDeltaMs.toFixed(2)} (QUERY_MS - INDEX_MS)`,
  );

  assert(
    result.withinBudget,
    `P95_BUDGET_FAIL P95=${result.p95QueryMs.toFixed(2)} BUDGET=${SEARCH_LATENCY_P95_BUDGET_MS}`,
  );

  log(
    formatPerformanceMetricsValidatedLog({
      p95QueryMs: result.p95QueryMs,
      p50QueryMs: result.p50QueryMs,
      meanDeltaMs: result.meanDeltaMs,
      iterations: result.trials.length,
    }),
  );
  log('HEALTH_SEARCH_LATENCY_VERIFIED');
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`HEALTH_SEARCH_LATENCY_FAILED ERROR=${message}`);
  process.exit(1);
});
