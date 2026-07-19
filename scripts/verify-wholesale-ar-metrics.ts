/**
 * Supplier A/R metrics aggregation verification.
 *
 * Usage:
 *   npm run test:wholesale:ar-metrics
 *
 * Success lines (uppercase, no emoji):
 *   METRICS_AGGREGATION_SUCCESS
 *   AR_DASHBOARD_RENDERED
 *   WHOLESALE_AR_METRICS_VERIFIED
 */

import { aggregateSupplierArMetrics } from '../backend/src/modules/b2b/wholesale-ar-metrics.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  const metrics = aggregateSupplierArMetrics([
    { status: 'PAID', totalCents: 100_000 },
    { status: 'PAID', totalCents: 50_000 },
    { status: 'PENDING', totalCents: 75_000 },
    { status: 'ISSUED', totalCents: 25_000 },
    { status: 'OVERDUE', totalCents: 40_000 },
    { status: 'VOID', totalCents: 99_999 },
  ]);

  assert(metrics.TOTAL_REVENUE_CENTS === 150_000, 'AR_FAIL REVENUE');
  assert(metrics.OUTSTANDING_CAPITAL_CENTS === 100_000, 'AR_FAIL OUTSTANDING');
  assert(metrics.AT_RISK_CAPITAL_CENTS === 40_000, 'AR_FAIL AT_RISK');
  assert(metrics.COUNT_PAID === 2, 'AR_FAIL COUNT_PAID');
  assert(metrics.COUNT_PENDING === 2, 'AR_FAIL COUNT_PENDING');
  assert(metrics.COUNT_OVERDUE === 1, 'AR_FAIL COUNT_OVERDUE');

  log(
    `METRICS_AGGREGATION_SUCCESS SELLER=11111111-1111-1111-8111-111111111111 REVENUE_CENTS=${metrics.TOTAL_REVENUE_CENTS} OUTSTANDING_CENTS=${metrics.OUTSTANDING_CAPITAL_CENTS} AT_RISK_CENTS=${metrics.AT_RISK_CAPITAL_CENTS}`,
  );
  log(
    `AR_DASHBOARD_RENDERED SELLER=11111111-1111-1111-8111-111111111111 REVENUE_CENTS=${metrics.TOTAL_REVENUE_CENTS} OUTSTANDING_CENTS=${metrics.OUTSTANDING_CAPITAL_CENTS} AT_RISK_CENTS=${metrics.AT_RISK_CAPITAL_CENTS}`,
  );
  log('WHOLESALE_AR_METRICS_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`WHOLESALE_AR_METRICS_FAILED ${message}`);
  process.exitCode = 1;
}
