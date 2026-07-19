import type { WholesaleInvoiceDisplayStatus } from '@/lib/b2b/types';

/**
 * AR badge from persisted status, with soft OVERDUE fallback for PENDING/ISSUED
 * past due_at before the daily cron commits OVERDUE.
 */
export function resolveInvoiceDisplayStatus(
  status: string,
  dueAtIso: string,
  now: Date = new Date(),
): WholesaleInvoiceDisplayStatus {
  if (status === 'PAID') return 'PAID';
  if (status === 'OVERDUE') return 'OVERDUE';
  const dueAt = new Date(dueAtIso);
  const pastDue =
    !Number.isNaN(dueAt.getTime()) && dueAt.getTime() < now.getTime();
  if (status === 'PENDING' || status === 'ISSUED') {
    return pastDue ? 'OVERDUE' : 'PENDING';
  }
  return pastDue ? 'OVERDUE' : 'PENDING';
}
