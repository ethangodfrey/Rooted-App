import { aggregateSupplierArMetrics } from '../b2b/wholesale-ar-metrics.util';

export type SupplierArSummary = {
  AVERAGE_DAYS_TO_PAY: number;
  COLLECTED_REVENUE_CENTS: number;
  PENDING_REVENUE_CENTS: number;
  AT_RISK_REVENUE_CENTS: number;
  TOTAL_REVENUE_CENTS: number;
  OUTSTANDING_CAPITAL_CENTS: number;
  AT_RISK_CAPITAL_CENTS: number;
  COUNT_PAID: number;
  COUNT_PENDING: number;
  COUNT_OVERDUE: number;
};

export function aggregateSupplierArSummary(
  rows: Array<{
    status: string;
    totalCents: number;
    issuedAt: Date;
    paidAt: Date | null;
  }>,
): SupplierArSummary {
  const buckets = aggregateSupplierArMetrics(
    rows.map((row) => ({
      status: row.status,
      totalCents: row.totalCents,
    })),
  );

  const paidRows = rows.filter(
    (row) => row.status === 'PAID' && row.paidAt != null,
  );
  let averageDaysToPay = 0;
  if (paidRows.length > 0) {
    const totalDays = paidRows.reduce((sum, row) => {
      const paidAt = row.paidAt as Date;
      const millis = paidAt.getTime() - row.issuedAt.getTime();
      return sum + millis / (1000 * 60 * 60 * 24);
    }, 0);
    averageDaysToPay = Number((totalDays / paidRows.length).toFixed(2));
  }

  return {
    AVERAGE_DAYS_TO_PAY: averageDaysToPay,
    COLLECTED_REVENUE_CENTS: buckets.TOTAL_REVENUE_CENTS,
    PENDING_REVENUE_CENTS: buckets.OUTSTANDING_CAPITAL_CENTS,
    AT_RISK_REVENUE_CENTS: buckets.AT_RISK_CAPITAL_CENTS,
    TOTAL_REVENUE_CENTS: buckets.TOTAL_REVENUE_CENTS,
    OUTSTANDING_CAPITAL_CENTS: buckets.OUTSTANDING_CAPITAL_CENTS,
    AT_RISK_CAPITAL_CENTS: buckets.AT_RISK_CAPITAL_CENTS,
    COUNT_PAID: buckets.COUNT_PAID,
    COUNT_PENDING: buckets.COUNT_PENDING,
    COUNT_OVERDUE: buckets.COUNT_OVERDUE,
  };
}
