export type WholesaleInvoiceDisplayStatus = 'PENDING' | 'PAID' | 'OVERDUE';

/**
 * AR badge from persisted status, with soft OVERDUE fallback for PENDING/ISSUED
 * past due_at before the daily cron commits OVERDUE.
 */
export function resolveInvoiceDisplayStatus(
  status: string,
  dueAt: Date,
  now: Date = new Date(),
): WholesaleInvoiceDisplayStatus {
  if (status === 'PAID') return 'PAID';
  if (status === 'OVERDUE') return 'OVERDUE';
  if (status === 'PENDING' || status === 'ISSUED') {
    if (dueAt.getTime() < now.getTime()) return 'OVERDUE';
    return 'PENDING';
  }
  if (dueAt.getTime() < now.getTime()) return 'OVERDUE';
  return 'PENDING';
}
