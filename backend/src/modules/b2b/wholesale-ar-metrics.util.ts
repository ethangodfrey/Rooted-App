export type SupplierArMetricBuckets = {
  TOTAL_REVENUE_CENTS: number;
  OUTSTANDING_CAPITAL_CENTS: number;
  AT_RISK_CAPITAL_CENTS: number;
  COUNT_PAID: number;
  COUNT_PENDING: number;
  COUNT_OVERDUE: number;
};

/**
 * Aggregate seller invoice rows into AR command-center buckets.
 * PAID → total revenue; PENDING/ISSUED → outstanding; OVERDUE → at-risk.
 */
export function aggregateSupplierArMetrics(
  rows: Array<{ status: string; totalCents: number }>,
): SupplierArMetricBuckets {
  const buckets: SupplierArMetricBuckets = {
    TOTAL_REVENUE_CENTS: 0,
    OUTSTANDING_CAPITAL_CENTS: 0,
    AT_RISK_CAPITAL_CENTS: 0,
    COUNT_PAID: 0,
    COUNT_PENDING: 0,
    COUNT_OVERDUE: 0,
  };

  for (const row of rows) {
    const cents = Number.isFinite(row.totalCents) ? Math.max(0, row.totalCents) : 0;
    const status = String(row.status || '').toUpperCase();
    if (status === 'PAID') {
      buckets.TOTAL_REVENUE_CENTS += cents;
      buckets.COUNT_PAID += 1;
      continue;
    }
    if (status === 'OVERDUE') {
      buckets.AT_RISK_CAPITAL_CENTS += cents;
      buckets.COUNT_OVERDUE += 1;
      continue;
    }
    if (status === 'PENDING' || status === 'ISSUED') {
      buckets.OUTSTANDING_CAPITAL_CENTS += cents;
      buckets.COUNT_PENDING += 1;
    }
  }

  return buckets;
}
