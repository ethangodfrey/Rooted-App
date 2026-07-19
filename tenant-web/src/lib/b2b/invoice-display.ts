import type { WholesaleInvoiceDisplayStatus } from '@/lib/b2b/types';

/** AR badge: PAID, OVERDUE (unpaid past due), else PENDING. */
export function resolveInvoiceDisplayStatus(
  status: string,
  dueAtIso: string,
  now: Date = new Date(),
): WholesaleInvoiceDisplayStatus {
  if (status === 'PAID') return 'PAID';
  const dueAt = new Date(dueAtIso);
  if (!Number.isNaN(dueAt.getTime()) && dueAt.getTime() < now.getTime()) {
    return 'OVERDUE';
  }
  return 'PENDING';
}
