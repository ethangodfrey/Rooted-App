/**
 * Phase 14c — supplier A/R analytics summary verification.
 *
 * Usage:
 *   npm run test:supplier:ar-analytics
 *
 * Success lines (uppercase, no emoji):
 *   METRICS_AGGREGATION_SUCCESS
 *   SUPPLIER_AR_ANALYTICS_VERIFIED
 */

import { aggregateSupplierArSummary } from '../backend/src/modules/supplier-analytics/supplier-ar-analytics.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  const issuedAt = new Date('2026-06-01T00:00:00.000Z');
  const paidAt = new Date('2026-06-16T00:00:00.000Z');

  const summary = aggregateSupplierArSummary([
    {
      status: 'PAID',
      totalCents: 100_000,
      issuedAt,
      paidAt,
    },
    {
      status: 'PENDING',
      totalCents: 50_000,
      issuedAt,
      paidAt: null,
    },
    {
      status: 'OVERDUE',
      totalCents: 25_000,
      issuedAt,
      paidAt: null,
    },
  ]);

  assert(summary.AVERAGE_DAYS_TO_PAY === 15, 'AR_FAIL AVERAGE_DAYS_TO_PAY');
  assert(summary.COLLECTED_REVENUE_CENTS === 100_000, 'AR_FAIL COLLECTED');
  assert(summary.PENDING_REVENUE_CENTS === 50_000, 'AR_FAIL PENDING');
  assert(summary.AT_RISK_REVENUE_CENTS === 25_000, 'AR_FAIL AT_RISK');

  log(
    `METRICS_AGGREGATION_SUCCESS SELLER=11111111-1111-1111-8111-111111111111 COLLECTED_CENTS=${summary.COLLECTED_REVENUE_CENTS} PENDING_CENTS=${summary.PENDING_REVENUE_CENTS} AVG_DAYS_TO_PAY=${summary.AVERAGE_DAYS_TO_PAY}`,
  );
  log('SUPPLIER_AR_ANALYTICS_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`SUPPLIER_AR_ANALYTICS_FAILED ${message}`);
  process.exitCode = 1;
}
